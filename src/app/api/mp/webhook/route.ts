import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // Mercado Pago sends different notification types
        if (body.type === 'payment') {
            const paymentId = body.data?.id

            // Here you would fetch payment details from MP API
            // and update the reservation status in Supabase
            console.log('Payment notification received:', paymentId)

            // For now, just acknowledge receipt
            return NextResponse.json({ received: true })
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('Webhook error:', error)
        return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
    }
}
