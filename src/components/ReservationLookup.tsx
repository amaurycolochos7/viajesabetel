'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import html2canvas from 'html2canvas'

interface ReservationInfo {
    reservation_code: string
    responsible_name: string
    responsible_phone: string
    responsible_congregation: string | null
    seats_total: number
    seats_payable: number
    total_amount: number
    deposit_required: number
    amount_paid: number
    boarding_access_code?: string
    status: 'pendiente' | 'anticipo_pagado' | 'pagado_completo' | 'cancelado'
    created_at: string
    passengers: {
        first_name: string
        last_name: string
        age?: number
        is_free_under6: boolean
        seat_number?: string
    }[]
    ticket_orders?: {
        id: string
        items: any[]
        total_amount: number
        status: string
        payment_method: string
        created_at: string
    }[]
}

// Icons
const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
)
const UsersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
)
const ChevronLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
)

export default function ReservationLookup() {
    const [mode, setMode] = useState<'buttons' | 'lookup'>('buttons')
    const [reservationCode, setReservationCode] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [reservation, setReservation] = useState<ReservationInfo | null>(null)
    const [error, setError] = useState('')
    const [showSeatMapModal, setShowSeatMapModal] = useState(false)

    const generateTicketImage = async (res: ReservationInfo) => {
        const ticketElement = document.getElementById('reservation-ticket-lookup')
        if (!ticketElement) return

        try {
            const canvas = await html2canvas(ticketElement, { scale: 2, useCORS: true })
            const image = canvas.toDataURL('image/png')
            const link = document.createElement('a')
            link.href = image
            link.download = `Ticket-Betel-${res.reservation_code}.png`
            link.click()
        } catch (err) {
            console.error('Error generating ticket:', err)
            alert('Error al generar el ticket. Intenta de nuevo.')
        }
    }

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!reservationCode.trim()) return

        setIsSearching(true)
        setError('')
        setReservation(null)

        try {
            // Find reservation
            const { data: resData, error: resError } = await supabase
                .from('reservations')
                .select('*')
                .ilike('reservation_code', `%${reservationCode.trim()}%`)
                .single()

            if (resError || !resData) {
                setError('No se encontró una reservación con ese código')
                setIsSearching(false)
                return
            }

            // Get passengers
            const { data: passengersData } = await supabase
                .from('reservation_passengers')
                .select('first_name, last_name, age, is_free_under6, seat_number')
                .eq('reservation_id', resData.id)

            // Get ticket orders
            const { data: ticketOrdersData } = await supabase
                .from('ticket_orders')
                .select('id, items, total_amount, status, payment_method, created_at')
                .eq('reservation_id', resData.id)
                .order('created_at', { ascending: false })

            setReservation({
                ...resData,
                passengers: passengersData || [],
                ticket_orders: ticketOrdersData || []
            })
        } catch (err) {
            console.error(err)
            setError('Error al buscar. Intenta de nuevo.')
        } finally {
            setIsSearching(false)
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'pendiente':
                return { text: 'Pendiente de Pago', color: '#f57c00', bg: '#fff3e0' }
            case 'anticipo_pagado':
                return { text: 'Anticipo Pagado (50%)', color: '#1976d2', bg: '#e3f2fd' }
            case 'pagado_completo':
                return { text: 'Pagado Completo', color: '#2e7d32', bg: '#e8f5e9' }
            case 'cancelado':
                return { text: 'Cancelado', color: '#c62828', bg: '#ffebee' }
            default:
                return { text: status, color: '#666', bg: '#f5f5f5' }
        }
    }

    const resetLookup = () => {
        setMode('buttons')
        setReservationCode('')
        setReservation(null)
        setError('')
    }

    if (mode === 'buttons') {
        return (
            <section className="card" style={{ marginTop: '2rem', marginBottom: '1rem', padding: '1.5rem' }}>
                <h2 style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: '#2c3e50',
                    margin: '0 0 0.5rem 0',
                    borderBottom: '2px solid #e0e0e0',
                    paddingBottom: '0.5rem',
                    display: 'inline-block'
                }}>
                    Consultar Reservación
                </h2>
                <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
                    Si ya hiciste tu reservación, puedes verificar tus datos y estado de pago.
                </p>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {/* Botón principal - Verificar Reservación */}
                    <button
                        onClick={() => setMode('lookup')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            padding: '1rem',
                            background: '#4a6da7', // JW Blue
                            color: 'white',
                            border: '1px solid #365180',
                            borderRadius: '4px', // Square-ish
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                            transition: 'background 0.2s',
                            width: '100%',
                        }}
                    >
                        <SearchIcon />
                        Verificar Mi Reservación
                    </button>

                    {/* Botón secundario - Consultar Grupo */}
                    <Link
                        href="/mi-grupo"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '1rem',
                            background: '#f8f9fa',
                            color: '#4a6da7',
                            border: '1px solid #4a6da7',
                            borderRadius: '4px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            textDecoration: 'none',
                            transition: 'background 0.2s',
                        }}
                    >
                        <UsersIcon />
                        <div style={{ textAlign: 'left' }}>
                            <div>Consultar Mi Grupo de Tour</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: '400', color: '#555', marginTop: '2px' }}>
                                Número de grupo, horario y lista de integrantes
                            </div>
                        </div>
                    </Link>

                    {/* Botón terciario - Modificar Reservación */}
                    <Link
                        href="/modificar-reservacion"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            padding: '1rem',
                            background: '#4a6da7',
                            color: 'white',
                            border: '1px solid #365180',
                            borderRadius: '4px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            textDecoration: 'none',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Modificar Mi Reservación
                    </Link>

                    {/* Botón de términos - Alineación corregida */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                        <Link
                            href="/terminos"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                color: '#555',
                                fontSize: '0.9rem',
                                textDecoration: 'none',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '4px',
                                transition: 'background 0.2s',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', color: '#777' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                </svg>
                            </div>
                            <span style={{ borderBottom: '1px solid transparent' }}>Términos y condiciones del Viaje</span>
                        </Link>
                    </div>
                </div>
            </section >
        )
    }

    return (
        <section className="card" style={{ marginBottom: '1rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, color: '#2c3e50' }}>Verificar Reservación</h2>
                <button
                    onClick={resetLookup}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#666',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                    }}
                >
                    <ChevronLeftIcon /> Volver
                </button>
            </div>

            {!reservation && (
                <form onSubmit={handleSearch}>
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#546e7a' }}>Código de Reservación</label>
                        <input
                            type="text"
                            placeholder="Ej: BETEL-A1B2-9482"
                            value={reservationCode}
                            onChange={(e) => setReservationCode(e.target.value.toUpperCase())}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                borderRadius: '8px',
                                border: '1px solid #cfd8dc',
                                fontSize: '1.25rem',
                                textAlign: 'center',
                                letterSpacing: '2px',
                                textTransform: 'uppercase',
                                outline: 'none',
                                background: '#fafafa'
                            }}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isSearching || !reservationCode.trim()}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: '#3f51b5',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: isSearching ? 'not-allowed' : 'pointer',
                            opacity: isSearching ? 0.8 : 1,
                            boxShadow: '0 2px 4px rgba(63, 81, 181, 0.2)'
                        }}
                    >
                        {isSearching ? 'Buscando...' : 'Buscar'}
                    </button>
                </form>
            )}

            {error && (
                <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    background: '#ffebee',
                    color: '#c62828',
                    borderRadius: '8px',
                    textAlign: 'center',
                    fontSize: '0.95rem'
                }}>
                    {error}
                </div>
            )}

            {reservation && (
                <div className="fade-in">
                    {/* Status Badge - Más compacto */}
                    <div style={{
                        background: getStatusLabel(reservation.status).bg,
                        color: getStatusLabel(reservation.status).color,
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        marginBottom: '1rem',
                        border: `1px solid ${getStatusLabel(reservation.status).color}30`
                    }}>
                        {getStatusLabel(reservation.status).text}
                    </div>

                    {/* Códigos de Reservación y Abordaje - Diseño Vertical */}
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '12px',
                        marginBottom: '1rem',
                        border: '1px solid #e0e0e0',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                        overflow: 'hidden'
                    }}>
                        {/* Código de Reservación */}
                        <div style={{ padding: '1rem', textAlign: 'center' }}>
                            <p style={{ margin: 0, color: '#78909c', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '1px' }}>Código de Reservación</p>
                            <p style={{
                                margin: '0.35rem 0 0',
                                fontSize: '1.1rem',
                                fontWeight: '800',
                                color: '#1565c0',
                                fontFamily: 'monospace',
                                letterSpacing: '0.5px',
                                wordBreak: 'break-all'
                            }}>
                                {reservation.reservation_code}
                            </p>
                        </div>

                        {/* Código de Abordaje - Barra destacada */}
                        {reservation.boarding_access_code && (
                            <div style={{
                                background: 'linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%)',
                                padding: '1rem',
                                borderTop: '1px dashed #ffe082',
                                textAlign: 'center'
                            }}>
                                <p style={{
                                    margin: 0,
                                    color: '#bf360c',
                                    fontSize: '0.65rem',
                                    textTransform: 'uppercase',
                                    fontWeight: '600',
                                    letterSpacing: '1px',
                                    marginBottom: '0.35rem'
                                }}>
                                    Código de Abordaje
                                </p>
                                <p style={{
                                    margin: 0,
                                    fontSize: '1.75rem',
                                    fontWeight: '900',
                                    color: '#e65100',
                                    fontFamily: 'monospace',
                                    letterSpacing: '3px'
                                }}>
                                    {reservation.boarding_access_code}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Datos del Responsable - Más Compacto */}
                    <div style={{ marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.5rem', color: '#78909c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Datos del Responsable
                        </h3>
                        <div style={{ background: '#ffffff', border: '1px solid #eceff1', padding: '0.75rem 1rem', borderRadius: '8px' }}>
                            <p style={{ margin: '0 0 0.25rem', fontSize: '0.95rem', color: '#263238', fontWeight: '600' }}>
                                {reservation.responsible_name}
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#546e7a' }}>
                                <span>📞 {reservation.responsible_phone}</span>
                                {reservation.responsible_congregation && (
                                    <span>⛪ {reservation.responsible_congregation}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Lista de Pasajeros - Diseño Mejorado */}
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h3 style={{ fontSize: '0.75rem', fontWeight: '600', margin: 0, color: '#78909c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Pasajeros
                            </h3>
                            <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '600' }}>
                                {reservation.passengers.length}
                            </span>
                        </div>
                        <div style={{ background: '#ffffff', border: '1px solid #eceff1', borderRadius: '8px', overflow: 'hidden' }}>
                            {reservation.passengers.map((p, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        borderBottom: idx < reservation.passengers.length - 1 ? '1px solid #f0f0f0' : 'none',
                                        background: idx % 2 === 0 ? '#fff' : '#fafafa'
                                    }}
                                >
                                    {/* Nombre completo */}
                                    <div style={{
                                        fontWeight: '600',
                                        color: '#263238',
                                        fontSize: '0.95rem',
                                        marginBottom: '0.35rem'
                                    }}>
                                        {p.first_name} {p.last_name}
                                    </div>

                                    {/* Badges: Asiento y Edad */}
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        {p.seat_number ? (
                                            <span style={{
                                                fontSize: '0.8rem',
                                                padding: '0.25rem 0.6rem',
                                                borderRadius: '6px',
                                                background: '#fff3e0',
                                                color: '#e65100',
                                                fontWeight: '700',
                                                border: '1px solid #ffe0b2'
                                            }}>
                                                Asiento #{p.seat_number}
                                            </span>
                                        ) : (
                                            <span style={{
                                                fontSize: '0.8rem',
                                                color: '#bdbdbd',
                                                padding: '0.25rem 0.6rem',
                                                background: '#f5f5f5',
                                                borderRadius: '6px'
                                            }}>
                                                Sin asiento
                                            </span>
                                        )}
                                        <span style={{
                                            fontSize: '0.8rem',
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: '6px',
                                            background: p.is_free_under6 ? '#e8f5e9' : '#e3f2fd',
                                            color: p.is_free_under6 ? '#2e7d32' : '#1565c0',
                                            fontWeight: '500'
                                        }}>
                                            {p.is_free_under6 ? 'Menor (Gratis)' : (p.age !== undefined && p.age !== null ? `${p.age} años` : '—')}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Button to view seat map - only if at least one passenger has a seat */}
                        {reservation.passengers.some(p => p.seat_number) && (
                            <button
                                onClick={() => setShowSeatMapModal(true)}
                                style={{
                                    width: '100%',
                                    marginTop: '0.75rem',
                                    padding: '0.75rem',
                                    background: '#2c3e50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <line x1="3" y1="9" x2="21" y2="9" />
                                    <line x1="9" y1="21" x2="9" y2="9" />
                                </svg>
                                Ver Mapa de Asientos
                            </button>
                        )}
                    </div>

                    {/* Tourist Attractions Section */}
                    {
                        reservation.ticket_orders && reservation.ticket_orders.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.5rem', color: '#78909c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Entradas Turísticas
                                </h3>
                                <div style={{ background: '#ffffff', border: '1px solid #eceff1', borderRadius: '8px', overflow: 'hidden' }}>
                                    {reservation.ticket_orders.map((order, idx) => (
                                        <div
                                            key={order.id}
                                            style={{
                                                padding: '0.75rem',
                                                borderBottom: idx < reservation.ticket_orders!.length - 1 ? '1px solid #eceff1' : 'none'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                                                <div style={{ fontSize: '0.8rem', color: '#546e7a' }}>
                                                    {new Date(order.created_at).toLocaleDateString('es-MX')} • {order.payment_method === 'card' ? 'MP' : 'Transf.'}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#10b981' }}>
                                                        ${order.total_amount.toLocaleString('es-MX')}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.6rem',
                                                        fontWeight: '600',
                                                        textTransform: 'uppercase',
                                                        padding: '0.1rem 0.3rem',
                                                        borderRadius: '3px',
                                                        background: order.status === 'paid' ? '#dcfce7' : '#fef3c7',
                                                        color: order.status === 'paid' ? '#166534' : '#d97706'
                                                    }}>
                                                        {order.status === 'paid' ? '✓' : '⏳'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div style={{ background: '#fafafa', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                                                {order.items.map((item: any, i: number) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: i < order.items.length - 1 ? '0.2rem' : 0 }}>
                                                        <span style={{ color: '#455a64' }}>{item.passengerName} — {item.name}</span>
                                                        <span style={{ fontWeight: '600' }}>${item.price}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    }

                    {/* Resumen de Pagos - Compacto */}
                    <div style={{ marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.5rem', color: '#78909c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Resumen de Pago
                        </h3>
                        <div style={{ background: '#f8f9fa', border: '1px solid #eceff1', padding: '0.75rem', borderRadius: '8px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center', marginBottom: '0.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.65rem', color: '#78909c', textTransform: 'uppercase' }}>Total</div>
                                    <div style={{ fontSize: '1rem', fontWeight: '700', color: '#263238' }}>${reservation.total_amount.toLocaleString('es-MX')}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.65rem', color: '#78909c', textTransform: 'uppercase' }}>Pagado</div>
                                    <div style={{ fontSize: '1rem', fontWeight: '700', color: '#2e7d32' }}>${reservation.amount_paid.toLocaleString('es-MX')}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.65rem', color: '#78909c', textTransform: 'uppercase' }}>Resta</div>
                                    <div style={{ fontSize: '1rem', fontWeight: '700', color: reservation.amount_paid >= reservation.total_amount ? '#2e7d32' : '#e53935' }}>
                                        ${(reservation.total_amount - reservation.amount_paid).toLocaleString('es-MX')}
                                    </div>
                                </div>
                            </div>

                            {/* Deadline Notice */}
                            {reservation.status !== 'pagado_completo' && (
                                <div style={{ background: '#fff3e0', border: '1px solid #ffe0b2', borderRadius: '6px', padding: '0.5rem', textAlign: 'center' }}>
                                    <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 'bold', color: '#e65100' }}>
                                        ⚠️ FECHA LÍMITE: 23 DE MARZO 2026
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={resetLookup}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: '#fff',
                            color: '#546e7a',
                            border: '1px solid #cfd8dc',
                            borderRadius: '8px',
                            fontSize: '0.95rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                        }}
                    >
                        Hacer otra consulta
                    </button>

                    <button
                        onClick={() => generateTicketImage(reservation)}
                        style={{
                            width: '100%',
                            marginTop: '1rem',
                            padding: '1rem',
                            background: '#2c3e50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '0.95rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        Descargar Ticket Oficial
                    </button>
                </div >
            )
            }

            {
                reservation && (
                    <div style={{ position: 'absolute', top: -9999, left: -9999, width: '800px' }}>
                        <TicketTemplate reservation={reservation} />
                    </div>
                )
            }

            {/* Seat Map Modal */}
            {showSeatMapModal && reservation && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.85)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100,
                        padding: '1rem'
                    }}
                    onClick={() => setShowSeatMapModal(false)}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '20px',
                            padding: '1.5rem',
                            width: '100%',
                            maxWidth: '340px',
                            maxHeight: '90vh',
                            overflowY: 'auto'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#1e293b' }}>Tus Asientos</h3>
                            <button
                                onClick={() => setShowSeatMapModal(false)}
                                style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b' }}
                            >x</button>
                        </div>

                        {/* Legend */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginBottom: '1rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: '#64748b' }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#3b82f6', border: '2px solid #1d4ed8' }}></div>
                                Tuyo
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: '#64748b' }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#e2e8f0', border: '1px solid #cbd5e1' }}></div>
                                Otro
                            </div>
                        </div>

                        {/* Bus Layout */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {Array.from({ length: 12 }, (_, rowIdx) => {
                                const baseNum = rowIdx * 4 + 1
                                const leftSeats = [baseNum, baseNum + 1].filter(n => n <= 47)
                                const rightSeats = [baseNum + 2, baseNum + 3].filter(n => n <= 47)
                                const mySeats = reservation.passengers.map(p => p.seat_number).filter(Boolean)

                                return (
                                    <div key={rowIdx} style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            {leftSeats.map(num => {
                                                const isMine = mySeats.includes(num.toString())
                                                return (
                                                    <div
                                                        key={num}
                                                        style={{
                                                            width: '34px',
                                                            height: '34px',
                                                            borderRadius: '6px',
                                                            border: isMine ? '2px solid #1d4ed8' : '1px solid #cbd5e1',
                                                            background: isMine ? '#3b82f6' : '#e2e8f0',
                                                            color: isMine ? 'white' : '#94a3b8',
                                                            fontWeight: '700',
                                                            fontSize: '0.8rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                    >
                                                        {num}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <div style={{ width: '16px' }}></div>
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            {rightSeats.map(num => {
                                                const isMine = mySeats.includes(num.toString())
                                                return (
                                                    <div
                                                        key={num}
                                                        style={{
                                                            width: '34px',
                                                            height: '34px',
                                                            borderRadius: '6px',
                                                            border: isMine ? '2px solid #1d4ed8' : '1px solid #cbd5e1',
                                                            background: isMine ? '#3b82f6' : '#e2e8f0',
                                                            color: isMine ? 'white' : '#94a3b8',
                                                            fontWeight: '700',
                                                            fontSize: '0.8rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                    >
                                                        {num}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Your seats list */}
                        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#eff6ff', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: '600', marginBottom: '0.5rem' }}>Tus asientos asignados:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {reservation.passengers.filter(p => p.seat_number).map((p, idx) => (
                                    <span key={idx} style={{ background: '#3b82f6', color: 'white', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600' }}>
                                        #{p.seat_number} - {p.first_name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section >
    )
}

function TicketTemplate({ reservation }: { reservation: ReservationInfo }) {
    return (
        <div id="reservation-ticket-lookup" style={{
            background: 'white',
            padding: '2.5rem',
            fontFamily: 'sans-serif',
            color: '#333',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '3px solid #1565c0', paddingBottom: '1.5rem' }}>
                <h1 style={{ color: '#1565c0', margin: '0 0 0.5rem 0', fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-1px' }}>Vamos a Betel</h1>
                <p style={{ fontSize: '1.1rem', color: '#546e7a', margin: 0, fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1px' }}>7 al 10 de Abril, 2026</p>
            </div>

            {/* Main Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2rem', marginBottom: '2rem' }}>
                <div>
                    <p style={{ fontSize: '0.85rem', color: '#78909c', margin: '0 0 0.25rem 0', textTransform: 'uppercase', fontWeight: '600' }}>Responsable</p>
                    <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: '#263238' }}>{reservation.responsible_name}</h2>
                    <p style={{ fontSize: '1rem', color: '#455a64', margin: 0 }}>Tel: {reservation.responsible_phone}</p>
                    <p style={{ fontSize: '1rem', color: '#455a64', margin: '0.25rem 0 0 0' }}>{reservation.responsible_congregation}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.85rem', color: '#78909c', margin: '0 0 0.25rem 0', textTransform: 'uppercase', fontWeight: '600' }}>Código Reservación</p>
                    <h2 style={{ fontSize: '2rem', margin: '0', color: '#1565c0', fontFamily: 'monospace', letterSpacing: '2px' }}>{reservation.reservation_code}</h2>
                    {reservation.boarding_access_code && (
                        <div style={{ marginTop: '1rem' }}>
                            <p style={{ fontSize: '0.85rem', color: '#ef6c00', margin: '0 0 0.25rem 0', textTransform: 'uppercase', fontWeight: 'bold' }}>Acceso de Abordaje</p>
                            <h2 style={{ fontSize: '1.75rem', margin: '0', color: '#e65100', fontFamily: 'monospace', letterSpacing: '2px' }}>{reservation.boarding_access_code}</h2>
                        </div>
                    )}
                </div>
            </div>

            {/* Passengers Table */}
            <div style={{ marginBottom: '2rem' }}>
                <a style={{ display: 'block', background: '#f5f5f5', padding: '0.75rem', borderRadius: '8px 8px 0 0', fontWeight: '700', color: '#37474f', borderBottom: '2px solid #cfd8dc' }}>
                    Lista de Pasajeros ({reservation.passengers.length})
                </a>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8f9fa', fontSize: '0.85rem', color: '#546e7a', textAlign: 'left' }}>
                            <th style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>#</th>
                            <th style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>Nombre Completo</th>
                            <th style={{ padding: '0.75rem', borderBottom: '1px solid #eee', textAlign: 'center' }}>Edad</th>
                            <th style={{ padding: '0.75rem', borderBottom: '1px solid #eee', textAlign: 'right' }}>Asiento Asignado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reservation.passengers.map((p, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #eceff1' }}>
                                <td style={{ padding: '0.75rem', color: '#90a4ae', width: '40px' }}>{i + 1}</td>
                                <td style={{ padding: '0.75rem', fontWeight: '600', color: '#263238' }}>{p.first_name} {p.last_name}</td>
                                <td style={{ padding: '0.75rem', color: '#546e7a', textAlign: 'center' }}>
                                    {p.is_free_under6 ? 'Menor (Gratis)' : (p.age !== undefined && p.age !== null ? `${p.age} años` : '—')}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                    {p.seat_number ? (
                                        <span style={{
                                            background: '#ffe0b2',
                                            color: '#e65100',
                                            padding: '4px 12px',
                                            borderRadius: '4px',
                                            fontWeight: '800',
                                            fontSize: '1.25rem',
                                            display: 'inline-block'
                                        }}>
                                            {p.seat_number}
                                        </span>
                                    ) : (
                                        <span style={{ color: '#bdbdbd', fontStyle: 'italic', fontSize: '0.9rem' }}>Pendiente</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eceff1', padding: '1.5rem', borderRadius: '8px', borderLeft: '6px solid #1565c0' }}>
                <div>
                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: '#546e7a' }}>Estado del Pago</p>
                    <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#263238' }}>
                        {reservation.status === 'pagado_completo' ? 'PAGADO (100%)' : reservation.status === 'anticipo_pagado' ? 'ANTICIPO (50%)' : 'PENDIENTE'}
                    </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#78909c' }}>Soporte (Dudas y Pagos)</p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 'bold', color: '#1565c0' }}>
                        961 872 0544
                    </p>
                </div>
            </div>

            {/* Payment Deadline Notice - Only show if not fully paid */}
            {reservation.status !== 'pagado_completo' && (
                <div style={{ marginTop: '1.5rem', background: '#fff3e0', border: '2px solid #ff9800', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#e65100', fontWeight: '700', textTransform: 'uppercase' }}>FECHAS LÍMITE DE PAGO</p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.1rem', fontWeight: '800', color: '#ef6c00' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 'normal', display: 'block', textTransform: 'uppercase' }}>Fecha Límite</span>
                        23 de Marzo, 2026
                    </p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#7e3c00', lineHeight: '1.4' }}>
                        Debes completar el pago del viaje antes de esta fecha.<br />
                        Contacta al administrador por WhatsApp para realizar tu pago.
                    </p>
                </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <p style={{ fontSize: '0.8rem', color: '#b0bec5', margin: 0 }}>Este documento sirve como comprobante de tu reservación para el viaje.</p>
            </div>
        </div>
    )
}
