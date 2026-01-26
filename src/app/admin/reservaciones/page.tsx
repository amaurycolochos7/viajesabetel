'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Reservation } from '@/types'

type FilterStatus = 'all' | 'pendiente' | 'anticipo_pagado' | 'pagado_completo' | 'cancelado' | 'anfitrion'

// Main export wraps content in Suspense
export default function ReservacionesPage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa' }}>
                <p>Cargando...</p>
            </div>
        }>
            <ReservacionesContent />
        </Suspense>
    )
}

function ReservacionesContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [reservations, setReservations] = useState<Reservation[]>([])
    const [passengerCounts, setPassengerCounts] = useState<Map<string, number>>(new Map())
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<FilterStatus>('all')
    const [userEmail, setUserEmail] = useState('')
    const [searchCode, setSearchCode] = useState('')

    useEffect(() => {
        // Leer filtro de URL si existe
        const urlFilter = searchParams.get('filter') as FilterStatus | null
        if (urlFilter && ['pendiente', 'anticipo_pagado', 'pagado_completo', 'cancelado', 'anfitrion'].includes(urlFilter)) {
            setFilter(urlFilter)
        }
        checkAuthAndLoadData()
    }, [searchParams])

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

        setUserEmail(session.user.email || '')

        const { data, error } = await supabase
            .from('reservations')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error(error)
        } else {
            setReservations(data as Reservation[])

            // Obtener todos los pasajeros con su info completa incluyendo edad
            const { data: passengers } = await supabase
                .from('reservation_passengers')
                .select('id, reservation_id, is_free_under6, age')

            if (passengers) {
                // Primero corregir pasajeros con is_free_under6 incorrecto
                for (const p of passengers) {
                    const shouldBeFree = p.age !== null && p.age < 6
                    if (p.is_free_under6 !== shouldBeFree) {
                        console.log(`Corrigiendo pasajero ${p.id}: is_free_under6 ${p.is_free_under6} -> ${shouldBeFree} (edad: ${p.age})`)
                        await supabase
                            .from('reservation_passengers')
                            .update({ is_free_under6: shouldBeFree })
                            .eq('id', p.id)
                    }
                }

                // Recalcular conteos con datos corregidos
                const counts = new Map<string, number>()
                const payableCounts = new Map<string, number>()

                passengers.forEach(p => {
                    const current = counts.get(p.reservation_id) || 0
                    counts.set(p.reservation_id, current + 1)

                    // Usar edad para determinar si paga (más confiable)
                    const isFree = p.age !== null && p.age < 6
                    if (!isFree) {
                        const payable = payableCounts.get(p.reservation_id) || 0
                        payableCounts.set(p.reservation_id, payable + 1)
                    }
                })
                setPassengerCounts(counts)

                const PRICE_PER_SEAT = 1800

                // Sincronizar reservaciones con datos incorrectos
                for (const reservation of (data as Reservation[])) {
                    const realTotal = counts.get(reservation.id) || 0
                    const realPayable = payableCounts.get(reservation.id) || 0
                    const correctTotalAmount = realPayable * PRICE_PER_SEAT
                    const correctDeposit = Math.ceil(correctTotalAmount * 0.5)

                    // Determinar status correcto basado en pagos
                    let correctStatus = reservation.status
                    if (reservation.status !== 'cancelado') {
                        if (reservation.amount_paid >= correctTotalAmount && correctTotalAmount > 0) {
                            correctStatus = 'pagado_completo'
                        } else if (reservation.amount_paid >= correctDeposit && correctDeposit > 0) {
                            correctStatus = 'anticipo_pagado'
                        } else {
                            correctStatus = 'pendiente'
                        }
                    }

                    // Verificar si hay discrepancias
                    const needsUpdate = realTotal > 0 && (
                        reservation.seats_total !== realTotal ||
                        reservation.seats_payable !== realPayable ||
                        reservation.total_amount !== correctTotalAmount ||
                        (reservation.status !== 'cancelado' && reservation.status !== correctStatus)
                    )

                    if (needsUpdate) {
                        console.log(`Corrigiendo ${reservation.reservation_code}: seats_total=${realTotal}, seats_payable=${realPayable}, total=$${correctTotalAmount}, status=${correctStatus}`)

                        supabase
                            .from('reservations')
                            .update({
                                seats_total: realTotal,
                                seats_payable: realPayable,
                                total_amount: correctTotalAmount,
                                deposit_required: correctDeposit,
                                status: correctStatus
                            })
                            .eq('id', reservation.id)
                            .then(() => {
                                console.log(`✓ Sincronizado ${reservation.reservation_code}`)
                            })
                    }
                }
            }
        }
        setIsLoading(false)
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/admin/login')
    }

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            pendiente: 'Pendiente',
            anticipo_pagado: 'Anticipo',
            pagado_completo: 'Pagado',
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

    const filteredReservations = reservations.filter(r => {
        let matchesFilter = false

        if (filter === 'all') matchesFilter = true
        else if (filter === 'anfitrion') matchesFilter = !!r.is_host
        else matchesFilter = r.status === filter && !r.is_host // Exclude hosts from standard status filters

        const matchesSearch = searchCode === '' ||
            r.reservation_code.toLowerCase().includes(searchCode.toLowerCase()) ||
            r.responsible_name.toLowerCase().includes(searchCode.toLowerCase()) ||
            r.responsible_phone.includes(searchCode)
        return matchesFilter && matchesSearch
    })

    const stats = {
        total: reservations.length,
        pendientes: reservations.filter(r => r.status === 'pendiente' && !r.is_host).length,
        conAnticipo: reservations.filter(r => r.status === 'anticipo_pagado' && !r.is_host).length,
        pagadas: reservations.filter(r => r.status === 'pagado_completo' && !r.is_host).length,
        canceladas: reservations.filter(r => r.status === 'cancelado' && !r.is_host).length,
        anfitriones: reservations.filter(r => r.is_host).length,
    }

    if (isLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa' }}>
                <p>Cargando...</p>
            </div>
        )
    }

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
                <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Link href="/admin" style={{ color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </Link>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: '#1e293b' }}>Reservaciones</h1>
                    </div>
                </div>
            </header>

            <main style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
                {/* Search & Stats */}
                <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Buscar reservación..."
                            value={searchCode}
                            onChange={(e) => setSearchCode(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '1rem 1rem 1rem 3rem',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                background: 'white',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                outline: 'none'
                            }}
                        />
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }}
                        >
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                        </svg>
                    </div>

                    {/* Filter Tabs (Scrollable) */}
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        overflowX: 'auto',
                        paddingBottom: '4px',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                    }}>
                        {[
                            { id: 'all', label: 'Todas', count: stats.total, color: '#334155' },
                            { id: 'anfitrion', label: 'Anfitriones', count: stats.anfitriones, color: '#8b5cf6' },
                            { id: 'pendiente', label: 'Pendientes', count: stats.pendientes, color: '#f59e0b' },
                            { id: 'anticipo_pagado', label: 'Anticipo', count: stats.conAnticipo, color: '#3b82f6' },
                            { id: 'pagado_completo', label: 'Pagadas', count: stats.pagadas, color: '#22c55e' },
                            { id: 'cancelado', label: 'Canceladas', count: stats.canceladas, color: '#ef4444' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id as FilterStatus)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    border: 'none',
                                    borderRadius: '20px',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    background: filter === tab.id ? tab.color : 'white',
                                    color: filter === tab.id ? 'white' : '#64748b',
                                    fontWeight: '600',
                                    fontSize: '0.9rem',
                                    boxShadow: filter === tab.id ? '0 4px 6px -1px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {tab.label} <span style={{ opacity: 0.8, marginLeft: '4px', fontSize: '0.8em' }}>{tab.count}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Card List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filteredReservations.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                            No se encontraron reservaciones
                        </div>
                    ) : (
                        filteredReservations.map((r) => (
                            <Link
                                href={`/admin/reservaciones/${r.id}`}
                                key={r.id}
                                style={{ textDecoration: 'none' }}
                            >
                                <div style={{
                                    background: 'white',
                                    borderRadius: '16px',
                                    padding: '1.25rem',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                    border: '1px solid rgba(0,0,0,0.02)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem'
                                }}>
                                    {/* Top Row: Info & Status Badge */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1e293b' }}>
                                                {r.responsible_name}
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {r.reservation_code}
                                                {r.payment_method && (
                                                    <span style={{
                                                        fontSize: '0.75rem',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        fontWeight: '600',
                                                        background: r.payment_method === 'card' ? '#e0f2fe' : '#fef3c7',
                                                        color: r.payment_method === 'card' ? '#0369a1' : '#b45309',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '3px'
                                                    }}>
                                                        {r.payment_method === 'card' ? '💳 MP' : '🏦 Trans'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            background: getStatusColor(r.status) + '15',
                                            color: getStatusColor(r.status)
                                        }}>
                                            {getStatusLabel(r.status)}
                                        </span>
                                    </div>

                                    {/* Middle Row: Stats */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: '0.5rem',
                                        padding: '0.75rem 0',
                                        borderTop: '1px solid #f1f5f9',
                                        borderBottom: '1px solid #f1f5f9'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Lugares</div>
                                            <div style={{ fontSize: '0.95rem', color: '#334155', fontWeight: '600' }}>
                                                {r.seats_payable} <span style={{ color: '#cbd5e1', fontSize: '0.8em' }}>/ {passengerCounts.get(r.id) || r.seats_total}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Pagado</div>
                                            <div style={{ fontSize: '0.95rem', color: r.is_host ? '#3b82f6' : (r.amount_paid > 0 ? '#10b981' : '#94a3b8'), fontWeight: '700' }}>
                                                {r.is_host ? 'Anfitrión' : (r.amount_paid > 0 ? `$${r.amount_paid.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00')}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Total</div>
                                            <div style={{ fontSize: '0.95rem', color: r.is_host ? '#3b82f6' : '#1e293b', fontWeight: '800' }}>
                                                {r.is_host ? 'Anfitrión' : `$${r.total_amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Row: Date & Action */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                                            {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <span style={{
                                            color: '#3b82f6',
                                            fontSize: '0.9rem',
                                            fontWeight: '600',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            Ver detalle
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </main>
        </div>
    )
}
