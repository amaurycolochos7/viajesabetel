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
            reservationId,
            amount,
            description
        } = body

        if (!reservationId || !amount) {
            return NextResponse.json(
                { error: 'Faltan datos requeridos (reservationId, amount)' },
                { status: 400 }
            )
        }

        const preference = new Preference(client)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vamosabetel.vercel.app'

        // Create preference for the additional amount
        const result = await preference.create({
            body: {
                items: [
                    {
                        id: `res-mod-${reservationId}`,
                        title: description || 'Pago adicional reservación',
                        quantity: 1,
                        unit_price: Number(amount),
                        currency_id: 'MXN',
                    }
                ],
                back_urls: {
                    success: `${baseUrl}/modificar-reservacion?status=success`,
                    failure: `${baseUrl}/modificar-reservacion?status=failure`,
                    pending: `${baseUrl}/modificar-reservacion?status=pending`,
                },
                auto_return: 'approved',
                external_reference: reservationId, // Use reservation ID to identify
                metadata: {
                    type: 'reservation_modification',
                    reservation_id: reservationId
                }
            }
        })

        console.log('Reservation Preference created:', result.id)

        return NextResponse.json({
            preferenceId: result.id,
            init_point: result.init_point, // 注意: return init_point as expected by frontend
            sandbox_init_point: result.sandbox_init_point,
        })
    } catch (error: unknown) {
        console.error('Error creating reservation preference:', error)
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
        return NextResponse.json(
            { error: `Error al crear la preferencia de pago: ${errorMessage}` },
            { status: 500 }
        )
    }
}
