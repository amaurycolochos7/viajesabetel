import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MercadoPagoConfig, Payment } from 'mercadopago'

// Cliente Supabase con Service Role para escritura privilegiada
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function POST(request: NextRequest) {
    try {
        const url = new URL(request.url)
        const topic = url.searchParams.get('topic') || url.searchParams.get('type')
        const id = url.searchParams.get('id') || url.searchParams.get('data.id')

        // Mercado Pago a veces envía el ID en el query params, a veces en el body
        const body = await request.json().catch(() => ({}))
        const paymentId = body.data?.id || body.id || id
        const type = body.type || topic

        // console.log('Webhook received:', { type, paymentId })

        if (type === 'payment' && paymentId) {
            const accessToken = process.env.MP_ACCESS_TOKEN
            if (!accessToken) {
                console.error('MP_ACCESS_TOKEN missing')
                return NextResponse.json({ error: 'Config missing' }, { status: 500 })
            }

            // 1. Consultar estado real del pago en MP
            const client = new MercadoPagoConfig({ accessToken })
            const paymentClient = new Payment(client)
            const paymentData = await paymentClient.get({ id: paymentId })

            if (paymentData.status === 'approved') {
                const externalRef = paymentData.external_reference
                const amount = paymentData.transaction_amount
                // const netReceived = paymentData.transaction_details?.net_received_amount || amount

                if (!externalRef) {
                    console.error('Payment missing external_reference')
                    return NextResponse.json({ received: true })
                }

                // CHECK IF IT IS A TICKET ORDER (UUID) OR RESERVATION (BETEL-...)
                const isTicketOrder = externalRef.length === 36 && externalRef.includes('-') && !externalRef.startsWith('BETEL')

                if (isTicketOrder) {
                    // --- HANDLE TICKET ORDER ---
                    const { error: ticketError } = await supabase
                        .from('ticket_orders')
                        .update({ status: 'paid' })
                        .eq('id', externalRef)

                    if (ticketError) {
                        console.error('Error updating ticket order:', ticketError)
                    } else {
                        // console.log(`Ticket Order ${externalRef} marked as paid`)
                    }

                } else {
                    // --- HANDLE RESERVATION ---
                    const reservationCode = externalRef

                    // 2. Verificar si ya existe este pago para idempotencia (Only for reservations currently)
                    const { data: existingPayment } = await supabase
                        .from('payments')
                        .select('id')
                        .eq('reference', String(paymentId))
                        .single()

                    if (existingPayment) {
                        return NextResponse.json({ received: true })
                    }

                    // 3. Buscar la reservación
                    const { data: reservation } = await supabase
                        .from('reservations')
                        .select('id, total_amount, deposit_required, amount_paid')
                        .eq('reservation_code', reservationCode)
                        .single()

                    if (!reservation) {
                        console.error('Reservation not found:', reservationCode)
                        return NextResponse.json({ received: true })
                    }

                    // 4. Registrar pago en Supabase
                    const { error: paymentError } = await supabase
                        .from('payments')
                        .insert({
                            reservation_id: reservation.id,
                            amount: amount,
                            method: 'mercadopago',
                            reference: String(paymentId),
                            note: `Pago MP: ${paymentData.status_detail}`
                        })

                    if (paymentError) {
                        console.error('Error inserting payment:', paymentError)
                        throw paymentError
                    }

                    // 5. Actualizar status de la reservación
                    const newAmountPaid = (reservation.amount_paid || 0) + (amount || 0)
                    let newStatus = 'pendiente'
                    if (newAmountPaid >= reservation.total_amount) {
                        newStatus = 'pagado_completo'
                    } else if (newAmountPaid >= reservation.deposit_required) {
                        newStatus = 'anticipo_pagado'
                    } else {
                        if (newAmountPaid > 0) newStatus = 'anticipo_pagado'
                    }

                    await supabase
                        .from('reservations')
                        .update({
                            amount_paid: newAmountPaid,
                            status: newStatus
                        })
                        .eq('id', reservation.id)
                }
            }
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('Webhook error:', error)
        // Return 200 to avoid MP retrying infinitely if it's a logic error on our side
        // unless it's a transient error.
        return NextResponse.json({ received: true }) // Acknowledge anyway
    }
}
