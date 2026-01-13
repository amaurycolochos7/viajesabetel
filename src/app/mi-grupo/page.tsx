'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface GroupInfo {
    group_name: string
    tour_datetime: string | null
    members: {
        first_name: string
        last_name: string
    }[]
}

interface PassengerInfo {
    first_name: string
    last_name: string
    reservation_code: string
    group: GroupInfo | null
}

export default function MiGrupoPage() {
    const [reservationCode, setReservationCode] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [passengers, setPassengers] = useState<PassengerInfo[]>([])
    const [error, setError] = useState('')
    const [searched, setSearched] = useState(false)

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!reservationCode.trim()) return

        setIsSearching(true)
        setError('')
        setSearched(true)
        setPassengers([])

        try {
            // Find reservation
            const { data: reservation, error: resError } = await supabase
                .from('reservations')
                .select('id, reservation_code')
                .ilike('reservation_code', `%${reservationCode.trim()}%`)
                .single()

            if (resError || !reservation) {
                setError('No se encontró una reservación con ese código')
                setIsSearching(false)
                return
            }

            // Find passengers for this reservation
            const { data: passengersData, error: passError } = await supabase
                .from('reservation_passengers')
                .select('id, first_name, last_name')
                .eq('reservation_id', reservation.id)

            if (passError || !passengersData || passengersData.length === 0) {
                setError('No se encontraron pasajeros para esta reservación')
                setIsSearching(false)
                return
            }

            // For each passenger, check if they are assigned to a group
            const results: PassengerInfo[] = []

            for (const passenger of passengersData) {
                const { data: memberData } = await supabase
                    .from('tour_group_members')
                    .select(`
            group_id,
            tour_groups!inner(group_name, tour_datetime)
          `)
                    .eq('passenger_id', passenger.id)
                    .single()

                let groupInfo: GroupInfo | null = null

                if (memberData) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const group = memberData.tour_groups as any

                    // Get all members of this group
                    const { data: allMembers } = await supabase
                        .from('tour_group_members')
                        .select(`
              reservation_passengers!inner(first_name, last_name)
            `)
                        .eq('group_id', memberData.group_id)

                    groupInfo = {
                        group_name: group?.group_name || '',
                        tour_datetime: group?.tour_datetime || null,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        members: (allMembers || []).map((m: any) => ({
                            first_name: m.reservation_passengers?.first_name || '',
                            last_name: m.reservation_passengers?.last_name || '',
                        }))
                    }
                }

                results.push({
                    first_name: passenger.first_name,
                    last_name: passenger.last_name,
                    reservation_code: reservation.reservation_code,
                    group: groupInfo
                })
            }

            setPassengers(results)
        } catch (err) {
            console.error(err)
            setError('Error al buscar. Intenta de nuevo.')
        } finally {
            setIsSearching(false)
        }
    }

    return (
        <main>
            <header className="page-header">
                <h1>Consultar Mi Grupo</h1>
                <p>Vamos a Betel - 7-9 de Abril 2026</p>
            </header>

            <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>
                <Link href="/" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: 'var(--primary)',
                    marginBottom: '1.5rem',
                    textDecoration: 'none',
                    fontSize: '0.95rem'
                }}>
                    ← Volver al inicio
                </Link>

                <div className="card">
                    <h2 className="section-title">Consulta tu grupo de acceso al Tour</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
                        Aquí puedes ver la información de tu grupo para el <strong>recorrido guiado dentro de las instalaciones de Betel</strong>.
                    </p>
                    <div style={{ background: '#e3f2fd', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#1565c0' }}>
                        <strong>¿Qué verás?</strong>
                        <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0 }}>
                            <li>Número de grupo asignado</li>
                            <li>Horario de acceso al tour</li>
                            <li>Lista completa de integrantes</li>
                        </ul>
                    </div>
                    <p style={{ color: '#78909c', marginBottom: '1rem', fontSize: '0.85rem' }}>
                        Ingresa tu código de reservación (aparece en la imagen que descargaste al confirmar: BETEL-2026-XXXXXX)
                    </p>

                    <form onSubmit={handleSearch}>
                        <div className="form-group">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ej: BETEL-2026-000001"
                                value={reservationCode}
                                onChange={(e) => setReservationCode(e.target.value.toUpperCase())}
                                style={{ textAlign: 'center', fontSize: '1.1rem', letterSpacing: '1px' }}
                            />
                        </div>
                        <button
                            type="submit"
                            className="nav-button"
                            style={{ width: '100%' }}
                            disabled={isSearching || !reservationCode.trim()}
                        >
                            {isSearching ? 'Buscando...' : 'Consultar'}
                        </button>
                    </form>
                </div>

                {error && (
                    <div className="alert alert-error" style={{ marginTop: '1.5rem' }}>
                        {error}
                    </div>
                )}

                {searched && passengers.length > 0 && (
                    <div style={{ marginTop: '1.5rem' }}>
                        {/* Group passengers by assignment to avoid repeating the group card */}
                        {Array.from(new Set(passengers.map(p => p.group?.group_name || 'Sin grupo')))
                            .map((groupName) => {
                                // Find all passengers in this "grouping" (sharing same assigned group, or all unassigned)
                                const groupPassengers = passengers.filter(p => (p.group?.group_name || 'Sin grupo') === groupName)
                                const firstPassenger = groupPassengers[0]
                                const groupInfo = firstPassenger.group

                                if (groupInfo) {
                                    // Case: Assigned Group
                                    return (
                                        <div key={groupName} className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #2e7d32' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                <h3 style={{ margin: 0, color: '#2e7d32' }}>{groupInfo.group_name}</h3>
                                                {groupInfo.tour_datetime && (
                                                    <span style={{
                                                        background: 'var(--primary)',
                                                        color: 'white',
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '20px',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '600'
                                                    }}>
                                                        {new Date(groupInfo.tour_datetime).toLocaleString('es-MX', {
                                                            weekday: 'short',
                                                            day: 'numeric',
                                                            month: 'short',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                )}
                                            </div>

                                            <div style={{ marginBottom: '1rem' }}>
                                                <strong>Tus viajeros en este grupo:</strong>
                                                <ul style={{ margin: '0.5rem 0 1rem 1.25rem', padding: 0 }}>
                                                    {groupPassengers.map((p, i) => (
                                                        <li key={i}>{p.first_name} {p.last_name}</li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <div style={{ background: '#f1f8e9', padding: '1rem', borderRadius: '6px' }}>
                                                <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#33691e' }}>
                                                    Lista completa del grupo ({groupInfo.members.length} personas):
                                                </strong>
                                                <ol style={{ margin: '0 0 0 1.25rem', padding: 0, color: '#555' }}>
                                                    {groupInfo.members.map((m, i) => (
                                                        <li key={i}>{m.first_name} {m.last_name}</li>
                                                    ))}
                                                </ol>
                                            </div>
                                        </div>
                                    )
                                } else {
                                    // Case: Unassigned passengers
                                    return (
                                        <div key="unassigned" className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #f57c00' }}>
                                            <h3 style={{ margin: '0 0 1rem 0', color: '#f57c00' }}>Pendientes de asignación</h3>
                                            <div style={{ background: '#fff3e0', padding: '1rem', borderRadius: '6px', color: '#e65100' }}>
                                                <p style={{ margin: '0 0 0.5rem 0' }}>
                                                    Los siguientes viajeros aún no tienen grupo asignado:
                                                </p>
                                                <ul style={{ margin: '0 0 0.5rem 1.25rem', padding: 0 }}>
                                                    {groupPassengers.map((p, i) => (
                                                        <li key={i} style={{ fontWeight: '600' }}>{p.first_name} {p.last_name}</li>
                                                    ))}
                                                </ul>
                                                <small>Se te notificará cuando sean asignados.</small>
                                            </div>
                                        </div>
                                    )
                                }
                            })}
                    </div>
                )}

                {searched && passengers.length === 0 && !error && (
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '2rem',
                        textAlign: 'center',
                        color: 'var(--text-muted)'
                    }}>
                        No se encontraron resultados
                    </div>
                )}
            </div>
        </main>
    )
}
