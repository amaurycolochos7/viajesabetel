import { MercadoPagoConfig, Preference } from 'mercadopago'
import { NextRequest, NextResponse } from 'next/server'

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN || '',
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            reservationCode,
            responsibleName,
            totalAmount,
            seatsPayable,
            isDeposit
        } = body

        const amount = isDeposit ? totalAmount * 0.5 : totalAmount
        const description = isDeposit
            ? `Anticipo 50% - ${reservationCode} (${seatsPayable} lugares)`
            : `Pago completo - ${reservationCode} (${seatsPayable} lugares)`

        const preference = new Preference(client)

        const result = await preference.create({
            body: {
                items: [
                    {
                        id: reservationCode,
                        title: `Vamos a Betel 2026 - ${reservationCode}`,
                        description: description,
                        quantity: 1,
                        unit_price: amount,
                        currency_id: 'MXN',
                    }
                ],
                payer: {
                    name: responsibleName,
                },
                back_urls: {
                    success: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reservar/confirmacion?status=success&code=${reservationCode}`,
                    failure: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reservar/confirmacion?status=failure&code=${reservationCode}`,
                    pending: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reservar/confirmacion?status=pending&code=${reservationCode}`,
                },
                auto_return: 'approved',
                external_reference: reservationCode,
                notification_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mp/webhook`,
            }
        })

        return NextResponse.json({
            preferenceId: result.id,
            initPoint: result.init_point,
            sandboxInitPoint: result.sandbox_init_point,
        })
    } catch (error) {
        console.error('Error creating preference:', error)
        return NextResponse.json(
            { error: 'Error al crear la preferencia de pago' },
            { status: 500 }
        )
    }
}
