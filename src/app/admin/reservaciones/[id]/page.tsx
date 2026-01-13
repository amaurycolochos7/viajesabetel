'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Reservation, ReservationPassenger, Payment } from '@/types'

interface TicketOrder {
    id: string
    items: any[]
    total_amount: number
    status: string
    payment_method: string
    created_at: string
}

export default function ReservacionDetailPage() {
    const router = useRouter()
    const params = useParams()
    const [reservation, setReservation] = useState<Reservation | null>(null)
    const [passengers, setPassengers] = useState<ReservationPassenger[]>([])
    const [payments, setPayments] = useState<Payment[]>([])
    const [ticketOrders, setTicketOrders] = useState<TicketOrder[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('transferencia')
    const [paymentReference, setPaymentReference] = useState('')
    const [paymentNote, setPaymentNote] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Seat assignment modal
    const [showSeatModal, setShowSeatModal] = useState(false)
    const [selectedPassengerId, setSelectedPassengerId] = useState<string | null>(null)
    const [occupiedSeats, setOccupiedSeats] = useState<Map<string, string>>(new Map())

    useEffect(() => {
        checkAuthAndLoadData()
    }, [params.id])

    const checkAuthAndLoadData = async () => {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            router.push('/admin/login')
            return
        }

        // ✅ SEGURIDAD: Verificar que el usuario es admin registrado
        const { data: adminUser, error: adminError } = await supabase
            .from('admin_users')
            .select('email')
            .eq('email', session.user.email)
            .single()

        if (adminError || !adminUser) {
            console.error('Usuario no es administrador:', session.user.email)
            await supabase.auth.signOut()
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

        const { data: ticketsData } = await supabase
            .from('ticket_orders')
            .select('*')
            .eq('reservation_id', params.id)
            .order('created_at', { ascending: false })

        if (ticketsData) {
            setTicketOrders(ticketsData)
        }

        // Load all occupied seats globally
        const { data: allSeats } = await supabase
            .from('reservation_passengers')
            .select('seat_number, first_name, last_name')

        const seatMap = new Map<string, string>()
        allSeats?.forEach(p => {
            if (p.seat_number && p.seat_number.trim() !== '') {
                seatMap.set(p.seat_number.trim(), `${p.first_name} ${p.last_name}`)
            }
        })
        setOccupiedSeats(seatMap)

        setIsLoading(false)
    }

    const openSeatModal = (passengerId: string) => {
        setSelectedPassengerId(passengerId)
        setShowSeatModal(true)
    }

    const assignSeat = async (seatNumber: number) => {
        if (!selectedPassengerId) return

        const seatStr = seatNumber.toString()

        // Check if seat is already taken by someone else
        const currentPassenger = passengers.find(p => p.id === selectedPassengerId)
        if (occupiedSeats.has(seatStr) && currentPassenger?.seat_number !== seatStr) {
            alert(`El asiento ${seatNumber} ya está ocupado por ${occupiedSeats.get(seatStr)}`)
            return
        }

        try {
            const { error } = await supabase
                .from('reservation_passengers')
                .update({ seat_number: seatStr })
                .eq('id', selectedPassengerId)

            if (error) throw error

            // Update local state
            setPassengers(prev => prev.map(p =>
                p.id === selectedPassengerId ? { ...p, seat_number: seatStr } : p
            ))

            // Update occupied seats map
            const newMap = new Map(occupiedSeats)
            // Remove old seat if any
            if (currentPassenger?.seat_number) {
                newMap.delete(currentPassenger.seat_number)
            }
            newMap.set(seatStr, `${currentPassenger?.first_name} ${currentPassenger?.last_name}`)
            setOccupiedSeats(newMap)

            setShowSeatModal(false)
            setSelectedPassengerId(null)
        } catch (err) {
            console.error(err)
            alert('Error al asignar asiento')
        }
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

    const handleApproveTicketOrder = async (orderId: string) => {
        try {
            const { error } = await supabase
                .from('ticket_orders')
                .update({ status: 'paid' })
                .eq('id', orderId)

            if (error) throw error

            setTicketOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'paid' } : o))
            alert('Pago de entradas aprobado')
        } catch (err) {
            console.error(err)
            alert('Error al aprobar pago de entradas')
        }
    }

    const toggleHostStatus = async () => {
        if (!reservation) return

        const newStatus = !reservation.is_host
        try {
            const { error } = await supabase
                .from('reservations')
                .update({ is_host: newStatus })
                .eq('id', reservation.id)

            if (error) throw error

            setReservation({ ...reservation, is_host: newStatus })
        } catch (err) {
            console.error(err)
            alert('Error al actualizar estatus de anfitrión')
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
        <div style={{ minHeight: '100vh', background: '#f8f9fa', paddingBottom: '2rem' }}>
            {/* Header */}
            <header style={{
                background: 'white',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                padding: '1rem',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}>
                <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Link href="/admin/reservaciones" style={{ color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </Link>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <h1 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: '#1e293b' }}>
                                {reservation.reservation_code}
                            </h1>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                Detalle de Reservación
                            </span>
                        </div>
                    </div>
                    <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        background: getStatusColor(reservation.status) + '20', // Low opacity background
                        color: getStatusColor(reservation.status),
                        border: `1px solid ${getStatusColor(reservation.status)}40`,
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase'
                    }}>
                        {getStatusLabel(reservation.status)}
                    </span>
                </div>
                {/* Host Toggle Banner */}
                <div style={{ maxWidth: '900px', margin: '0.5rem auto 0', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={toggleHostStatus}
                        style={{
                            background: reservation.is_host ? '#0ea5e9' : 'transparent',
                            color: reservation.is_host ? 'white' : '#64748b',
                            border: reservation.is_host ? 'none' : '1px solid #cbd5e1',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        {reservation.is_host ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                Es Anfitrión (No suma ingresos)
                            </>
                        ) : (
                            <>
                                <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #cbd5e1' }}></div>
                                Marcar como Anfitrión
                            </>
                        )}
                    </button>
                </div>
            </header>

            <main style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem' }}>
                <div style={{ display: 'grid', gap: '1.5rem' }}>

                    {/* Payment Progress */}
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ fontWeight: '700', margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>Progreso de Pago</h2>
                            <span style={{ fontWeight: '800', color: '#1e293b', fontSize: '1.5rem' }}>
                                {Math.round(progressPercent)}%
                            </span>
                        </div>
                        <div style={{
                            height: '14px',
                            background: '#f1f5f9',
                            borderRadius: '7px',
                            overflow: 'hidden',
                            marginBottom: '1.5rem',
                            border: '1px solid #e2e8f0'
                        }}>
                            <div style={{
                                width: `${progressPercent}%`,
                                height: '100%',
                                background: progressPercent >= 100 ? '#10b981' : progressPercent >= 50 ? '#3b82f6' : '#f59e0b',
                                transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                borderRadius: '7px'
                            }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
                            <div style={{ padding: '0.5rem', borderRadius: '8px', background: '#f8fafc' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#10b981' }}>
                                    {reservation.is_host ? 'Anfitrión' : `$${reservation.amount_paid.toLocaleString('es-MX')}`}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Pagado</div>
                            </div>
                            <div style={{ padding: '0.5rem', borderRadius: '8px', background: '#f8fafc' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: remainingBalance > 0 ? '#ef4444' : '#10b981' }}>
                                    {reservation.is_host ? '-' : `$${remainingBalance.toLocaleString('es-MX')}`}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Pendiente</div>
                            </div>
                            <div style={{ padding: '0.5rem', borderRadius: '8px', background: '#f8fafc' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1e293b' }}>
                                    {reservation.is_host ? 'Anfitrión' : `$${reservation.total_amount.toLocaleString('es-MX')}`}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Total</div>
                            </div>
                        </div>
                    </div>

                    {/* Reservation Info */}
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <h2 style={{ fontWeight: '700', margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>Información del Responsable</h2>
                            <Link
                                href={`/admin/reservaciones/${params.id}/editar`}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.5rem 1rem',
                                    background: '#2c3e50',
                                    color: 'white',
                                    borderRadius: '8px',
                                    textDecoration: 'none',
                                    fontSize: '0.85rem',
                                    fontWeight: '600'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                Editar Datos
                            </Link>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                            <div>
                                <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Nombre</div>
                                <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#334155' }}>
                                    {reservation.responsible_name}
                                </div>
                            </div>
                            <div>
                                <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Teléfono</div>
                                <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#334155', fontFamily: 'monospace' }}>
                                    {reservation.responsible_phone}
                                </div>
                            </div>
                            <div>
                                <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Congregación</div>
                                <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#334155' }}>
                                    {reservation.responsible_congregation || '—'}
                                </div>
                            </div>
                            <div>
                                <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Lugares</div>
                                <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#334155' }}>
                                    {reservation.seats_payable} pagan / {reservation.seats_total} total
                                </div>
                            </div>
                            <div>
                                <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Código de Abordaje</div>
                                <div style={{ fontWeight: '800', fontSize: '1.4rem', color: '#f59e0b', fontFamily: 'monospace', letterSpacing: '1px' }}>
                                    {reservation.boarding_access_code || '—'}
                                </div>
                            </div>
                            <div>
                                <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Método de Pago Elegido</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {reservation.payment_method ? (
                                        <span style={{
                                            padding: '0.35rem 0.75rem',
                                            borderRadius: '8px',
                                            fontWeight: '700',
                                            fontSize: '0.9rem',
                                            background: reservation.payment_method === 'card' ? '#e0f2fe' : '#fef3c7',
                                            color: reservation.payment_method === 'card' ? '#0369a1' : '#b45309',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.4rem'
                                        }}>
                                            {reservation.payment_method === 'card' ? '💳 MercadoPago' : '🏦 Transferencia'}
                                        </span>
                                    ) : (
                                        <span style={{ fontWeight: '600', fontSize: '1.1rem', color: '#94a3b8' }}>Sin elegir</span>
                                    )}
                                    {reservation.payment_method === 'card' && reservation.mp_payment_status && (
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '6px',
                                            fontWeight: '700',
                                            fontSize: '0.7rem',
                                            textTransform: 'uppercase',
                                            background: reservation.mp_payment_status === 'approved' ? '#dcfce7' : reservation.mp_payment_status === 'rejected' ? '#fee2e2' : '#fff7ed',
                                            color: reservation.mp_payment_status === 'approved' ? '#166534' : reservation.mp_payment_status === 'rejected' ? '#b91c1c' : '#c2410c'
                                        }}>
                                            {reservation.mp_payment_status === 'approved' ? 'Pagado' : reservation.mp_payment_status === 'rejected' ? 'Rechazado' : 'Pendiente MP'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Passengers */}
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2 style={{ fontWeight: '700', margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>Pasajeros ({passengers.length})</h2>
                        </div>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            {passengers.map((passenger, index) => (
                                <div
                                    key={passenger.id}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.75rem',
                                        padding: '1rem',
                                        background: '#f8fafc',
                                        borderRadius: '12px',
                                        border: '1px solid #f1f5f9'
                                    }}
                                >
                                    {/* Passenger Info - Top Section */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <div style={{ flex: '1', minWidth: '150px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: '600', color: '#94a3b8', fontSize: '0.9rem' }}>{index + 1}.</span>
                                                <strong style={{ color: '#334155', fontSize: '1rem' }}>{passenger.first_name} {passenger.last_name}</strong>
                                            </div>
                                            {passenger.congregation && (
                                                <div style={{ color: '#64748b', fontSize: '0.85rem', paddingLeft: '1.4rem' }}>{passenger.congregation}</div>
                                            )}
                                        </div>

                                        {/* Age & Status Badges - Right side on desktop, stacked on mobile */}
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                            {passenger.age !== null && passenger.age !== undefined && (
                                                <span style={{ fontSize: '0.8rem', color: '#475569', background: '#e0e7ff', padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                                    {passenger.age} años
                                                </span>
                                            )}
                                            {passenger.is_free_under6 && (
                                                <span style={{ fontSize: '0.75rem', color: '#166534', background: '#dcfce7', padding: '0.25rem 0.5rem', borderRadius: '6px', fontWeight: '600' }}>
                                                    Gratis
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Seat Assignment - Only for passengers who pay (not free under 6) */}
                                    {['anticipo_pagado', 'pagado_completo'].includes(reservation.status) && !passenger.is_free_under6 && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '0.75rem',
                                            padding: '0.75rem',
                                            background: '#ffffff',
                                            borderRadius: '8px',
                                            border: passenger.seat_number ? '2px solid #16a34a' : '1px solid #e2e8f0'
                                        }}>
                                            {passenger.seat_number ? (
                                                <>
                                                    <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: '700' }}>
                                                        Asiento #{passenger.seat_number}
                                                    </span>
                                                    <button
                                                        onClick={() => openSeatModal(passenger.id)}
                                                        style={{
                                                            padding: '0.5rem 0.75rem',
                                                            background: '#f1f5f9',
                                                            color: '#475569',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: '600',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Cambiar
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => openSeatModal(passenger.id)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.6rem',
                                                        background: '#3b82f6',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '700',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Asignar Asiento
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Ticket Orders Section */}
                    {ticketOrders.length > 0 && (
                        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)' }}>
                            <h2 style={{ fontWeight: '700', marginBottom: '1.25rem', fontSize: '1.1rem', color: '#1e293b' }}>Entradas a Centros Turísticos</h2>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {ticketOrders.map(order => (
                                    <div key={order.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', background: '#f8fafc' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                            <div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#334155' }}>
                                                    Orden del {new Date(order.created_at).toLocaleDateString('es-MX')}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                    {order.payment_method === 'card' ? 'Mercado Pago' : 'Transferencia'}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#10b981' }}>
                                                    ${order.total_amount.toLocaleString('es-MX')}
                                                </div>
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: '700',
                                                    textTransform: 'uppercase',
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '4px',
                                                    background: order.status === 'paid' ? '#dcfce7' : '#fef3c7',
                                                    color: order.status === 'paid' ? '#166534' : '#d97706'
                                                }}>
                                                    {order.status === 'paid' ? 'PAGADO' : 'PENDIENTE'}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ background: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px dashed #cbd5e1', marginBottom: '1rem' }}>
                                            {order.items.map((item: any, idx: number) => (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                                    <span style={{ color: '#455a64' }}>
                                                        <strong style={{ color: '#1e293b' }}>{item.passengerName}</strong> — {item.name} ({item.variantName})
                                                    </span>
                                                    <span style={{ fontWeight: '600' }}>${item.price}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {order.status !== 'paid' && (
                                            <button
                                                onClick={() => handleApproveTicketOrder(order.id)}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.5rem',
                                                    background: order.payment_method === 'transfer' ? '#3b82f6' : '#10b981',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    fontSize: '0.9rem'
                                                }}
                                            >
                                                {order.payment_method === 'transfer'
                                                    ? 'Aprobar Pago (Transferencia)'
                                                    : 'Marcar como Pagado'}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Payments History & Form */}
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)' }}>
                        <h2 style={{ fontWeight: '700', marginBottom: '1.25rem', fontSize: '1.1rem', color: '#1e293b' }}>Historial de Pagos</h2>

                        {payments.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', color: '#94a3b8', border: '1px dashed #e2e8f0', marginBottom: '2rem' }}>
                                Sin pagos registrados
                            </div>
                        ) : (
                            <div style={{ marginBottom: '2rem', display: 'grid', gap: '0.75rem' }}>
                                {payments.map((payment) => (
                                    <div
                                        key={payment.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '1rem',
                                            background: '#f8fafc',
                                            borderRadius: '12px',
                                            border: '1px solid #f1f5f9'
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                                                <span style={{ fontWeight: '800', color: '#10b981', fontSize: '1.1rem' }}>
                                                    +${payment.amount.toLocaleString('es-MX')}
                                                </span>
                                                <span style={{
                                                    background: payment.method === 'mercadopago' ? '#009ee3' : '#475569',
                                                    color: 'white',
                                                    padding: '0.1rem 0.5rem',
                                                    borderRadius: '20px',
                                                    fontSize: '0.65rem',
                                                    fontWeight: '700',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {getMethodLabel(payment.method || 'transferencia')}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                {new Date(payment.paid_at).toLocaleDateString('es-MX', {
                                                    day: 'numeric', month: 'short', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                                {payment.reference && ` • Ref: ${payment.reference}`}
                                            </div>
                                        </div>
                                        {payment.note && (
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', background: 'rgba(0,0,0,0.03)', padding: '0.25rem 0.5rem', borderRadius: '4px', maxWidth: '150px', textAlign: 'right' }}>
                                                {payment.note}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <form onSubmit={handleAddPayment} style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontWeight: '700', marginBottom: '1rem', fontSize: '1rem', color: '#334155' }}>Registrar Nuevo Pago</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.4rem', display: 'block' }}>MONTO *</label>
                                    <input
                                        type="number"
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        placeholder="0.00"
                                        step="0.01"
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.4rem', display: 'block' }}>MÉTODO *</label>
                                    <select
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem', background: 'white' }}
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
                                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.4rem', display: 'block' }}>REFERENCIA</label>
                                    <input
                                        type="text"
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                                        value={paymentReference}
                                        onChange={(e) => setPaymentReference(e.target.value)}
                                        placeholder="Núm. operación"
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.4rem', display: 'block' }}>NOTA</label>
                                    <input
                                        type="text"
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                                        value={paymentNote}
                                        onChange={(e) => setPaymentNote(e.target.value)}
                                        placeholder="Ej: Anticipo"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                style={{
                                    marginTop: '1.25rem',
                                    width: '100%',
                                    padding: '0.85rem',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '700',
                                    cursor: isSubmitting || !paymentAmount ? 'not-allowed' : 'pointer',
                                    opacity: isSubmitting || !paymentAmount ? 0.7 : 1
                                }}
                                disabled={isSubmitting || !paymentAmount}
                            >
                                {isSubmitting ? 'Registrando...' : 'Registrar Pago'}
                            </button>
                        </form>
                    </div>

                    {/* Send Confirmation Messages */}
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)' }}>
                        <h2 style={{ fontWeight: '700', marginBottom: '1.25rem', fontSize: '1.1rem', color: '#1e293b' }}>Confirmaciones WhatsApp</h2>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                            <a
                                href={getWhatsAppConfirmationLink('anticipo')}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.75rem',
                                    padding: '1rem',
                                    background: '#dcfce7',
                                    color: '#15803d',
                                    borderRadius: '8px',
                                    textDecoration: 'none',
                                    fontWeight: '700',
                                    border: '1px solid #bbf7d0',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                Confirmar Anticipo
                            </a>
                            <a
                                href={getWhatsAppConfirmationLink('completo')}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.75rem',
                                    padding: '1rem',
                                    background: '#d1fae5',
                                    color: '#047857',
                                    borderRadius: '8px',
                                    textDecoration: 'none',
                                    fontWeight: '700',
                                    border: '1px solid #a7f3d0',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                Confirmar Pago Completo
                            </a>
                            {/* Botón recordatorio - Adelanto 50% */}
                            <a
                                href={(() => {
                                    const phone = reservation.responsible_phone.replace(/\D/g, '')
                                    const fullPhone = phone.startsWith('52') ? phone : `52${phone}`
                                    const depositAmount = reservation.deposit_required
                                    const message = `Hola ${reservation.responsible_name},

Te escribimos para recordarte sobre tu reservación *${reservation.reservation_code}* para el viaje a Betel.

📅 *FECHA LÍMITE ADELANTO: 25 DE ENERO 2026*

Para asegurar tu lugar, necesitas realizar el pago del *50% de adelanto* ($${depositAmount.toLocaleString('es-MX')}) antes de esta fecha.

💳 Puedes pagar por:
• Transferencia bancaria (sin comisión)
• Mercado Pago con tarjeta (+5% comisión)

¿Tienes alguna duda o necesitas ayuda para completar tu pago?

¡Gracias!`
                                    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`
                                })()}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '0.85rem 1rem',
                                    background: '#fff7ed',
                                    color: '#c2410c',
                                    borderRadius: '8px',
                                    textDecoration: 'none',
                                    fontWeight: '700',
                                    border: '1px solid #fed7aa',
                                    transition: 'background 0.2s',
                                    fontSize: '0.85rem'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                Recordar Adelanto 50%
                            </a>

                            {/* Botón recordatorio - Liquidar viaje */}
                            <a
                                href={(() => {
                                    const phone = reservation.responsible_phone.replace(/\D/g, '')
                                    const fullPhone = phone.startsWith('52') ? phone : `52${phone}`
                                    const message = `Hola ${reservation.responsible_name},

Te escribimos para recordarte sobre tu reservación *${reservation.reservation_code}* para el viaje a Betel.

📅 *FECHA LÍMITE PARA LIQUIDAR: 23 DE MARZO 2026*

Tu saldo pendiente es de *$${remainingBalance.toLocaleString('es-MX')}*.

Para no perder tu lugar, es importante liquidar el viaje completo antes de esta fecha.

💳 Puedes pagar por:
• Transferencia bancaria (sin comisión)
• Mercado Pago con tarjeta (+5% comisión)

¿Necesitas ayuda para completar tu pago?

¡Gracias!`
                                    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`
                                })()}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '0.85rem 1rem',
                                    background: '#fef3c7',
                                    color: '#b45309',
                                    borderRadius: '8px',
                                    textDecoration: 'none',
                                    fontWeight: '700',
                                    border: '1px solid #fcd34d',
                                    transition: 'background 0.2s',
                                    fontSize: '0.85rem'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                Recordar Liquidar Viaje
                            </a>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)' }}>
                        <h2 style={{ fontWeight: '700', marginBottom: '1.25rem', fontSize: '1.1rem', color: '#1e293b' }}>Administración Avanzada</h2>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', display: 'block' }}>FORZAR CAMBIO DE ESTATUS</label>
                            <select
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', background: 'white' }}
                                value={reservation.status}
                                onChange={(e) => handleStatusChange(e.target.value)}
                            >
                                <option value="pendiente">Pendiente</option>
                                <option value="anticipo_pagado">Anticipo pagado</option>
                                <option value="pagado_completo">Pagado completo</option>
                                <option value="cancelado">Cancelado</option>
                            </select>
                        </div>

                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                            <h3 style={{ fontWeight: '700', marginBottom: '1rem', color: '#ef4444', fontSize: '1rem' }}>Zona de Peligro</h3>
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
                                    width: '100%',
                                    padding: '0.85rem',
                                    background: '#fee2e2',
                                    color: '#b91c1c',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                Eliminar Reservación Permanentemente
                            </button>
                        </div>
                    </div>
                </div>
            </main >

            {/* Seat Selection Modal */}
            {showSeatModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.85)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        zIndex: 100
                    }}
                    onClick={() => { setShowSeatModal(false); setSelectedPassengerId(null) }}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '20px 20px 0 0',
                            padding: '1.5rem',
                            width: '100%',
                            maxWidth: '380px',
                            maxHeight: '85vh',
                            overflowY: 'auto'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Selecciona asiento para</div>
                                <div style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b' }}>
                                    {passengers.find(p => p.id === selectedPassengerId)?.first_name} {passengers.find(p => p.id === selectedPassengerId)?.last_name}
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowSeatModal(false); setSelectedPassengerId(null) }}
                                style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
                            >x</button>
                        </div>

                        {/* Legend */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#64748b' }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#dcfce7', border: '2px solid #16a34a' }}></div>
                                Libre
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#64748b' }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#ef4444', border: '2px solid #991b1b' }}></div>
                                Ocupado
                            </div>
                        </div>

                        {/* Seats Grid */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {Array.from({ length: 12 }, (_, rowIdx) => {
                                const baseNum = rowIdx * 4 + 1
                                const leftSeats = [baseNum, baseNum + 1].filter(n => n <= 47)
                                const rightSeats = [baseNum + 2, baseNum + 3].filter(n => n <= 47)

                                return (
                                    <div key={rowIdx} style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                                            {leftSeats.map(num => {
                                                const seatStr = num.toString()
                                                const currentPassenger = passengers.find(p => p.id === selectedPassengerId)
                                                const isOwnSeat = currentPassenger?.seat_number === seatStr
                                                const isOccupied = occupiedSeats.has(seatStr) && !isOwnSeat

                                                return (
                                                    <button
                                                        key={num}
                                                        onClick={() => !isOccupied && assignSeat(num)}
                                                        disabled={isOccupied}
                                                        style={{
                                                            width: '38px',
                                                            height: '38px',
                                                            borderRadius: '6px',
                                                            border: isOwnSeat ? '3px solid #3b82f6' : isOccupied ? '2px solid #991b1b' : '2px solid #16a34a',
                                                            background: isOwnSeat ? '#dbeafe' : isOccupied ? '#ef4444' : '#dcfce7',
                                                            color: isOwnSeat ? '#1d4ed8' : isOccupied ? 'white' : '#166534',
                                                            fontWeight: '700',
                                                            fontSize: '0.85rem',
                                                            cursor: isOccupied ? 'not-allowed' : 'pointer'
                                                        }}
                                                    >
                                                        {num}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        <div style={{ width: '20px' }}></div>
                                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                                            {rightSeats.map(num => {
                                                const seatStr = num.toString()
                                                const currentPassenger = passengers.find(p => p.id === selectedPassengerId)
                                                const isOwnSeat = currentPassenger?.seat_number === seatStr
                                                const isOccupied = occupiedSeats.has(seatStr) && !isOwnSeat

                                                return (
                                                    <button
                                                        key={num}
                                                        onClick={() => !isOccupied && assignSeat(num)}
                                                        disabled={isOccupied}
                                                        style={{
                                                            width: '38px',
                                                            height: '38px',
                                                            borderRadius: '6px',
                                                            border: isOwnSeat ? '3px solid #3b82f6' : isOccupied ? '2px solid #991b1b' : '2px solid #16a34a',
                                                            background: isOwnSeat ? '#dbeafe' : isOccupied ? '#ef4444' : '#dcfce7',
                                                            color: isOwnSeat ? '#1d4ed8' : isOccupied ? 'white' : '#166534',
                                                            fontWeight: '700',
                                                            fontSize: '0.85rem',
                                                            cursor: isOccupied ? 'not-allowed' : 'pointer'
                                                        }}
                                                    >
                                                        {num}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                            Toca un asiento verde para asignarlo
                        </p>
                    </div>
                </div>
            )}
        </div >
    )
}
