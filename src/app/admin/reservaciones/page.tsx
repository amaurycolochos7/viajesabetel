'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Reservation } from '@/types'

type FilterStatus = 'all' | 'pendiente' | 'anticipo_pagado' | 'pagado_completo' | 'cancelado'

export default function ReservacionesPage() {
    const router = useRouter()
    const [reservations, setReservations] = useState<Reservation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<FilterStatus>('all')
    const [userEmail, setUserEmail] = useState('')
    const [searchCode, setSearchCode] = useState('')

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
        const matchesFilter = filter === 'all' || r.status === filter
        const matchesSearch = searchCode === '' ||
            r.reservation_code.toLowerCase().includes(searchCode.toLowerCase()) ||
            r.responsible_name.toLowerCase().includes(searchCode.toLowerCase()) ||
            r.responsible_phone.includes(searchCode)
        return matchesFilter && matchesSearch
    })

    const stats = {
        total: reservations.length,
        pendientes: reservations.filter(r => r.status === 'pendiente').length,
        conAnticipo: reservations.filter(r => r.status === 'anticipo_pagado').length,
        pagadas: reservations.filter(r => r.status === 'pagado_completo').length,
        canceladas: reservations.filter(r => r.status === 'cancelado').length,
    }

    if (isLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa' }}>
                <p>Cargando...</p>
            </div>
        )
    }

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
                    <Link href="/admin" style={{ color: 'white', textDecoration: 'none', opacity: 0.9 }}>
                        ← Dashboard
                    </Link>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Reservaciones</h1>
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

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
                {/* Search */}
                <div style={{ marginBottom: '1rem' }}>
                    <input
                        type="text"
                        placeholder="Buscar por código, nombre o teléfono..."
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value)}
                        style={{
                            width: '100%',
                            maxWidth: '400px',
                            padding: '0.75rem 1rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '0.95rem'
                        }}
                    />
                </div>

                {/* Filter Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setFilter('all')}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            background: filter === 'all' ? 'var(--primary)' : '#e0e0e0',
                            color: filter === 'all' ? 'white' : '#333',
                            fontWeight: '500'
                        }}
                    >
                        Todas ({stats.total})
                    </button>
                    <button
                        onClick={() => setFilter('pendiente')}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            background: filter === 'pendiente' ? '#f39c12' : '#e0e0e0',
                            color: filter === 'pendiente' ? 'white' : '#333',
                            fontWeight: '500'
                        }}
                    >
                        Pendientes ({stats.pendientes})
                    </button>
                    <button
                        onClick={() => setFilter('anticipo_pagado')}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            background: filter === 'anticipo_pagado' ? '#3498db' : '#e0e0e0',
                            color: filter === 'anticipo_pagado' ? 'white' : '#333',
                            fontWeight: '500'
                        }}
                    >
                        Con anticipo ({stats.conAnticipo})
                    </button>
                    <button
                        onClick={() => setFilter('pagado_completo')}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            background: filter === 'pagado_completo' ? '#27ae60' : '#e0e0e0',
                            color: filter === 'pagado_completo' ? 'white' : '#333',
                            fontWeight: '500'
                        }}
                    >
                        Pagadas ({stats.pagadas})
                    </button>
                    <button
                        onClick={() => setFilter('cancelado')}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            background: filter === 'cancelado' ? '#e74c3c' : '#e0e0e0',
                            color: filter === 'cancelado' ? 'white' : '#333',
                            fontWeight: '500'
                        }}
                    >
                        Canceladas ({stats.canceladas})
                    </button>
                </div>

                {/* Table */}
                <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e0e0e0' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Código</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Responsable</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Teléfono</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>Lugares</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>Total</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>Pagado</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>Estatus</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>Fecha</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredReservations.map((reservation) => (
                                    <tr
                                        key={reservation.id}
                                        style={{ borderBottom: '1px solid #e0e0e0' }}
                                    >
                                        <td style={{ padding: '1rem' }}>
                                            <Link
                                                href={`/admin/reservaciones/${reservation.id}`}
                                                style={{
                                                    color: 'var(--primary)',
                                                    textDecoration: 'none',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                {reservation.reservation_code}
                                            </Link>
                                        </td>
                                        <td style={{ padding: '1rem' }}>{reservation.responsible_name}</td>
                                        <td style={{ padding: '1rem' }}>{reservation.responsible_phone}</td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            {reservation.seats_payable}/{reservation.seats_total}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '500' }}>
                                            ${reservation.total_amount.toLocaleString('es-MX')}
                                        </td>
                                        <td style={{
                                            padding: '1rem',
                                            textAlign: 'right',
                                            fontWeight: '500',
                                            color: reservation.amount_paid > 0 ? '#27ae60' : '#999'
                                        }}>
                                            ${reservation.amount_paid.toLocaleString('es-MX')}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '20px',
                                                fontSize: '0.8rem',
                                                fontWeight: '600',
                                                background: getStatusColor(reservation.status) + '20',
                                                color: getStatusColor(reservation.status)
                                            }}>
                                                {getStatusLabel(reservation.status)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: '#666' }}>
                                            {new Date(reservation.created_at).toLocaleDateString('es-MX', {
                                                day: 'numeric',
                                                month: 'short'
                                            })}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <Link
                                                href={`/admin/reservaciones/${reservation.id}`}
                                                style={{
                                                    display: 'inline-block',
                                                    padding: '0.4rem 0.75rem',
                                                    background: 'var(--primary)',
                                                    color: 'white',
                                                    borderRadius: '4px',
                                                    textDecoration: 'none',
                                                    fontSize: '0.8rem'
                                                }}
                                            >
                                                Ver
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredReservations.length === 0 && (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
                            No hay reservaciones que coincidan
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
