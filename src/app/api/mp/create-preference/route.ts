import { MercadoPagoConfig, Preference } from 'mercadopago'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const accessToken = process.env.MP_ACCESS_TOKEN

        if (!accessToken) {
            console.error('MP_ACCESS_TOKEN not configured')
            return NextResponse.json(
                { error: 'Mercado Pago no está configurado' },
                { status: 500 }
            )
        }

        const client = new MercadoPagoConfig({
            accessToken: accessToken,
        })

        const body = await request.json()
        const {
            reservationCode,
            responsibleName,
            totalAmount,
            seatsPayable,
            isDeposit
        } = body

        const amount = isDeposit ? Math.round(totalAmount * 0.5) : totalAmount
        const description = isDeposit
            ? `Anticipo 50% - ${reservationCode} (${seatsPayable} lugares)`
            : `Pago completo - ${reservationCode} (${seatsPayable} lugares)`

        const preference = new Preference(client)

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vamosabetel.vercel.app'

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
                    success: `${baseUrl}/reservar/confirmacion?status=success&code=${reservationCode}`,
                    failure: `${baseUrl}/reservar/confirmacion?status=failure&code=${reservationCode}`,
                    pending: `${baseUrl}/reservar/confirmacion?status=pending&code=${reservationCode}`,
                },
                auto_return: 'approved',
                external_reference: reservationCode,
            }
        })

        console.log('Preference created:', result.id)

        return NextResponse.json({
            preferenceId: result.id,
            initPoint: result.init_point,
            sandboxInitPoint: result.sandbox_init_point,
        })
    } catch (error: unknown) {
        console.error('Error creating preference:', error)
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
        return NextResponse.json(
            { error: `Error al crear la preferencia de pago: ${errorMessage}` },
            { status: 500 }
        )
    }
}
