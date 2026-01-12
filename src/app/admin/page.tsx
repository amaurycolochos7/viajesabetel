'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Reservation } from '@/types'

interface Stats {
    totalReservations: number
    totalSeats: number
    seatsPayable: number
    totalAmount: number
    totalPaid: number
    pendingDeposits: number
}

export default function AdminDashboard() {
    const router = useRouter()
    const [stats, setStats] = useState<Stats | null>(null)
    const [recentReservations, setRecentReservations] = useState<Reservation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [userEmail, setUserEmail] = useState('')

    useEffect(() => {
        checkAuthAndLoadData()
    }, [])

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

        const { data: reservations, error } = await supabase
            .from('reservations')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error(error)
            setIsLoading(false)
            return
        }

        const reservationsData = reservations as Reservation[]

        const totalReservations = reservationsData.length
        const totalSeats = reservationsData.reduce((sum, r) => sum + r.seats_total, 0)
        const seatsPayable = reservationsData.reduce((sum, r) => sum + r.seats_payable, 0)
        const totalAmount = reservationsData.reduce((sum, r) => sum + r.total_amount, 0)
        const totalPaid = reservationsData.reduce((sum, r) => sum + r.amount_paid, 0)
        const pendingDeposits = reservationsData.filter(r =>
            r.status === 'pendiente' && r.amount_paid < r.deposit_required
        ).length

        setStats({
            totalReservations,
            totalSeats,
            seatsPayable,
            totalAmount,
            totalPaid,
            pendingDeposits,
        })

        setRecentReservations(reservationsData.slice(0, 10))
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
                <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h1 style={{
                                fontSize: '1.5rem',
                                fontWeight: '800',
                                color: '#1a1a1a',
                                margin: 0,
                                letterSpacing: '-0.5px'
                            }}>
                                Dashboard
                            </h1>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Viaje a Betel 2026</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            style={{
                                background: '#f5f5f5',
                                border: 'none',
                                color: '#666',
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                        </button>
                    </div>
                </div>
            </header>

            <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>
                {/* Stats Grid */}
                {stats && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: '0.75rem',
                        marginBottom: '1.5rem'
                    }}>
                        <Link
                            href="/admin/reservaciones"
                            style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', textDecoration: 'none', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                        >
                            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#2c3e50', lineHeight: 1 }}>{stats.totalReservations}</div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600', marginTop: '0.25rem' }}>RESERVACIONES</div>
                        </Link>
                        <Link
                            href="/admin/reservaciones"
                            style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', textDecoration: 'none', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                        >
                            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#2c3e50', lineHeight: 1 }}>{stats.totalSeats}</div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600', marginTop: '0.25rem' }}>LUGARES TOTALES</div>
                        </Link>
                        <Link
                            href="/admin/reservaciones?filter=pagado_completo"
                            style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', textDecoration: 'none', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                        >
                            <div style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: '800', color: '#2e7d32', lineHeight: 1, wordBreak: 'break-all' }}>${stats.totalPaid.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600', marginTop: '0.25rem' }}>PAGADO</div>
                        </Link>
                        <Link
                            href="/admin/reservaciones?filter=pendiente"
                            style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', textDecoration: 'none', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                        >
                            <div style={{ fontSize: '2rem', fontWeight: '800', color: stats.pendingDeposits > 0 ? '#f59e0b' : '#2c3e50', lineHeight: 1 }}>
                                {stats.pendingDeposits}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600', marginTop: '0.25rem' }}>ANTICIPOS PEND.</div>
                        </Link>
                    </div>
                )}

                {/* Navigation Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '2rem' }}>
                    <Link
                        href="/admin/reservaciones"
                        style={{
                            background: '#3b82f6',
                            color: 'white',
                            padding: '1rem',
                            borderRadius: '12px',
                            textDecoration: 'none',
                            textAlign: 'center',
                            fontWeight: '600',
                            boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)'
                        }}
                    >
                        Reservaciones
                    </Link>
                    <Link
                        href="/admin/abordaje"
                        style={{
                            background: '#10b981',
                            color: 'white',
                            padding: '1rem',
                            borderRadius: '12px',
                            textDecoration: 'none',
                            textAlign: 'center',
                            fontWeight: '600',
                            boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
                        }}
                    >
                        Abordaje
                    </Link>
                    <Link
                        href="/admin/grupos"
                        style={{
                            background: 'white',
                            color: '#475569',
                            padding: '1rem',
                            borderRadius: '12px',
                            textDecoration: 'none',
                            textAlign: 'center',
                            fontWeight: '600',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            gridColumn: '1 / -1'
                        }}
                    >
                        Gestionar Grupos de Tour
                    </Link>
                </div>

                {/* Recent List - Mobile Optimized */}
                <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1a1a1a', marginBottom: '1rem' }}>Recientes</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {recentReservations.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem', background: 'white', borderRadius: '12px' }}>
                            Sin reservaciones
                        </div>
                    ) : (
                        recentReservations.map((r) => (
                            <Link
                                href={`/admin/reservaciones/${r.id}`}
                                key={r.id}
                                style={{ textDecoration: 'none' }}
                            >
                                <div style={{
                                    background: 'white',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: '700', color: '#334155', fontSize: '1rem' }}>{r.responsible_name}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px' }}>
                                            {r.reservation_code} • {r.seats_total} lugares
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: '700', color: '#0f172a' }}>${r.total_amount.toLocaleString()}</div>
                                        <span style={{
                                            display: 'inline-block',
                                            fontSize: '0.75rem',
                                            padding: '2px 8px',
                                            borderRadius: '10px',
                                            fontWeight: '600',
                                            marginTop: '4px',
                                            background: r.status === 'pagado_completo' ? '#dcfce7' : r.status === 'anticipo_pagado' ? '#e0f2fe' : '#f1f5f9',
                                            color: r.status === 'pagado_completo' ? '#166534' : r.status === 'anticipo_pagado' ? '#0369a1' : '#475569'
                                        }}>
                                            {getStatusLabel(r.status)}
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
