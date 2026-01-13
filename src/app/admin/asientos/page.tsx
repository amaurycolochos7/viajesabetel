'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface PassengerSeat {
    seat_number: string
    first_name: string
    last_name: string
    reservation_id: string
}

interface ReservationInfo {
    id: string
    reservation_code: string
    responsible_name: string
    responsible_phone: string
    passengers: PassengerSeat[]
}

const TOTAL_SEATS = 47

export default function AsientosPage() {
    const [seatMap, setSeatMap] = useState<Map<string, { passenger: string; reservationId: string }>>(new Map())
    const [reservations, setReservations] = useState<Map<string, ReservationInfo>>(new Map())
    const [selectedReservation, setSelectedReservation] = useState<ReservationInfo | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [stats, setStats] = useState({ occupied: 0, available: 0 })

    useEffect(() => {
        loadData()

        const channel = supabase
            .channel('seats-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reservation_passengers' }, () => {
                loadData()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    const loadData = async () => {
        // Load all passengers with seats - including empty string check
        const { data: passengers, error } = await supabase
            .from('reservation_passengers')
            .select('seat_number, first_name, last_name, reservation_id')

        if (error) {
            console.error('Error loading passengers:', error)
        }

        // Load reservations
        const { data: resData } = await supabase
            .from('reservations')
            .select('id, reservation_code, responsible_name, responsible_phone, status')
            .neq('status', 'cancelado')

        // Build seat map - filter for valid seat numbers
        const newSeatMap = new Map<string, { passenger: string; reservationId: string }>()
        const reservationPassengers = new Map<string, PassengerSeat[]>()

        passengers?.forEach(p => {
            // Check if seat_number exists and is not empty
            if (p.seat_number && p.seat_number.trim() !== '') {
                newSeatMap.set(p.seat_number.trim(), {
                    passenger: `${p.first_name} ${p.last_name}`,
                    reservationId: p.reservation_id
                })

                if (!reservationPassengers.has(p.reservation_id)) {
                    reservationPassengers.set(p.reservation_id, [])
                }
                reservationPassengers.get(p.reservation_id)!.push({
                    ...p,
                    seat_number: p.seat_number.trim()
                } as PassengerSeat)
            }
        })

        // Build reservation info map
        const resMap = new Map<string, ReservationInfo>()
        resData?.forEach(r => {
            resMap.set(r.id, {
                ...r,
                passengers: reservationPassengers.get(r.id) || []
            })
        })

        setSeatMap(newSeatMap)
        setReservations(resMap)
        setStats({
            occupied: newSeatMap.size,
            available: TOTAL_SEATS - newSeatMap.size
        })
        setIsLoading(false)
    }

    const handleSeatClick = (seatNum: number) => {
        const seatKey = seatNum.toString()
        const seatInfo = seatMap.get(seatKey)
        if (seatInfo) {
            const reservation = reservations.get(seatInfo.reservationId)
            if (reservation) {
                setSelectedReservation(reservation)
            }
        }
    }

    const SeatButton = ({ num }: { num: number }) => {
        const seatKey = num.toString()
        const seatInfo = seatMap.get(seatKey)
        const isOccupied = !!seatInfo

        return (
            <button
                onClick={() => handleSeatClick(num)}
                style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '8px',
                    border: isOccupied ? '3px solid #991b1b' : '2px solid #16a34a',
                    background: isOccupied ? '#ef4444' : '#dcfce7',
                    color: isOccupied ? 'white' : '#166534',
                    fontWeight: '800',
                    fontSize: '0.95rem',
                    cursor: isOccupied ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isOccupied ? '0 2px 6px rgba(239, 68, 68, 0.5)' : 'none'
                }}
            >
                {num}
            </button>
        )
    }

    if (isLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                <p style={{ color: '#64748b' }}>Cargando mapa de asientos...</p>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: '#1e293b' }}>
            {/* Header */}
            <header style={{ background: '#0f172a', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                    <Link href="/admin" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem' }}>
                        Volver
                    </Link>
                    <h1 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, color: 'white' }}>Mapa de Asientos</h1>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ background: '#16a34a', padding: '0.35rem 0.75rem', borderRadius: '6px', color: 'white', fontWeight: '600', fontSize: '0.85rem' }}>
                        {stats.available} Libres
                    </span>
                    <span style={{ background: '#dc2626', padding: '0.35rem 0.75rem', borderRadius: '6px', color: 'white', fontWeight: '600', fontSize: '0.85rem' }}>
                        {stats.occupied} Ocupados
                    </span>
                    <span style={{ background: '#3b82f6', padding: '0.35rem 0.75rem', borderRadius: '6px', color: 'white', fontWeight: '600', fontSize: '0.85rem' }}>
                        Total: {stats.occupied}/{TOTAL_SEATS}
                    </span>
                </div>
            </header>

            <main style={{ padding: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                <div style={{
                    background: 'white',
                    borderRadius: '20px',
                    padding: '1.5rem',
                    maxWidth: '320px',
                    width: '100%'
                }}>
                    {/* Driver - LEFT SIDE */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        marginBottom: '1.25rem',
                        paddingBottom: '1rem',
                        borderBottom: '2px dashed #e2e8f0'
                    }}>
                        <div style={{
                            width: '50px',
                            height: '50px',
                            background: '#334155',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '0.65rem',
                            fontWeight: '700',
                            textAlign: 'center',
                            lineHeight: 1.2
                        }}>
                            CHOFER
                        </div>
                        <div style={{ flex: 1, height: '2px', background: '#e2e8f0' }}></div>
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#64748b' }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: '#dcfce7', border: '2px solid #16a34a' }}></div>
                            Libre
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#64748b' }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: '#ef4444', border: '2px solid #991b1b' }}></div>
                            Ocupado
                        </div>
                    </div>

                    {/* Seats Grid - 2+2 configuration */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {Array.from({ length: 12 }, (_, rowIdx) => {
                            const baseNum = rowIdx * 4 + 1
                            const leftSeats = [baseNum, baseNum + 1].filter(n => n <= TOTAL_SEATS)
                            const rightSeats = [baseNum + 2, baseNum + 3].filter(n => n <= TOTAL_SEATS)

                            return (
                                <div key={rowIdx} style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                                        {leftSeats.map(num => (
                                            <SeatButton key={num} num={num} />
                                        ))}
                                    </div>
                                    <div style={{ width: '24px' }}></div>
                                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                                        {rightSeats.map(num => (
                                            <SeatButton key={num} num={num} />
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', marginTop: '1.25rem' }}>
                        Toca un asiento rojo para ver detalles
                    </p>
                </div>
            </main>

            {/* Modal */}
            {selectedReservation && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.8)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        zIndex: 50
                    }}
                    onClick={() => setSelectedReservation(null)}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '20px 20px 0 0',
                            padding: '1.5rem',
                            width: '100%',
                            maxWidth: '400px',
                            maxHeight: '70vh',
                            overflowY: 'auto'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Reservacion</div>
                                <div style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', fontFamily: 'monospace' }}>
                                    {selectedReservation.reservation_code}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedReservation(null)}
                                style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
                            >x</button>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Encargado</div>
                            <div style={{ fontWeight: '600', color: '#1e293b' }}>{selectedReservation.responsible_name}</div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{selectedReservation.responsible_phone}</div>
                        </div>

                        <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', marginBottom: '0.5rem' }}>
                            Pasajeros con asiento ({selectedReservation.passengers.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {selectedReservation.passengers.map((p, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#fef3c7', borderRadius: '8px' }}>
                                    <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.9rem' }}>{p.first_name} {p.last_name}</span>
                                    <span style={{ fontWeight: '700', color: '#d97706', fontSize: '0.9rem' }}>#{p.seat_number}</span>
                                </div>
                            ))}
                        </div>

                        <Link
                            href={`/admin/reservaciones/${selectedReservation.id}`}
                            style={{ display: 'block', marginTop: '1rem', padding: '0.75rem', background: '#2c3e50', color: 'white', textAlign: 'center', borderRadius: '10px', textDecoration: 'none', fontWeight: '600' }}
                        >
                            Ver Reservacion Completa
                        </Link>
                    </div>
                </div>
            )}
        </div>
    )
}
