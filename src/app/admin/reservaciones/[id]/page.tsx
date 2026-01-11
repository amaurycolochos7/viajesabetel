'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Reservation, ReservationPassenger, Payment } from '@/types'

export default function ReservacionDetailPage() {
    const router = useRouter()
    const params = useParams()
    const [reservation, setReservation] = useState<Reservation | null>(null)
    const [passengers, setPassengers] = useState<ReservationPassenger[]>([])
    const [payments, setPayments] = useState<Payment[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('transferencia')
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
                    method: paymentMethod,
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

    const handleSeatChange = async (passengerId: string, newSeat: string) => {
        try {
            const { error } = await supabase
                .from('reservation_passengers')
                .update({ seat_number: newSeat })
                .eq('id', passengerId)

            if (error) throw error

            setPassengers(prev => prev.map(p =>
                p.id === passengerId ? { ...p, seat_number: newSeat } : p
            ))
        } catch (err) {
            console.error(err)
            alert('Error al asignar el asiento')
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

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            pendiente: '#f39c12',
            anticipo_pagado: '#3498db',
            pagado_completo: '#27ae60',
            cancelado: '#e74c3c',
        }
        return colors[status] || '#666'
    }

    const getMethodLabel = (method: string) => {
        const labels: Record<string, string> = {
            transferencia: 'Transferencia',
            mercadopago: 'Mercado Pago',
            efectivo: 'Efectivo',
            deposito: 'Depósito',
        }
        return labels[method] || method
    }

    const buildConfirmationMessage = (type: 'anticipo' | 'completo') => {
        if (!reservation) return ''

        const amountPaid = reservation.amount_paid + (paymentAmount ? parseFloat(paymentAmount) : 0)
        const remaining = reservation.total_amount - amountPaid

        if (type === 'anticipo') {
            return `Hola ${reservation.responsible_name},

Tu anticipo ha sido registrado exitosamente.

— Código de reservación: ${reservation.reservation_code}
— Monto recibido: $${amountPaid.toLocaleString('es-MX')}
— Saldo pendiente: $${remaining.toLocaleString('es-MX')}

Tu lugar está confirmado para el viaje a Betel del 7-9 de abril de 2026.

Recuerda completar el pago antes de la fecha límite.

¡Gracias!`
        }

        return `Hola ${reservation.responsible_name},

Tu pago ha sido completado exitosamente.

— Código de reservación: ${reservation.reservation_code}
— Total pagado: $${reservation.total_amount.toLocaleString('es-MX')}
— Lugares confirmados: ${reservation.seats_total}

Tu reservación está 100% confirmada para el viaje a Betel del 7-9 de abril de 2026.

¡Nos vemos pronto!`
    }

    const getWhatsAppConfirmationLink = (type: 'anticipo' | 'completo') => {
        if (!reservation) return '#'
        const message = buildConfirmationMessage(type)
        const phone = reservation.responsible_phone.replace(/\D/g, '')
        const fullPhone = phone.startsWith('52') ? phone : `52${phone}`
        return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`
    }

    if (isLoading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f5f6fa'
            }}>
                <p>Cargando...</p>
            </div>
        )
    }

    if (!reservation) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', background: '#f5f6fa', minHeight: '100vh' }}>
                <p>Reservación no encontrada</p>
                <Link href="/admin/reservaciones" className="nav-button" style={{ marginTop: '1rem', display: 'inline-block', textDecoration: 'none' }}>
                    Volver
                </Link>
            </div>
        )
    }

    const remainingBalance = reservation.total_amount - reservation.amount_paid
    const progressPercent = Math.min(100, (reservation.amount_paid / reservation.total_amount) * 100)

    return (
        <div style={{ minHeight: '100vh', background: '#f5f6fa' }}>
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
                    <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        background: getStatusColor(reservation.status) + '40',
                        color: 'white'
                    }}>
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

            <main style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    {/* Payment Progress */}
                    <div className="card" style={{ background: 'white', padding: '1.5rem', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h2 style={{ fontWeight: '600', margin: 0 }}>Progreso de pago</h2>
                            <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '1.25rem' }}>
                                {Math.round(progressPercent)}%
                            </span>
                        </div>
                        <div style={{
                            height: '12px',
                            background: '#e0e0e0',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            marginBottom: '1rem'
                        }}>
                            <div style={{
                                width: `${progressPercent}%`,
                                height: '100%',
                                background: progressPercent >= 100 ? '#27ae60' : progressPercent >= 50 ? '#3498db' : '#f39c12',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#27ae60' }}>
                                    ${reservation.amount_paid.toLocaleString('es-MX')}
                                </div>
                                <div style={{ color: '#666', fontSize: '0.85rem' }}>Pagado</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: remainingBalance > 0 ? '#e74c3c' : '#27ae60' }}>
                                    ${remainingBalance.toLocaleString('es-MX')}
                                </div>
                                <div style={{ color: '#666', fontSize: '0.85rem' }}>Saldo</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
                                    ${reservation.total_amount.toLocaleString('es-MX')}
                                </div>
                                <div style={{ color: '#666', fontSize: '0.85rem' }}>Total</div>
                            </div>
                        </div>
                    </div>

                    {/* Reservation Info */}
                    <div className="card" style={{ background: 'white', padding: '1.5rem', borderRadius: '8px' }}>
                        <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Información del responsable</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            <div>
                                <div style={{ color: '#666', fontSize: '0.85rem' }}>Nombre</div>
                                <div style={{ fontWeight: '500', fontSize: '1.1rem' }}>{reservation.responsible_name}</div>
                            </div>
                            <div>
                                <div style={{ color: '#666', fontSize: '0.85rem' }}>Teléfono</div>
                                <div style={{ fontWeight: '500', fontSize: '1.1rem' }}>{reservation.responsible_phone}</div>
                            </div>
                            <div>
                                <div style={{ color: '#666', fontSize: '0.85rem' }}>Congregación</div>
                                <div style={{ fontWeight: '500', fontSize: '1.1rem' }}>{reservation.responsible_congregation || '—'}</div>
                            </div>
                            <div>
                                <div style={{ color: '#666', fontSize: '0.85rem' }}>Lugares</div>
                                <div style={{ fontWeight: '500', fontSize: '1.1rem' }}>
                                    {reservation.seats_payable} pagan / {reservation.seats_total} total
                                </div>
                            </div>
                            <div>
                                <div style={{ color: '#666', fontSize: '0.85rem' }}>Código de abordaje</div>
                                <div style={{ fontWeight: '700', fontSize: '1.25rem', color: '#e67e22', fontFamily: 'monospace' }}>
                                    {reservation.boarding_access_code || '—'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Passengers */}
                    <div className="card" style={{ background: 'white', padding: '1.5rem', borderRadius: '8px' }}>
                        <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Pasajeros ({passengers.length})</h2>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            {passengers.map((passenger, index) => (
                                <div
                                    key={passenger.id}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.75rem',
                                        background: '#f8f9fa',
                                        borderRadius: '4px'
                                    }}
                                >
                                    <div>
                                        <strong>{index + 1}.</strong> {passenger.first_name} {passenger.last_name}
                                        {passenger.congregation && (
                                            <span style={{ color: '#666' }}> — {passenger.congregation}</span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {passenger.age !== null && passenger.age !== undefined && (
                                                <span style={{ fontSize: '0.85rem', color: '#666' }}>{passenger.age} años</span>
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

                                        {/* Seat Assignment - Only if deposit paid */}
                                        {['anticipo_pagado', 'pagado_completo'].includes(reservation.status) && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid #ddd', paddingLeft: '1rem' }}>
                                                <span style={{ fontSize: '0.8rem', color: '#666' }}>Asiento:</span>
                                                <input
                                                    type="text"
                                                    value={passenger.seat_number || ''}
                                                    onChange={(e) => handleSeatChange(passenger.id, e.target.value)}
                                                    placeholder="#"
                                                    style={{
                                                        width: '50px',
                                                        padding: '0.25rem',
                                                        border: '1px solid #ccc',
                                                        borderRadius: '4px',
                                                        textAlign: 'center',
                                                        fontWeight: 'bold'
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Payments History */}
                    <div className="card" style={{ background: 'white', padding: '1.5rem', borderRadius: '8px' }}>
                        <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Historial de pagos</h2>

                        {payments.length === 0 ? (
                            <p style={{ color: '#666', textAlign: 'center', padding: '1rem' }}>
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
                                            padding: '0.75rem',
                                            borderBottom: '1px solid #e0e0e0'
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <span style={{ fontWeight: '600', color: '#27ae60', fontSize: '1.1rem' }}>
                                                    +${payment.amount.toLocaleString('es-MX')}
                                                </span>
                                                <span style={{
                                                    background: payment.method === 'mercadopago' ? '#009ee3' : '#666',
                                                    color: 'white',
                                                    padding: '0.15rem 0.5rem',
                                                    borderRadius: '3px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: '600'
                                                }}>
                                                    {getMethodLabel(payment.method || 'transferencia')}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                                                {new Date(payment.paid_at).toLocaleDateString('es-MX', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                                {payment.reference && ` — Ref: ${payment.reference}`}
                                            </div>
                                        </div>
                                        {payment.note && (
                                            <div style={{ fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
                                                {payment.note}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />

                        <form onSubmit={handleAddPayment}>
                            <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Registrar nuevo pago</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
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
                                    <label className="form-label">Método *</label>
                                    <select
                                        className="form-input"
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                    >
                                        <option value="transferencia">Transferencia</option>
                                        <option value="mercadopago">Mercado Pago</option>
                                        <option value="deposito">Depósito</option>
                                        <option value="efectivo">Efectivo</option>
                                    </select>
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
                                style={{ marginTop: '1rem' }}
                                disabled={isSubmitting || !paymentAmount}
                            >
                                {isSubmitting ? 'Registrando...' : 'Registrar pago'}
                            </button>
                        </form>
                    </div>

                    {/* Send Confirmation Messages */}
                    <div className="card" style={{ background: 'white', padding: '1.5rem', borderRadius: '8px' }}>
                        <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Enviar confirmación por WhatsApp</h2>
                        <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
                            Envía un mensaje al cliente confirmando su pago registrado.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <a
                                href={getWhatsAppConfirmationLink('anticipo')}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1.25rem',
                                    background: '#25D366',
                                    color: 'white',
                                    borderRadius: '4px',
                                    textDecoration: 'none',
                                    fontWeight: '500'
                                }}
                            >
                                Confirmar anticipo
                            </a>
                            <a
                                href={getWhatsAppConfirmationLink('completo')}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1.25rem',
                                    background: '#128C7E',
                                    color: 'white',
                                    borderRadius: '4px',
                                    textDecoration: 'none',
                                    fontWeight: '500'
                                }}
                            >
                                Confirmar pago completo
                            </a>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="card" style={{ background: 'white', padding: '1.5rem', borderRadius: '8px' }}>
                        <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Acciones</h2>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label className="form-label">Cambiar estatus manualmente</label>
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

                        <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />

                        <div>
                            <h3 style={{ fontWeight: '600', marginBottom: '0.75rem', color: '#e74c3c' }}>Zona de peligro</h3>
                            <button
                                onClick={async () => {
                                    if (!confirm(`¿Estás seguro de eliminar la reservación ${reservation.reservation_code}? Esta acción no se puede deshacer.`)) return

                                    try {
                                        const { error } = await supabase
                                            .from('reservations')
                                            .delete()
                                            .eq('id', reservation.id)

                                        if (error) throw error

                                        alert('Reservación eliminada')
                                        router.push('/admin/reservaciones')
                                    } catch (err) {
                                        console.error(err)
                                        alert('Error al eliminar la reservación')
                                    }
                                }}
                                style={{
                                    padding: '0.75rem 1.25rem',
                                    background: '#e74c3c',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: '500'
                                }}
                            >
                                Eliminar reservación
                            </button>
                        </div>
                    </div>
                </div>
            </main >
        </div >
    )
}
