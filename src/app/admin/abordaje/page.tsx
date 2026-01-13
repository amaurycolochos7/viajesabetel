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
        <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '2rem' }}>
            {/* Sticky Header */}
            <header style={{
                background: 'white',
                borderBottom: '1px solid #f1f5f9',
                padding: '1rem',
                position: 'sticky',
                top: 0,
                zIndex: 20,
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}>
                <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link href="/admin" style={{ textDecoration: 'none', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                    </Link>
                    <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#1e293b' }}>Control de Abordaje</h1>
                </div>
            </header>

            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
                {/* Dashboard Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: 'white', padding: '1rem 0.5rem', borderRadius: '12px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Total</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#334155', marginTop: '4px' }}>{stats.total}</div>
                    </div>
                    <div
                        onClick={() => setActiveTab('boarded')}
                        style={{
                            background: activeTab === 'boarded' ? '#ecfdf5' : 'white',
                            padding: '1rem 0.5rem',
                            borderRadius: '12px',
                            textAlign: 'center',
                            boxShadow: activeTab === 'boarded' ? '0 2px 4px rgba(16, 185, 129, 0.1)' : '0 2px 4px rgba(0,0,0,0.02)',
                            cursor: 'pointer',
                            border: activeTab === 'boarded' ? '1px solid #6ee7b7' : '1px solid #e2e8f0',
                            transition: 'all 0.2s'
                        }}
                    >
                        <div style={{ fontSize: '0.75rem', color: activeTab === 'boarded' ? '#059669' : '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>A Bordo</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: activeTab === 'boarded' ? '#059669' : '#334155', marginTop: '4px' }}>{stats.boarded}</div>
                    </div>
                    <div
                        onClick={() => setActiveTab('pending')}
                        style={{
                            background: activeTab === 'pending' ? '#fffbeb' : 'white',
                            padding: '1rem 0.5rem',
                            borderRadius: '12px',
                            textAlign: 'center',
                            boxShadow: activeTab === 'pending' ? '0 2px 4px rgba(245, 158, 11, 0.1)' : '0 2px 4px rgba(0,0,0,0.02)',
                            cursor: 'pointer',
                            border: activeTab === 'pending' ? '1px solid #fcd34d' : '1px solid #e2e8f0',
                            transition: 'all 0.2s'
                        }}
                    >
                        <div style={{ fontSize: '0.75rem', color: activeTab === 'pending' ? '#d97706' : '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Faltan</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: activeTab === 'pending' ? '#d97706' : '#334155', marginTop: '4px' }}>{stats.pending}</div>
                    </div>
                </div>

                {/* Search Bar */}
                <div style={{ marginBottom: '1.5rem', background: 'white', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#94a3b8' }}><SearchIcon /></div>
                    <input
                        type="text"
                        placeholder="Buscar por código, nombre o congregación..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            fontSize: '0.95rem',
                            background: 'transparent',
                            color: '#334155',
                            fontWeight: '500'
                        }}
                    />
                </div>

                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Cargando pasajeros...</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {filteredReservations.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', fontStyle: 'italic', background: 'white', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
                                {searchTerm ? 'No se encontraron resultados.' : activeTab === 'pending' ? '¡Todos han abordado! 🎉' : 'Nadie ha abordado aún.'}
                            </div>
                        ) : (
                            filteredReservations.map(r => (
                                <div key={r.id} style={{
                                    background: 'white',
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
                                    border: '1px solid #f1f5f9'
                                }}>
                                    {/* Header Group */}
                                    <div style={{
                                        padding: '1rem 1.25rem',
                                        background: activeTab === 'pending' ? '#fffbf0' : '#f0fdf4',
                                        borderBottom: `1px solid ${activeTab === 'pending' ? '#fef3c7' : '#dcfce7'}`,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#1e293b' }}>{r.responsible_name}</div>
                                                <div style={{ fontSize: '0.85rem', color: activeTab === 'pending' ? '#d97706' : '#15803d', fontWeight: '600', marginTop: '2px' }}>
                                                    {r.passengers.length} persona{r.passengers.length !== 1 ? 's' : ''} {activeTab === 'pending' ? 'por abordar' : 'a bordo'}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.5)', padding: '2px 4px', borderRadius: '4px', display: 'inline-block' }}>
                                                    {r.boarding_access_code || r.reservation_code}
                                                </div>
                                                {r.responsible_congregation && (
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                                                        {r.responsible_congregation}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Quick Actions */}
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <a
                                                    href={`tel:${formatPhone(r.responsible_phone)}`}
                                                    style={{
                                                        width: '38px',
                                                        height: '38px',
                                                        borderRadius: '10px',
                                                        background: 'white',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#334155',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                                        border: '1px solid #e2e8f0',
                                                        textDecoration: 'none'
                                                    }}
                                                >
                                                    <PhoneIcon />
                                                </a>
                                                <a
                                                    href={`https://wa.me/52${formatPhone(r.responsible_phone)}`}
                                                    target="_blank"
                                                    style={{
                                                        width: '38px',
                                                        height: '38px',
                                                        borderRadius: '10px',
                                                        background: '#25D366',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        boxShadow: '0 2px 4px rgba(37, 211, 102, 0.2)',
                                                        textDecoration: 'none'
                                                    }}
                                                >
                                                    <WhatsAppIcon />
                                                </a>
                                                <Link
                                                    href={`/admin/reservaciones/${r.id}`}
                                                    style={{
                                                        width: '38px',
                                                        height: '38px',
                                                        borderRadius: '10px',
                                                        background: '#334155',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        boxShadow: '0 2px 4px rgba(51, 65, 85, 0.2)',
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
                                                    padding: '1rem 1.25rem',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    borderBottom: '1px solid #f1f5f9',
                                                    cursor: 'pointer',
                                                    background: 'white',
                                                    transition: 'background 0.2s',
                                                    userSelect: 'none'
                                                }}
                                            >
                                                <div>
                                                    <div style={{ fontWeight: '600', color: p.boarded ? '#15803d' : '#334155', fontSize: '1rem' }}>
                                                        {p.first_name} {p.last_name}
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '4px' }}>
                                                        {p.seat_number ? (
                                                            <span style={{
                                                                color: activeTab === 'pending' ? '#d97706' : '#15803d',
                                                                fontWeight: '700',
                                                                background: activeTab === 'pending' ? '#fff7ed' : '#f0fdf4',
                                                                padding: '2px 8px',
                                                                borderRadius: '6px',
                                                                border: activeTab === 'pending' ? '1px solid #ffedd5' : '1px solid #dcfce7',
                                                                fontSize: '0.8rem'
                                                            }}>
                                                                Asiento: {p.seat_number}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>Sin asiento</span>
                                                        )}
                                                        <span style={{ background: p.is_free_under6 ? '#dcfce7' : '#f8fafc', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', color: p.is_free_under6 ? '#166534' : '#64748b' }}>
                                                            {p.is_free_under6 ? 'Menor (Gratis)' : (p.age !== undefined && p.age !== null ? `${p.age} años` : '—')}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    border: p.boarded ? 'none' : '2px solid #cbd5e1',
                                                    background: p.boarded ? '#10b981' : 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'white',
                                                    transition: 'all 0.2s',
                                                    boxShadow: p.boarded ? '0 2px 4px rgba(16, 185, 129, 0.3)' : 'none'
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
