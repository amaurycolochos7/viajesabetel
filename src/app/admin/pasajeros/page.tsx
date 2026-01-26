'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface PassengerWithReservation {
    id: string
    first_name: string
    last_name: string
    age: number | null
    congregation: string | null
    is_free_under6: boolean
    seat_number: string | null
    reservation_id: string
    reservation_code: string
    responsible_name: string
    responsible_phone: string
    reservation_status: string
}

type FilterType = 'all' | 'paying' | 'free'

export default function PasajerosPage() {
    const router = useRouter()
    const [passengers, setPassengers] = useState<PassengerWithReservation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<FilterType>('all')
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        checkAuthAndLoadData()
    }, [])

    const checkAuthAndLoadData = async () => {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            router.push('/admin/login')
            return
        }

        // Verificar que es admin
        const { data: adminUser } = await supabase
            .from('admin_users')
            .select('email')
            .eq('email', session.user.email)
            .single()

        if (!adminUser) {
            router.push('/admin/login')
            return
        }

        // Obtener todas las reservaciones activas
        const { data: reservations } = await supabase
            .from('reservations')
            .select('id, reservation_code, responsible_name, responsible_phone, status')
            .neq('status', 'cancelado')

        if (!reservations) {
            setIsLoading(false)
            return
        }

        // Obtener todos los pasajeros
        const { data: passengersData } = await supabase
            .from('reservation_passengers')
            .select('*')
            .order('created_at', { ascending: true })

        if (!passengersData) {
            setIsLoading(false)
            return
        }

        // Crear mapa de reservaciones
        const reservationMap = new Map(reservations.map(r => [r.id, r]))

        // Combinar pasajeros con info de reservación
        const passengersWithRes: PassengerWithReservation[] = passengersData
            .filter(p => reservationMap.has(p.reservation_id))
            .map(p => {
                const res = reservationMap.get(p.reservation_id)!
                return {
                    id: p.id,
                    first_name: p.first_name,
                    last_name: p.last_name,
                    age: p.age,
                    congregation: p.congregation,
                    is_free_under6: p.is_free_under6,
                    seat_number: p.seat_number,
                    reservation_id: p.reservation_id,
                    reservation_code: res.reservation_code,
                    responsible_name: res.responsible_name,
                    responsible_phone: res.responsible_phone,
                    reservation_status: res.status
                }
            })

        setPassengers(passengersWithRes)
        setIsLoading(false)
    }

    const filteredPassengers = passengers.filter(p => {
        // Filtro por tipo
        if (filter === 'paying' && p.is_free_under6) return false
        if (filter === 'free' && !p.is_free_under6) return false

        // Filtro por búsqueda
        if (searchTerm) {
            const search = searchTerm.toLowerCase()
            return (
                p.first_name.toLowerCase().includes(search) ||
                p.last_name.toLowerCase().includes(search) ||
                p.reservation_code.toLowerCase().includes(search) ||
                p.responsible_name.toLowerCase().includes(search) ||
                p.responsible_phone.includes(search)
            )
        }

        return true
    })

    const stats = {
        total: passengers.length,
        paying: passengers.filter(p => !p.is_free_under6).length,
        free: passengers.filter(p => p.is_free_under6).length
    }

    if (isLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                <p>Cargando pasajeros...</p>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
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
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <Link href="/admin" style={{ color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </Link>
                        <div>
                            <h1 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: '#1e293b' }}>
                                Lista de Pasajeros
                            </h1>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                                {stats.total} personas • {stats.paying} ocupan asiento • {stats.free} en brazos
                            </p>
                        </div>
                    </div>

                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                        <input
                            type="text"
                            placeholder="Buscar por nombre, teléfono o código..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem 0.75rem 2.5rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                fontSize: '0.9rem',
                                background: '#f8fafc'
                            }}
                        />
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
                        >
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                        </svg>
                    </div>

                    {/* Filter Tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {[
                            { id: 'all', label: 'Todos', count: stats.total, color: '#334155' },
                            { id: 'paying', label: 'Ocupan Asiento', count: stats.paying, color: '#2563eb' },
                            { id: 'free', label: 'En Brazos', count: stats.free, color: '#16a34a' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id as FilterType)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    border: 'none',
                                    borderRadius: '20px',
                                    cursor: 'pointer',
                                    background: filter === tab.id ? tab.color : 'white',
                                    color: filter === tab.id ? 'white' : '#64748b',
                                    fontWeight: '600',
                                    fontSize: '0.85rem',
                                    boxShadow: filter === tab.id ? '0 2px 4px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)'
                                }}
                            >
                                {tab.label} <span style={{ opacity: 0.8, marginLeft: '4px' }}>{tab.count}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* List */}
            <main style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem' }}>
                <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    {/* Table Header */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '50px 1fr 1fr 100px',
                        gap: '0.5rem',
                        padding: '0.75rem 1rem',
                        background: '#f1f5f9',
                        fontWeight: '700',
                        fontSize: '0.75rem',
                        color: '#64748b',
                        textTransform: 'uppercase'
                    }}>
                        <div>#</div>
                        <div>Pasajero</div>
                        <div>Reservación</div>
                        <div style={{ textAlign: 'center' }}>Tipo</div>
                    </div>

                    {/* Rows */}
                    {filteredPassengers.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                            No se encontraron pasajeros
                        </div>
                    ) : (
                        filteredPassengers.map((passenger, index) => (
                            <div
                                key={passenger.id}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '50px 1fr 1fr 100px',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1rem',
                                    borderBottom: '1px solid #f1f5f9',
                                    alignItems: 'center'
                                }}
                            >
                                {/* Number */}
                                <div style={{
                                    fontWeight: '800',
                                    fontSize: '1rem',
                                    color: passenger.is_free_under6 ? '#16a34a' : '#1e293b'
                                }}>
                                    {index + 1}
                                </div>

                                {/* Passenger Info */}
                                <div>
                                    <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.95rem' }}>
                                        {passenger.first_name} {passenger.last_name}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                        {passenger.congregation || '—'}
                                        {passenger.age !== null && ` • ${passenger.age} años`}
                                    </div>
                                </div>

                                {/* Reservation Info */}
                                <div>
                                    <Link
                                        href={`/admin/reservaciones/${passenger.reservation_id}`}
                                        style={{
                                            fontWeight: '600',
                                            color: '#3b82f6',
                                            fontSize: '0.85rem',
                                            textDecoration: 'none',
                                            fontFamily: 'monospace'
                                        }}
                                    >
                                        {passenger.reservation_code}
                                    </Link>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                        {passenger.responsible_name}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                        {passenger.responsible_phone}
                                    </div>
                                </div>

                                {/* Type Badge */}
                                <div style={{ textAlign: 'center' }}>
                                    {passenger.is_free_under6 ? (
                                        <span style={{
                                            background: '#dcfce7',
                                            color: '#166534',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '6px',
                                            fontSize: '0.7rem',
                                            fontWeight: '700',
                                            display: 'inline-block'
                                        }}>
                                            EN BRAZOS
                                        </span>
                                    ) : (
                                        <span style={{
                                            background: '#e0e7ff',
                                            color: '#3730a3',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '6px',
                                            fontSize: '0.7rem',
                                            fontWeight: '700',
                                            display: 'inline-block'
                                        }}>
                                            ASIENTO
                                            {passenger.seat_number && ` #${passenger.seat_number}`}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Summary Footer */}
                <div style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    background: '#f1f5f9',
                    borderRadius: '12px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        Mostrando <strong>{filteredPassengers.length}</strong> de <strong>{stats.total}</strong> pasajeros
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                        {stats.paying} ocupan asiento en autobús • {stats.free} van en brazos (no ocupan asiento)
                    </div>
                </div>
            </main>
        </div>
    )
}
