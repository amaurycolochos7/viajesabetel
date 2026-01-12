'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { generateTicketPDF } from '@/utils/generateTicketPDF'

function ConfirmationContent() {
    const searchParams = useSearchParams()
    const router = useRouter()

    const status = searchParams.get('status') // success, failure, pending
    const orderId = searchParams.get('order')
    const method = searchParams.get('method')

    const [isDownloading, setIsDownloading] = useState(false)
    const [orderData, setOrderData] = useState<any>(null)
    const [reservationData, setReservationData] = useState<any>(null)
    const [loadingData, setLoadingData] = useState(true)

    const isTransfer = method === 'transfer'

    // Load order and reservation data
    useEffect(() => {
        async function loadData() {
            if (!orderId) {
                setLoadingData(false)
                return
            }

            try {
                // Fetch order data
                const { data: order, error: orderError } = await supabase
                    .from('ticket_orders')
                    .select('*')
                    .eq('id', orderId)
                    .single()

                if (orderError || !order) {
                    console.error('Error loading order:', orderError)
                    setLoadingData(false)
                    return
                }

                setOrderData(order)

                // Fetch reservation data
                const { data: reservation, error: resError } = await supabase
                    .from('reservations')
                    .select('reservation_code, responsible_name')
                    .eq('id', order.reservation_id)
                    .single()

                if (resError || !reservation) {
                    console.error('Error loading reservation:', resError)
                    setLoadingData(false)
                    return
                }

                setReservationData(reservation)
            } catch (err) {
                console.error('Error:', err)
            } finally {
                setLoadingData(false)
            }
        }

        loadData()
    }, [orderId])

    const handleDownloadPDF = async () => {
        if (!orderData || !reservationData) return

        setIsDownloading(true)
        try {
            generateTicketPDF(orderData, reservationData)
        } catch (err) {
            console.error('Error generating PDF:', err)
            alert('Error al generar el PDF. Por favor intenta de nuevo.')
        } finally {
            setIsDownloading(false)
        }
    }

    return (
        <main style={{
            minHeight: '100vh',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
        }}>
            <div style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '24px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                maxWidth: '500px',
                width: '100%',
                textAlign: 'center'
            }}>
                {/* STATUS ICONS/UI */}

                {/* TRANSFER FLOW */}
                {isTransfer && (
                    <>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⏳</div>
                        <h1 style={{ fontFamily: 'var(--font-luckiest), cursive', color: '#f59e0b', fontSize: '2rem', marginBottom: '1rem' }}>
                            ¡ORDEN REGISTRADA!
                        </h1>
                        <p style={{ color: '#64748b', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                            Tu orden ha sido registrada. Para confirmarla, por favor realiza tu transferencia y <strong>envía el comprobante por WhatsApp</strong> indicando tu código de reservación.
                        </p>
                    </>
                )}

                {/* MERCADOPAGO SUCCESS */}
                {!isTransfer && status === 'success' && (
                    <>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
                        <h1 style={{ fontFamily: 'var(--font-luckiest), cursive', color: '#10b981', fontSize: '2rem', marginBottom: '1rem' }}>
                            ¡PAGO EXITOSO!
                        </h1>
                        <p style={{ color: '#64748b', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                            Tus entradas han sido confirmadas. Descarga tu comprobante a continuación.
                        </p>
                    </>
                )}

                {/* MERCADOPAGO PENDING */}
                {!isTransfer && status === 'pending' && (
                    <>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⏳</div>
                        <h1 style={{ fontFamily: 'var(--font-luckiest), cursive', color: '#f59e0b', fontSize: '2rem', marginBottom: '1rem' }}>
                            PAGO EN PROCESO
                        </h1>
                        <p style={{ color: '#64748b', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                            Estamos procesando tu pago. Te notificaremos cuando se confirme.
                        </p>
                    </>
                )}

                {/* MERCADOPAGO FAILURE */}
                {!isTransfer && status === 'failure' && (
                    <>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>❌</div>
                        <h1 style={{ fontFamily: 'var(--font-luckiest), cursive', color: '#ef4444', fontSize: '2rem', marginBottom: '1rem' }}>
                            ERROR EN EL PAGO
                        </h1>
                        <p style={{ color: '#64748b', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                            Hubo un problema al procesar tu pago. Por favor intenta nuevamente.
                        </p>
                    </>
                )}

                {/* PDF DOWNLOAD BUTTON - Show for all statuses when data is loaded */}
                {!loadingData && orderData && reservationData && status !== 'failure' && (
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isDownloading}
                        style={{
                            display: 'block',
                            width: '100%',
                            background: 'var(--primary)',
                            color: 'white',
                            padding: '1rem 2rem',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            textDecoration: 'none',
                            marginBottom: '1rem',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            border: 'none',
                            cursor: isDownloading ? 'wait' : 'pointer',
                            fontSize: '1rem',
                            opacity: isDownloading ? 0.7 : 1
                        }}
                    >
                        {isDownloading ? '⏳ Generando...' : '📄 Descargar Comprobante (PDF)'}
                    </button>
                )}

                {loadingData && orderId && (
                    <div style={{ padding: '1rem', color: '#888' }}>
                        Cargando datos de la orden...
                    </div>
                )}

                <Link
                    href="/"
                    style={{
                        display: 'inline-block',
                        background: '#0f172a',
                        color: 'white',
                        padding: '1rem 2rem',
                        borderRadius: '50px',
                        fontWeight: 'bold',
                        textDecoration: 'none',
                        marginTop: '1rem',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                >
                    Volver al Inicio
                </Link>

                {orderId && (
                    <p style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                        Orden ID: {orderId}
                    </p>
                )}

            </div>
        </main>
    )
}

export default function ConfirmationPage() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <ConfirmationContent />
        </Suspense>
    )
}
