'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Reservation, ReservationPassenger } from '@/types'

// Extended type for local display
type ExtendedReservation = Reservation & {
    passengers: ReservationPassenger[]
}

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
)

const PhoneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
)

const WhatsAppIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
)

const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
)

const LinkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
)

export default function AbordajePage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [reservations, setReservations] = useState<ExtendedReservation[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [activeTab, setActiveTab] = useState<'pending' | 'boarded'>('pending')
    const [error, setError] = useState('')

    useEffect(() => {
        checkAuthAndLoad()
    }, [])

    const checkAuthAndLoad = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            router.push('/admin/login')
            return
        }
        await loadAllReservations()
    }

    const loadAllReservations = async () => {
        setIsLoading(true)
        try {
            // Fetch ALL active reservations (paid deposit or full)
            const { data: resData, error: resError } = await supabase
                .from('reservations')
                .select('*')
                .in('status', ['anticipo_pagado', 'pagado_completo'])
                .order('responsible_name', { ascending: true })

            if (resError) throw resError

            if (!resData) {
                setReservations([])
                setIsLoading(false)
                return
            }

            const results: ExtendedReservation[] = []

            for (const r of resData) {
                const { data: passData } = await supabase
                    .from('reservation_passengers')
                    .select('*')
                    .eq('reservation_id', r.id)
                    .order('first_name', { ascending: true })

                results.push({
                    ...(r as Reservation),
                    passengers: (passData as ReservationPassenger[]) || []
                })
            }

            setReservations(results)
        } catch (err) {
            console.error(err)
            setError('Error al cargar datos')
        } finally {
            setIsLoading(false)
        }
    }

    const toggleBoarded = async (passengerId: string, currentStatus: boolean | undefined) => {
        const newStatus = !currentStatus
        try {
            const { error } = await supabase
                .from('reservation_passengers')
                .update({ boarded: newStatus })
                .eq('id', passengerId)

            if (error) throw error

            setReservations(prev => prev.map(r => ({
                ...r,
                passengers: r.passengers.map(p =>
                    p.id === passengerId ? { ...p, boarded: newStatus } : p
                )
            })))
        } catch (err) {
            console.error('Error updating status', err)
            alert('Error al actualizar estatus')
        }
    }

    const stats = useMemo(() => {
        let totalPassengers = 0
        let totalBoarded = 0

        reservations.forEach(r => {
            totalPassengers += r.passengers.length
            r.passengers.forEach(p => {
                if (p.boarded) totalBoarded++
            })
        })

        return {
            total: totalPassengers,
            boarded: totalBoarded,
            pending: totalPassengers - totalBoarded
        }
    }, [reservations])

    const formatPhone = (phone: string) => {
        return phone.replace(/\D/g, '')
    }

    // Filter Logic
    const filteredReservations = useMemo(() => {
        const term = searchTerm.toLowerCase().trim()

        return reservations.map(r => {
            // 1. Filter passengers based on TAB
            const relevantPassengers = r.passengers.filter(p =>
                activeTab === 'boarded' ? p.boarded : !p.boarded
            )

            // If no passengers match the tab status, exclude this reservation from this view (unless searching)
            if (relevantPassengers.length === 0 && !term) return null

            // 2. Filter based on SEARCH
            const matchesSearch =
                r.reservation_code.toLowerCase().includes(term) ||
                r.responsible_name.toLowerCase().includes(term) ||
                r.boarding_access_code?.toLowerCase().includes(term) ||
                (r.responsible_congregation && r.responsible_congregation.toLowerCase().includes(term))

            if (term && !matchesSearch) return null

            // If searching, show all relevant passengers for context, otherwise just the tab ones?
            // User requested: "Searcher to avoid looking for 46 people"
            // So search matches reservation -> show relevant passengers

            return {
                ...r,
                passengers: relevantPassengers
            }
        }).filter(Boolean) as ExtendedReservation[]

    }, [reservations, searchTerm, activeTab])

    return (
        <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '1rem' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <header style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link href="/admin" style={{ textDecoration: 'none', color: '#666', display: 'flex', alignItems: 'center' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                    </Link>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', flex: 1 }}>Control de Abordaje</h1>
                </header>

                {/* Dashboard Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Total</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#2c3e50' }}>{stats.total}</div>
                    </div>
                    <div
                        onClick={() => setActiveTab('boarded')}
                        style={{
                            background: activeTab === 'boarded' ? '#e8f5e9' : 'white',
                            padding: '1rem',
                            borderRadius: '8px',
                            textAlign: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            cursor: 'pointer',
                            border: activeTab === 'boarded' ? '2px solid #4caf50' : 'none'
                        }}
                    >
                        <div style={{ fontSize: '0.85rem', color: '#2e7d32', textTransform: 'uppercase', fontWeight: 'bold' }}>A Bordo</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#2e7d32' }}>{stats.boarded}</div>
                    </div>
                    <div
                        onClick={() => setActiveTab('pending')}
                        style={{
                            background: activeTab === 'pending' ? '#fff3e0' : 'white',
                            padding: '1rem',
                            borderRadius: '8px',
                            textAlign: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            cursor: 'pointer',
                            border: activeTab === 'pending' ? '2px solid #ff9800' : 'none'
                        }}
                    >
                        <div style={{ fontSize: '0.85rem', color: '#ef6c00', textTransform: 'uppercase', fontWeight: 'bold' }}>Faltan</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#ef6c00' }}>{stats.pending}</div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="card" style={{ marginBottom: '1.5rem', padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '30px' }}>
                    <SearchIcon />
                    <input
                        type="text"
                        placeholder="Buscar por código, nombre o congregación..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            fontSize: '1rem',
                            background: 'transparent'
                        }}
                    />
                </div>

                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Cargando pasajeros...</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {filteredReservations.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#999', fontStyle: 'italic' }}>
                                {searchTerm ? 'No se encontraron resultados.' : activeTab === 'pending' ? '¡Todos han abordado! 🎉' : 'Nadie ha abordado aún.'}
                            </div>
                        ) : (
                            filteredReservations.map(r => (
                                <div key={r.id} className="card" style={{ overflow: 'hidden' }}>
                                    {/* Header Group */}
                                    <div style={{
                                        padding: '1rem',
                                        background: activeTab === 'pending' ? '#fff8e1' : '#f1f8e9',
                                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#2c3e50' }}>{r.responsible_name}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#546e7a', fontWeight: '600' }}>
                                                    {r.passengers.length} persona{r.passengers.length !== 1 ? 's' : ''} {activeTab === 'pending' ? 'por abordar' : 'a bordo'}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#78909c' }}>
                                                    {r.boarding_access_code || r.reservation_code}
                                                    {r.responsible_congregation && ` • ${r.responsible_congregation}`}
                                                </div>
                                            </div>

                                            {/* Quick Actions */}
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <a
                                                    href={`tel:${formatPhone(r.responsible_phone)}`}
                                                    style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '50%',
                                                        background: 'white',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#2c3e50',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                        textDecoration: 'none'
                                                    }}
                                                >
                                                    <PhoneIcon />
                                                </a>
                                                <a
                                                    href={`https://wa.me/52${formatPhone(r.responsible_phone)}`}
                                                    target="_blank"
                                                    style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '50%',
                                                        background: '#25D366',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                        textDecoration: 'none'
                                                    }}
                                                >
                                                    <WhatsAppIcon />
                                                </a>
                                                <Link
                                                    href={`/admin/reservaciones/${r.id}`}
                                                    style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '50%',
                                                        background: '#2c3e50',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                        textDecoration: 'none'
                                                    }}
                                                >
                                                    <LinkIcon />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Passengers List */}
                                    <div style={{ padding: '0.5rem 0' }}>
                                        {r.passengers.map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => toggleBoarded(p.id, p.boarded)}
                                                style={{
                                                    padding: '0.75rem 1rem',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    borderBottom: '1px solid #f5f5f5',
                                                    cursor: 'pointer',
                                                    background: 'white',
                                                    transition: 'background 0.2s'
                                                }}
                                            >
                                                <div>
                                                    <div style={{ fontWeight: '500', color: p.boarded ? '#2e7d32' : '#2c3e50' }}>
                                                        {p.first_name} {p.last_name}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#78909c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {p.seat_number ? (
                                                            <span style={{
                                                                color: activeTab === 'pending' ? '#ef6c00' : '#2e7d32',
                                                                fontWeight: '700',
                                                                background: activeTab === 'pending' ? '#fff3e0' : '#e8f5e9',
                                                                padding: '0 4px',
                                                                borderRadius: '3px'
                                                            }}>
                                                                {p.seat_number}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: '#bdbdbd' }}>-</span>
                                                        )}
                                                        <span>
                                                            {p.is_free_under6 ? 'Menor' : p.age ? `(${p.age} años)` : 'Adulto'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '50%',
                                                    border: p.boarded ? 'none' : '2px solid #e0e0e0',
                                                    background: p.boarded ? '#4caf50' : 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'white'
                                                }}>
                                                    {p.boarded && <CheckIcon />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
