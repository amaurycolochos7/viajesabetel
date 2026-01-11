'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Reservation } from '@/types'

export default function ReservacionesPage() {
    const router = useRouter()
    const [reservations, setReservations] = useState<Reservation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<string>('all')

    useEffect(() => {
        checkAuthAndLoadData()
    }, [])

    const checkAuthAndLoadData = async () => {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            router.push('/admin/login')
            return
        }

        const { data, error } = await supabase
            .from('reservations')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error(error)
        } else {
            setReservations(data as Reservation[])
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

    const filteredReservations = filter === 'all'
        ? reservations
        : reservations.filter(r => r.status === filter)

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link
                        href="/admin"
                        style={{ color: 'white', textDecoration: 'none', opacity: 0.9 }}
                    >
                        ← Dashboard
                    </Link>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                        Reservaciones
                    </h1>
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

            <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem' }}>
                {/* Filters */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginBottom: '1.5rem',
                    flexWrap: 'wrap'
                }}>
                    {[
                        { value: 'all', label: 'Todas' },
                        { value: 'pendiente', label: 'Pendientes' },
                        { value: 'anticipo_pagado', label: 'Con anticipo' },
                        { value: 'pagado_completo', label: 'Pagadas' },
                        { value: 'cancelado', label: 'Canceladas' },
                    ].map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => setFilter(value)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '4px',
                                border: filter === value ? 'none' : '1px solid var(--border-color)',
                                background: filter === value ? 'var(--primary)' : 'white',
                                color: filter === value ? 'white' : 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                        >
                            {label} ({value === 'all' ? reservations.length : reservations.filter(r => r.status === value).length})
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="card">
                    {filteredReservations.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                            No hay reservaciones
                        </p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>Código</th>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>Responsable</th>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>Teléfono</th>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600', textAlign: 'center' }}>Lugares</th>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600', textAlign: 'right' }}>Total</th>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600', textAlign: 'right' }}>Pagado</th>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600', textAlign: 'center' }}>Estatus</th>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredReservations.map((r) => (
                                        <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.75rem 0.5rem' }}>
                                                <Link
                                                    href={`/admin/reservaciones/${r.id}`}
                                                    style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: '500' }}
                                                >
                                                    {r.reservation_code}
                                                </Link>
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem' }}>{r.responsible_name}</td>
                                            <td style={{ padding: '0.75rem 0.5rem' }}>{r.responsible_phone}</td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                                {r.seats_payable}/{r.seats_total}
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '500' }}>
                                                ${r.total_amount.toLocaleString('es-MX')}
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                                                ${r.amount_paid.toLocaleString('es-MX')}
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                                <span className={`status-badge status-${r.status}`}>
                                                    {getStatusLabel(r.status)}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {new Date(r.created_at).toLocaleDateString('es-MX')}
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
