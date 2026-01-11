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
                <div>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                        Panel de Administración
                    </h1>
                    <p style={{ fontSize: '0.85rem', opacity: 0.9, margin: '0.25rem 0 0 0' }}>
                        Viaje a Betel 2026
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{userEmail}</span>
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
                </div>
            </header>

            <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem' }}>
                {/* Stats Grid */}
                {stats && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '1rem',
                        marginBottom: '2rem'
                    }}>
                        <div className="stat-card">
                            <div className="stat-value">{stats.totalReservations}</div>
                            <div className="stat-label">Reservaciones</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.totalSeats}</div>
                            <div className="stat-label">Lugares totales</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.seatsPayable}</div>
                            <div className="stat-label">Lugares pagables</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                                ${stats.totalAmount.toLocaleString('es-MX')}
                            </div>
                            <div className="stat-label">Total comprometido</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ fontSize: '1.25rem', color: '#2e7d32' }}>
                                ${stats.totalPaid.toLocaleString('es-MX')}
                            </div>
                            <div className="stat-label">Total pagado</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: stats.pendingDeposits > 0 ? '#f57c00' : 'inherit' }}>
                                {stats.pendingDeposits}
                            </div>
                            <div className="stat-label">Anticipos pendientes</div>
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <Link
                        href="/admin/reservaciones"
                        className="nav-button"
                        style={{ textDecoration: 'none' }}
                    >
                        Ver reservaciones
                    </Link>
                    <Link
                        href="/admin/grupos"
                        className="nav-button secondary"
                        style={{ textDecoration: 'none' }}
                    >
                        Grupos de tour
                    </Link>
                </div>

                {/* Recent Reservations */}
                <div className="card">
                    <h2 className="section-title">Reservaciones recientes</h2>

                    {recentReservations.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                            No hay reservaciones aún
                        </p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>Código</th>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>Responsable</th>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600', textAlign: 'center' }}>Lugares</th>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600', textAlign: 'right' }}>Total</th>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600', textAlign: 'center' }}>Estatus</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentReservations.map((r) => (
                                        <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.75rem 0.5rem' }}>
                                                <Link
                                                    href={`/admin/reservaciones/${r.id}`}
                                                    style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: '500' }}
                                                >
                                                    {r.reservation_code}
                                                </Link>
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem' }}>
                                                <div>{r.responsible_name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    {r.responsible_phone}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                                {r.seats_payable}/{r.seats_total}
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '500' }}>
                                                ${r.total_amount.toLocaleString('es-MX')}
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                                <span className={`status-badge status-${r.status}`}>
                                                    {getStatusLabel(r.status)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
