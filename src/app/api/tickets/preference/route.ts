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
            orderId,
            items,
            payerName,
            reservationCode
        } = body

        // Construct items for MP with descriptive titles
        const mpItems = items.map((item: any, index: number) => ({
            id: item.variantId,
            title: `${reservationCode} - Entrada ${item.name}`,
            description: `${item.variantName} para ${item.passengerName}`,
            quantity: item.quantity,
            unit_price: item.price,
            currency_id: 'MXN',
        }))

        // Add a summary item for clarity
        if (mpItems.length > 3) {
            // If more than 3 items, create a single summary item
            const allItems = items.map((i: any) => `${i.name} (${i.variantName})`).join(', ')
            mpItems.splice(0, mpItems.length, {
                id: 'tourist_attractions',
                title: `${reservationCode} - Entradas a Zonas Turísticas`,
                description: `Incluye: ${allItems.substring(0, 200)}${allItems.length > 200 ? '...' : ''}`,
                quantity: items.length,
                unit_price: items.reduce((sum: number, i: any) => sum + i.price, 0) / items.length,
                currency_id: 'MXN',
            })
        }

        const preference = new Preference(client)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vamosabetel.vercel.app'

        // We use the ORDER ID as the external reference for the webhook
        const result = await preference.create({
            body: {
                items: mpItems,
                payer: {
                    name: payerName,
                },
                back_urls: {
                    success: `${baseUrl}/comprar-entradas/confirmacion?status=success&order=${orderId}`,
                    failure: `${baseUrl}/comprar-entradas/confirmacion?status=failure&order=${orderId}`,
                    pending: `${baseUrl}/comprar-entradas/confirmacion?status=pending&order=${orderId}`,
                },
                auto_return: 'approved',
                external_reference: orderId,
                metadata: {
                    type: 'ticket_order',
                    reservation_code: reservationCode
                }
            }
        })

        console.log('Ticket Preference created:', result.id)

        return NextResponse.json({
            preferenceId: result.id,
            initPoint: result.init_point,
            sandboxInitPoint: result.sandbox_init_point,
        })
    } catch (error: unknown) {
        console.error('Error creating ticket preference:', error)
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
        return NextResponse.json(
            { error: `Error al crear la preferencia de pago: ${errorMessage}` },
            { status: 500 }
        )
    }
}
