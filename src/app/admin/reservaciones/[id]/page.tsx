'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Reservation, ReservationPassenger, Payment } from '@/types'
import { buildWhatsAppMessage, getWhatsAppLink } from '@/lib/whatsapp'

export default function ReservacionDetailPage() {
    const router = useRouter()
    const params = useParams()
    const [reservation, setReservation] = useState<Reservation | null>(null)
    const [passengers, setPassengers] = useState<ReservationPassenger[]>([])
    const [payments, setPayments] = useState<Payment[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentReference, setPaymentReference] = useState('')
    const [paymentNote, setPaymentNote] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        checkAuthAndLoadData()
    }, [params.id])

    const checkAuthAndLoadData = async () => {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            router.push('/admin/login')
            return
        }

        const { data: reservationData, error: resError } = await supabase
            .from('reservations')
            .select('*')
            .eq('id', params.id)
            .single()

        if (resError) {
            console.error(resError)
            setIsLoading(false)
            return
        }

        setReservation(reservationData as Reservation)

        const { data: passengersData } = await supabase
            .from('reservation_passengers')
            .select('*')
            .eq('reservation_id', params.id)
            .order('created_at', { ascending: true })

        if (passengersData) {
            setPassengers(passengersData as ReservationPassenger[])
        }

        const { data: paymentsData } = await supabase
            .from('payments')
            .select('*')
            .eq('reservation_id', params.id)
            .order('paid_at', { ascending: false })

        if (paymentsData) {
            setPayments(paymentsData as Payment[])
        }

        setIsLoading(false)
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/admin/login')
    }

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!reservation) return

        setIsSubmitting(true)

        try {
            const amount = parseFloat(paymentAmount)

            const { error: paymentError } = await supabase
                .from('payments')
                .insert({
                    reservation_id: reservation.id,
                    amount,
                    reference: paymentReference || null,
                    note: paymentNote || null,
                })

            if (paymentError) throw paymentError

            const newAmountPaid = reservation.amount_paid + amount
            let newStatus = reservation.status

            if (newAmountPaid >= reservation.total_amount) {
                newStatus = 'pagado_completo'
            } else if (newAmountPaid >= reservation.deposit_required) {
                newStatus = 'anticipo_pagado'
            }

            const { error: updateError } = await supabase
                .from('reservations')
                .update({
                    amount_paid: newAmountPaid,
                    status: newStatus,
                })
                .eq('id', reservation.id)

            if (updateError) throw updateError

            await checkAuthAndLoadData()

            setPaymentAmount('')
            setPaymentReference('')
            setPaymentNote('')
        } catch (err) {
            console.error(err)
            alert('Error al registrar el pago')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleStatusChange = async (newStatus: string) => {
        if (!reservation) return

        try {
            const { error } = await supabase
                .from('reservations')
                .update({ status: newStatus })
                .eq('id', reservation.id)

            if (error) throw error

            setReservation({ ...reservation, status: newStatus as Reservation['status'] })
        } catch (err) {
            console.error(err)
            alert('Error al cambiar el estatus')
        }
    }

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            pendiente: 'Pendiente',
            anticipo_pagado: 'Anticipo pagado',
            pagado_completo: 'Pagado completo',
            cancelado: 'Cancelado',
        }
        return labels[status] || status
    }

    if (isLoading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-page)'
            }}>
                <p>Cargando...</p>
            </div>
        )
    }

    if (!reservation) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-page)', minHeight: '100vh' }}>
                <p>Reservación no encontrada</p>
                <Link href="/admin/reservaciones" className="nav-button" style={{ marginTop: '1rem', display: 'inline-block', textDecoration: 'none' }}>
                    Volver
                </Link>
            </div>
        )
    }

    const remainingBalance = reservation.total_amount - reservation.amount_paid

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
            {/* Header */}
            <header style={{
                background: 'var(--primary)',
                color: 'white',
                padding: '1rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link
                        href="/admin/reservaciones"
                        style={{ color: 'white', textDecoration: 'none', opacity: 0.9 }}
                    >
                        ← Reservaciones
                    </Link>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                        {reservation.reservation_code}
                    </h1>
                    <span className={`status-badge status-${reservation.status}`}>
                        {getStatusLabel(reservation.status)}
                    </span>
                </div>
                <button
                    onClick={handleLogout}
                    style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: '1px solid rgba(255,255,255,0.3)',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                    }}
                >
                    Cerrar sesión
                </button>
            </header>

            <main style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem' }}>
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    {/* Reservation Info */}
                    <div className="card">
                        <h2 className="section-title">Información del responsable</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                            <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nombre</div>
                                <div style={{ fontWeight: '500' }}>{reservation.responsible_name}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Teléfono</div>
                                <div style={{ fontWeight: '500' }}>{reservation.responsible_phone}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Congregación</div>
                                <div style={{ fontWeight: '500' }}>{reservation.responsible_congregation || '—'}</div>
                            </div>
                        </div>

                        <hr style={{ margin: '1.25rem 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1rem', textAlign: 'center' }}>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{reservation.seats_total}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Lugares</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{reservation.seats_payable}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Pagan</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
                                    ${reservation.total_amount.toLocaleString('es-MX')}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2e7d32' }}>
                                    ${reservation.amount_paid.toLocaleString('es-MX')}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Pagado</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: remainingBalance > 0 ? '#c62828' : '#2e7d32' }}>
                                    ${remainingBalance.toLocaleString('es-MX')}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Saldo</div>
                            </div>
                        </div>
                    </div>

                    {/* Passengers */}
                    <div className="card">
                        <h2 className="section-title">Pasajeros ({passengers.length})</h2>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            {passengers.map((passenger, index) => (
                                <div
                                    key={passenger.id}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.625rem 0.75rem',
                                        background: '#f8f9fa',
                                        borderRadius: '4px',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    <div>
                                        <strong>{index + 1}.</strong> {passenger.first_name} {passenger.last_name}
                                        {passenger.congregation && (
                                            <span style={{ color: 'var(--text-muted)' }}> — {passenger.congregation}</span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {passenger.age !== null && (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{passenger.age} años</span>
                                        )}
                                        {passenger.is_free_under6 && (
                                            <span style={{
                                                background: '#e8f5e9',
                                                color: '#2e7d32',
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '3px',
                                                fontSize: '0.7rem',
                                                fontWeight: '600'
                                            }}>
                                                Gratis
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Payments */}
                    <div className="card">
                        <h2 className="section-title">Pagos registrados</h2>

                        {payments.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                                Sin pagos registrados
                            </p>
                        ) : (
                            <div style={{ marginBottom: '1.5rem' }}>
                                {payments.map((payment) => (
                                    <div
                                        key={payment.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '0.625rem 0',
                                            borderBottom: '1px solid var(--border-color)'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: '600', color: '#2e7d32' }}>
                                                +${payment.amount.toLocaleString('es-MX')}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {new Date(payment.paid_at).toLocaleDateString('es-MX', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                                {payment.reference && ` — Ref: ${payment.reference}`}
                                            </div>
                                        </div>
                                        {payment.note && (
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {payment.note}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <form onSubmit={handleAddPayment} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                            <h3 style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '0.95rem' }}>Registrar pago</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                                <div>
                                    <label className="form-label">Monto *</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        placeholder="0.00"
                                        step="0.01"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Referencia</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={paymentReference}
                                        onChange={(e) => setPaymentReference(e.target.value)}
                                        placeholder="Núm. operación"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Nota</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={paymentNote}
                                        onChange={(e) => setPaymentNote(e.target.value)}
                                        placeholder="Ej: Anticipo"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="nav-button"
                                style={{ marginTop: '0.75rem' }}
                                disabled={isSubmitting || !paymentAmount}
                            >
                                {isSubmitting ? 'Registrando...' : 'Registrar pago'}
                            </button>
                        </form>
                    </div>

                    {/* Actions */}
                    <div className="card">
                        <h2 className="section-title">Acciones</h2>

                        <div style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Cambiar estatus</label>
                            <select
                                className="form-input"
                                value={reservation.status}
                                onChange={(e) => handleStatusChange(e.target.value)}
                                style={{ maxWidth: '250px' }}
                            >
                                <option value="pendiente">Pendiente</option>
                                <option value="anticipo_pagado">Anticipo pagado</option>
                                <option value="pagado_completo">Pagado completo</option>
                                <option value="cancelado">Cancelado</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <a
                                href={getWhatsAppLink(buildWhatsAppMessage(
                                    reservation.reservation_code,
                                    reservation.responsible_name,
                                    reservation.responsible_phone,
                                    reservation.responsible_congregation || undefined,
                                    passengers.map(p => ({
                                        first_name: p.first_name,
                                        last_name: p.last_name,
                                        congregation: p.congregation || undefined,
                                        age: p.age || undefined,
                                    })),
                                    reservation.seats_payable,
                                    reservation.total_amount,
                                    reservation.deposit_required
                                ))}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="whatsapp-button"
                                style={{ flex: 'none', width: 'auto', padding: '0.625rem 1rem' }}
                            >
                                Enviar por WhatsApp
                            </a>
                            <button
                                className="nav-button secondary"
                                onClick={() => {
                                    const msg = buildWhatsAppMessage(
                                        reservation.reservation_code,
                                        reservation.responsible_name,
                                        reservation.responsible_phone,
                                        reservation.responsible_congregation || undefined,
                                        passengers.map(p => ({
                                            first_name: p.first_name,
                                            last_name: p.last_name,
                                            congregation: p.congregation || undefined,
                                            age: p.age || undefined,
                                        })),
                                        reservation.seats_payable,
                                        reservation.total_amount,
                                        reservation.deposit_required
                                    )
                                    navigator.clipboard.writeText(msg)
                                    alert('Mensaje copiado')
                                }}
                            >
                                Copiar mensaje
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
