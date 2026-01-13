'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface PassengerEdit {
    id?: string
    first_name: string
    last_name: string
    age: number | null
    congregation: string
    is_free_under6: boolean
    seat_number?: string
    isNew?: boolean
    toDelete?: boolean
}

interface ReservationData {
    id: string
    reservation_code: string
    boarding_access_code: string
    responsible_name: string
    responsible_phone: string
    responsible_congregation: string | null
    seats_total: number
    seats_payable: number
    total_amount: number
    deposit_required: number
    amount_paid: number
    status: string
    passengers: PassengerEdit[]
}

const MODIFICATION_DEADLINE = new Date('2026-03-01T23:59:59')
const PRICE_PER_SEAT = 1800

export default function ModificarReservacionPage() {
    const [step, setStep] = useState<'auth' | 'edit'>('auth')
    const [reservationCode, setReservationCode] = useState('')
    const [boardingCode, setBoardingCode] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [reservation, setReservation] = useState<ReservationData | null>(null)
    const [originalPassengerCount, setOriginalPassengerCount] = useState(0)
    const [isSaving, setIsSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [showTransferModal, setShowTransferModal] = useState(false)

    const isDeadlinePassed = new Date() > MODIFICATION_DEADLINE

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')

        try {
            const { data: resData, error: resError } = await supabase
                .from('reservations')
                .select('*')
                .ilike('reservation_code', reservationCode.trim())
                .single()

            if (resError || !resData) {
                setError('Codigo de reservacion no encontrado')
                setIsLoading(false)
                return
            }

            if (resData.boarding_access_code !== boardingCode.trim()) {
                setError('Codigo de abordaje incorrecto')
                setIsLoading(false)
                return
            }

            if (resData.status === 'cancelado') {
                setError('Esta reservacion esta cancelada')
                setIsLoading(false)
                return
            }

            const { data: passData } = await supabase
                .from('reservation_passengers')
                .select('*')
                .eq('reservation_id', resData.id)
                .order('created_at', { ascending: true })

            const passengers = (passData || []).map(p => ({
                id: p.id,
                first_name: p.first_name,
                last_name: p.last_name,
                age: p.age,
                congregation: p.congregation || '',
                is_free_under6: p.is_free_under6,
                seat_number: p.seat_number
            }))

            setReservation({ ...resData, passengers })
            setOriginalPassengerCount(passengers.filter(p => !p.is_free_under6).length)
            setStep('edit')
        } catch (err) {
            setError('Error al buscar reservacion')
        } finally {
            setIsLoading(false)
        }
    }

    const updatePassenger = (index: number, field: keyof PassengerEdit, value: any) => {
        if (!reservation) return
        const updated = [...reservation.passengers]
        updated[index] = { ...updated[index], [field]: value }
        if (field === 'age' && typeof value === 'number') {
            updated[index].is_free_under6 = value < 6
        }
        setReservation({ ...reservation, passengers: updated })
    }

    const addPassenger = () => {
        if (!reservation) return
        setReservation({
            ...reservation,
            passengers: [...reservation.passengers, {
                first_name: '',
                last_name: '',
                age: null,
                congregation: '',
                is_free_under6: false,
                isNew: true
            }]
        })
    }

    const removePassenger = (index: number) => {
        if (!reservation) return
        const updated = [...reservation.passengers]
        if (updated[index].isNew) {
            updated.splice(index, 1)
        } else {
            updated[index].toDelete = true
        }
        setReservation({ ...reservation, passengers: updated })
    }

    const restorePassenger = (index: number) => {
        if (!reservation) return
        const updated = [...reservation.passengers]
        updated[index].toDelete = false
        setReservation({ ...reservation, passengers: updated })
    }

    const calculateNewTotal = () => {
        if (!reservation) return { total: 0, payable: 0, difference: 0, activeCount: 0 }
        const activePassengers = reservation.passengers.filter(p => !p.toDelete)
        const payable = activePassengers.filter(p => !p.is_free_under6).length
        const total = payable * PRICE_PER_SEAT
        const difference = total - reservation.amount_paid
        return { total, payable, difference, activeCount: activePassengers.length }
    }

    const needsRefund = () => {
        if (!reservation) return false
        const { payable } = calculateNewTotal()
        return payable < originalPassengerCount && reservation.amount_paid > 0
    }

    const handleSave = async () => {
        if (!reservation) return
        setIsSaving(true)
        setSaveSuccess(false)

        try {
            const activePassengers = reservation.passengers.filter(p => !p.toDelete)
            const { total, payable } = calculateNewTotal()

            const toDelete = reservation.passengers.filter(p => p.toDelete && p.id)
            for (const p of toDelete) {
                await supabase.from('reservation_passengers').delete().eq('id', p.id)
            }

            const toUpdate = activePassengers.filter(p => p.id && !p.isNew)
            for (const p of toUpdate) {
                await supabase
                    .from('reservation_passengers')
                    .update({
                        first_name: p.first_name,
                        last_name: p.last_name,
                        age: p.age,
                        congregation: p.congregation,
                        is_free_under6: p.is_free_under6
                    })
                    .eq('id', p.id)
            }

            const toInsert = activePassengers.filter(p => p.isNew)
            for (const p of toInsert) {
                await supabase
                    .from('reservation_passengers')
                    .insert({
                        reservation_id: reservation.id,
                        first_name: p.first_name,
                        last_name: p.last_name,
                        age: p.age,
                        congregation: p.congregation,
                        is_free_under6: p.is_free_under6
                    })
            }

            await supabase
                .from('reservations')
                .update({
                    seats_total: activePassengers.length,
                    seats_payable: payable,
                    total_amount: total,
                    deposit_required: Math.ceil(total * 0.5),
                    responsible_phone: reservation.responsible_phone
                })
                .eq('id', reservation.id)

            setSaveSuccess(true)

            const { data: updatedRes } = await supabase.from('reservations').select('*').eq('id', reservation.id).single()
            const { data: updatedPass } = await supabase.from('reservation_passengers').select('*').eq('reservation_id', reservation.id).order('created_at', { ascending: true })

            if (updatedRes && updatedPass) {
                setReservation({
                    ...updatedRes,
                    passengers: updatedPass.map(p => ({
                        id: p.id,
                        first_name: p.first_name,
                        last_name: p.last_name,
                        age: p.age,
                        congregation: p.congregation || '',
                        is_free_under6: p.is_free_under6,
                        seat_number: p.seat_number
                    }))
                })
                setOriginalPassengerCount(updatedPass.filter(p => !p.is_free_under6).length)
            }
        } catch (err) {
            alert('Error al guardar')
        } finally {
            setIsSaving(false)
        }
    }

    const handlePayDifference = async () => {
        if (!reservation) return
        const { difference } = calculateNewTotal()
        if (difference <= 0) return

        // Calculate commission (5%)
        const commission = difference * 0.05
        const totalToPay = difference + commission

        try {
            const res = await fetch('/api/reservations/preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reservationId: reservation.id,
                    amount: totalToPay, // Send total with commission
                    description: `Pago adicional (inc. comisión) - ${reservation.reservation_code}`
                })
            })
            const data = await res.json()
            if (data.init_point) window.location.href = data.init_point
        } catch (err) {
            alert('Error al generar pago')
        }
    }

    if (isDeadlinePassed) {
        return (
            <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: '#fee2e2', padding: '2rem', borderRadius: '16px', textAlign: 'center', maxWidth: '320px' }}>
                    <h1 style={{ color: '#b91c1c', fontSize: '1.25rem', marginBottom: '0.75rem' }}>Fecha Limite Excedida</h1>
                    <p style={{ color: '#7f1d1d', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                        El periodo para modificar reservaciones finalizo el 1 de Marzo de 2026.
                    </p>
                    <Link href="/" style={{ color: '#3b82f6', fontWeight: '600', textDecoration: 'none' }}>Volver al inicio</Link>
                </div>
            </div>
        )
    }

    if (step === 'auth') {
        return (
            <div style={{ minHeight: '100vh', background: '#1e293b', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '100%', maxWidth: '340px' }}>
                    <Link href="/" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', display: 'block', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                        Volver
                    </Link>

                    <div style={{ background: 'white', padding: '2rem', borderRadius: '16px' }}>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e293b', margin: '0 0 0.5rem 0', textAlign: 'center' }}>
                            Modificar Reservacion
                        </h1>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                            Ingresa tus codigos de acceso
                        </p>

                        <form onSubmit={handleAuth}>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151', fontSize: '0.85rem' }}>
                                    Codigo de Reservacion
                                </label>
                                <input
                                    type="text"
                                    value={reservationCode}
                                    onChange={e => setReservationCode(e.target.value.toUpperCase())}
                                    placeholder="BETEL-2026-XXXXXX"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.9rem',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '10px',
                                        fontSize: '0.9rem',
                                        textTransform: 'uppercase',
                                        fontFamily: 'monospace',
                                        textAlign: 'center',
                                        background: '#f8fafc'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151', fontSize: '0.85rem' }}>
                                    Codigo de Abordaje
                                </label>
                                <input
                                    type="text"
                                    value={boardingCode}
                                    onChange={e => setBoardingCode(e.target.value)}
                                    placeholder="123456"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.9rem',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '10px',
                                        fontSize: '1.5rem',
                                        textAlign: 'center',
                                        fontFamily: 'monospace',
                                        letterSpacing: '6px',
                                        background: '#f8fafc'
                                    }}
                                />
                            </div>

                            {error && (
                                <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.85rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.85rem', textAlign: 'center' }}>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    background: '#2c3e50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontSize: '1rem',
                                    fontWeight: '700',
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                    opacity: isLoading ? 0.7 : 1
                                }}
                            >
                                {isLoading ? 'Verificando...' : 'Acceder'}
                            </button>
                        </form>
                    </div>

                    <p style={{ textAlign: 'center', marginTop: '1rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                        Fecha limite: 1 de Marzo 2026
                    </p>
                </div>
            </div>
        )
    }

    const { total, difference, activeCount } = calculateNewTotal()

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
            {/* Header */}
            <header style={{ background: '#1e293b', color: 'white', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '500px', margin: '0 auto' }}>
                    <div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>Modificando</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '700', fontFamily: 'monospace' }}>
                            {reservation?.reservation_code}
                        </div>
                    </div>
                    <Link href="/" style={{ color: 'white', background: 'rgba(255,255,255,0.15)', padding: '0.5rem 1rem', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem' }}>
                        Salir
                    </Link>
                </div>
            </header>

            <main style={{ padding: '1.25rem 1rem', maxWidth: '500px', margin: '0 auto' }}>
                {saveSuccess && (
                    <div style={{ background: '#dcfce7', color: '#166534', padding: '1rem', borderRadius: '12px', marginBottom: '1.25rem', textAlign: 'center', fontWeight: '600' }}>
                        Cambios guardados correctamente
                    </div>
                )}

                <div style={{ background: 'white', borderRadius: '16px', padding: '1rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600', color: '#1e293b', fontSize: '0.85rem' }}>
                        Teléfono del Responsable
                    </label>
                    <input
                        type="tel"
                        value={reservation?.responsible_phone || ''}
                        onChange={e => reservation && setReservation({ ...reservation, responsible_phone: e.target.value })}
                        placeholder="Ej: 961 123 4567"
                        style={{
                            width: '100%',
                            padding: '0.8rem',
                            border: '1px solid #cbd5e1',
                            borderRadius: '10px',
                            fontSize: '1rem',
                            background: '#f8fafc'
                        }}
                    />
                </div>

                {/* Passengers Section */}
                <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, color: '#1e293b' }}>
                            Pasajeros ({activeCount})
                        </h2>
                        <button
                            onClick={addPassenger}
                            style={{
                                padding: '0.5rem 1rem',
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            + Agregar
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {reservation?.passengers.map((p, idx) => (
                            <div
                                key={idx}
                                style={{
                                    background: p.toDelete ? '#fef2f2' : '#f8fafc',
                                    borderRadius: '12px',
                                    padding: '1rem',
                                    border: p.toDelete ? '2px solid #fecaca' : '1px solid #e2e8f0',
                                    opacity: p.toDelete ? 0.6 : 1
                                }}
                            >
                                {p.toDelete ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#b91c1c', textDecoration: 'line-through' }}>{p.first_name} {p.last_name}</span>
                                        <button
                                            onClick={() => restorePassenger(idx)}
                                            style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
                                        >
                                            Restaurar
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                        {/* Header with number and delete */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>Pasajero {idx + 1}</span>
                                            {p.seat_number && (
                                                <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#d97706', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: '600' }}>
                                                    Asiento #{p.seat_number}
                                                </span>
                                            )}
                                        </div>

                                        {/* Name fields - stacked on mobile */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Nombre</label>
                                            <input
                                                type="text"
                                                placeholder="Nombre"
                                                value={p.first_name}
                                                onChange={e => updatePassenger(idx, 'first_name', e.target.value)}
                                                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Apellido</label>
                                            <input
                                                type="text"
                                                placeholder="Apellido"
                                                value={p.last_name}
                                                onChange={e => updatePassenger(idx, 'last_name', e.target.value)}
                                                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                                            />
                                        </div>

                                        {/* Age and Congregation */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '0.75rem' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Edad</label>
                                                <input
                                                    type="number"
                                                    placeholder="Edad"
                                                    value={p.age || ''}
                                                    onChange={e => updatePassenger(idx, 'age', e.target.value ? parseInt(e.target.value) : null)}
                                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', textAlign: 'center' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Congregacion</label>
                                                <input
                                                    type="text"
                                                    placeholder="Congregación"
                                                    value={p.congregation}
                                                    onChange={e => updatePassenger(idx, 'congregation', e.target.value)}
                                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                                                />
                                            </div>
                                        </div>

                                        {/* Badges and delete */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            {p.is_free_under6 ? (
                                                <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#166534', padding: '0.35rem 0.65rem', borderRadius: '6px', fontWeight: '600' }}>
                                                    Menor de 6 - Gratis
                                                </span>
                                            ) : <span></span>}
                                            <button
                                                onClick={() => removePassenger(idx)}
                                                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Payment Summary */}
                <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', color: '#1e293b' }}>Resumen de Pago</h2>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                        <div style={{ textAlign: 'center', background: '#f8fafc', padding: '0.75rem', borderRadius: '10px' }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>TOTAL</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b' }}>${total.toLocaleString()}</div>
                        </div>
                        <div style={{ textAlign: 'center', background: '#f0fdf4', padding: '0.75rem', borderRadius: '10px' }}>
                            <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: '600' }}>PAGADO</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#16a34a' }}>${reservation?.amount_paid.toLocaleString()}</div>
                        </div>
                        <div style={{ textAlign: 'center', background: difference > 0 ? '#fef2f2' : '#f0fdf4', padding: '0.75rem', borderRadius: '10px' }}>
                            <div style={{ fontSize: '0.7rem', color: difference > 0 ? '#dc2626' : '#16a34a', fontWeight: '600' }}>
                                {difference > 0 ? 'PENDIENTE' : 'SALDO'}
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: difference > 0 ? '#dc2626' : '#16a34a' }}>
                                ${Math.abs(difference).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {difference > 0 && (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <button
                                onClick={handlePayDifference}
                                style={{
                                    width: '100%',
                                    padding: '0.9rem',
                                    background: '#009ee3',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: '700',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                                    <line x1="1" y1="10" x2="23" y2="10"></line>
                                </svg>
                                Pagar ${difference.toLocaleString()} (+ 5% comisión) con MercadoPago
                            </button>

                            <button
                                onClick={() => setShowTransferModal(true)}
                                style={{
                                    width: '100%',
                                    padding: '0.9rem',
                                    background: '#ffffff',
                                    color: '#2c3e50',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '10px',
                                    fontWeight: '700',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                                Pagar con Transferencia Bancaria
                            </button>
                        </div>
                    )}
                </div>

                {needsRefund() && (
                    <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                        <a
                            href={`https://wa.me/529618720544?text=${encodeURIComponent(`Solicito devolucion - ${reservation?.reservation_code}`)}`}
                            target="_blank"
                            style={{
                                width: '100%',
                                padding: '0.9rem',
                                background: '#128C7E',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: '700',
                                fontSize: '0.9rem',
                                textAlign: 'center',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                            </svg>
                            Solicitar Devolucion por WhatsApp
                        </a>
                    </div>
                )}

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{
                        width: '100%',
                        padding: '1.1rem',
                        background: '#2c3e50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '1rem',
                        fontWeight: '700',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        opacity: isSaving ? 0.7 : 1,
                        boxShadow: '0 4px 6px -1px rgba(44, 62, 80, 0.2)'
                    }}
                >
                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </main>

            {/* Modal de Transferencia */}
            {showTransferModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem',
                    zIndex: 50
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        width: '100%',
                        maxWidth: '360px',
                        position: 'relative',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
                    }}>
                        <button
                            onClick={() => setShowTransferModal(false)}
                            style={{
                                position: 'absolute',
                                top: '1rem',
                                right: '1rem',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#94a3b8'
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>

                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ background: '#f1f5f9', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                                    <line x1="1" y1="10" x2="23" y2="10"></line>
                                </svg>
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>Datos de Transferencia</h3>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Banco Destino</div>
                                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#334155' }}>Mercado Pago</div>
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Beneficiario</div>
                                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#334155' }}>Gady Hernández</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>CLABE Interbancaria</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1e293b', fontFamily: 'monospace' }}>
                                        722969010994673004
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText('722969010994673004')
                                            alert('CLABE copiada al portapapeles')
                                        }}
                                        style={{
                                            background: '#e2e8f0',
                                            border: 'none',
                                            padding: '0.4rem',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            color: '#475569'
                                        }}
                                        title="Copiar CLABE"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', lineHeight: '1.5' }}>
                            <p>Realiza la transferencia por el monto exacto de: <strong>${difference.toLocaleString()}</strong></p>
                            <p style={{ marginTop: '0.5rem' }}>
                                Una vez realizada, envía tu comprobante por WhatsApp para validar tu pago.
                            </p>
                        </div>

                        <a
                            href={`https://wa.me/529618720544?text=${encodeURIComponent(`Hola, envío comprobante de pago por diferencia de reservación: ${reservation?.reservation_code}`)}`}
                            target="_blank"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                width: '100%',
                                marginTop: '1.5rem',
                                padding: '1rem',
                                background: '#128C7E',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                textDecoration: 'none',
                                fontWeight: '600'
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                            </svg>
                            Enviar Comprobante
                        </a>
                    </div>
                </div>
            )}
        </div>
    )
}
