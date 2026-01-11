'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Passenger } from '@/types'
import { supabase } from '@/lib/supabase'
import { buildWhatsAppMessage, getWhatsAppLink } from '@/lib/whatsapp'

type Step = 'seats' | 'passengers' | 'summary' | 'payment' | 'confirmation'
type PaymentMethod = 'card' | 'transfer' | null

interface ReservationResult {
    reservation_code: string
    seats_total: number
    seats_payable: number
    total_amount: number
    deposit_required: number
}

export default function ReservarPage() {
    const [step, setStep] = useState<Step>('seats')
    const [adultsCount, setAdultsCount] = useState(1)
    const [childrenCount, setChildrenCount] = useState(0)
    const [passengers, setPassengers] = useState<Passenger[]>([])
    const [responsibleName, setResponsibleName] = useState('')
    const [responsiblePhone, setResponsiblePhone] = useState('')
    const [responsibleCongregation, setResponsibleCongregation] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<ReservationResult | null>(null)
    const [error, setError] = useState('')
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null)
    const [isDeposit, setIsDeposit] = useState(true)

    const totalSeats = adultsCount + childrenCount
    const seatsPayable = adultsCount // Solo adultos pagan
    const totalAmount = seatsPayable * 1700
    const depositRequired = totalAmount * 0.5

    const initPassengers = () => {
        const newPassengers: Passenger[] = []
        // Primero adultos
        for (let i = 0; i < adultsCount; i++) {
            newPassengers.push({
                first_name: '',
                last_name: '',
                phone: '',
                congregation: '',
                age: undefined,
                observations: '',
            })
        }
        // Luego niños
        for (let i = 0; i < childrenCount; i++) {
            newPassengers.push({
                first_name: '',
                last_name: '',
                phone: '',
                congregation: '',
                age: 5, // Menor de 6 por defecto
                observations: '',
            })
        }
        setPassengers(newPassengers)
        setStep('passengers')
    }

    const updatePassenger = (index: number, field: keyof Passenger, value: string | number) => {
        const updated = [...passengers]
        if (field === 'age') {
            updated[index][field] = value === '' ? undefined : Number(value)
        } else {
            updated[index][field] = value as string
        }
        setPassengers(updated)
    }

    const handleCreateReservation = async () => {
        setIsLoading(true)
        setError('')

        try {
            const { data, error: rpcError } = await supabase.rpc('create_reservation', {
                p_responsible_name: responsibleName,
                p_responsible_phone: responsiblePhone,
                p_responsible_congregation: responsibleCongregation || null,
                p_passengers: passengers,
            })

            if (rpcError) throw rpcError

            setResult(data as ReservationResult)
            setStep('payment')
        } catch (err) {
            console.error(err)
            setError('Error al crear la reservación. Por favor intenta de nuevo.')
        } finally {
            setIsLoading(false)
        }
    }

    const handlePayWithCard = async () => {
        if (!result) return
        setIsLoading(true)

        try {
            const response = await fetch('/api/mp/create-preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reservationCode: result.reservation_code,
                    responsibleName,
                    totalAmount: result.total_amount,
                    seatsPayable: result.seats_payable,
                    isDeposit,
                }),
            })

            const data = await response.json()

            if (data.sandboxInitPoint) {
                window.location.href = data.sandboxInitPoint
            } else if (data.initPoint) {
                window.location.href = data.initPoint
            }
        } catch (err) {
            console.error(err)
            setError('Error al procesar el pago')
            setIsLoading(false)
        }
    }

    const handlePayWithTransfer = () => {
        setPaymentMethod('transfer')
        setStep('confirmation')
    }

    const renderStepIndicator = () => (
        <div className="step-indicator">
            {['seats', 'passengers', 'summary', 'payment', 'confirmation'].map((s, i) => (
                <div
                    key={s}
                    className={`step-dot ${s === step ? 'active' :
                        ['seats', 'passengers', 'summary', 'payment', 'confirmation'].indexOf(step) > i ? 'completed' : ''
                        }`}
                />
            ))}
        </div>
    )

    return (
        <main>
            <header className="page-header">
                <h1>Reservar Lugares</h1>
                <p>Vamos a Betel - 7-9 de Abril 2026</p>
            </header>

            <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>
                <Link href="/" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: 'var(--primary)',
                    marginBottom: '1rem',
                    textDecoration: 'none',
                    fontSize: '0.95rem'
                }}>
                    ← Volver al inicio
                </Link>

                {renderStepIndicator()}

                {/* STEP 1: Seats Selection - Simplified */}
                {step === 'seats' && (
                    <div className="card">
                        <h2 className="section-title">¿Quiénes viajan?</h2>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '600' }}>
                                Adultos y niños mayores de 6 años
                            </label>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                $1,700 por persona
                            </p>
                            <div className="counter">
                                <button
                                    className="counter-btn"
                                    onClick={() => setAdultsCount(Math.max(1, adultsCount - 1))}
                                    disabled={adultsCount <= 1}
                                >
                                    −
                                </button>
                                <span className="counter-value">{adultsCount}</span>
                                <button
                                    className="counter-btn"
                                    onClick={() => setAdultsCount(adultsCount + 1)}
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '600' }}>
                                Niños menores de 6 años
                            </label>
                            <p style={{ fontSize: '0.85rem', color: '#2e7d32', marginBottom: '0.75rem' }}>
                                Gratis
                            </p>
                            <div className="counter">
                                <button
                                    className="counter-btn"
                                    onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))}
                                    disabled={childrenCount <= 0}
                                >
                                    −
                                </button>
                                <span className="counter-value">{childrenCount}</span>
                                <button
                                    className="counter-btn"
                                    onClick={() => setChildrenCount(childrenCount + 1)}
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div style={{
                            background: '#f0f4f8',
                            padding: '1rem',
                            borderRadius: '4px',
                            marginBottom: '1.5rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span>Total de viajeros:</span>
                                <strong>{totalSeats}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Total a pagar:</span>
                                <strong style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>
                                    ${totalAmount.toLocaleString('es-MX')}
                                </strong>
                            </div>
                        </div>

                        <button className="nav-button" style={{ width: '100%' }} onClick={initPassengers}>
                            Siguiente →
                        </button>
                    </div>
                )}

                {/* STEP 2: Passenger Forms */}
                {step === 'passengers' && (
                    <div className="card">
                        <h2 className="section-title">Datos de los viajeros</h2>

                        <div className="form-group">
                            <label className="form-label">Nombre del responsable *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={responsibleName}
                                onChange={(e) => setResponsibleName(e.target.value)}
                                placeholder="Nombre completo"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Teléfono del responsable *</label>
                            <input
                                type="tel"
                                className="form-input"
                                value={responsiblePhone}
                                onChange={(e) => setResponsiblePhone(e.target.value)}
                                placeholder="10 dígitos"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Congregación</label>
                            <input
                                type="text"
                                className="form-input"
                                value={responsibleCongregation}
                                onChange={(e) => setResponsibleCongregation(e.target.value)}
                                placeholder="Ej: Centro, Norte, Sur..."
                            />
                        </div>

                        <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />

                        {passengers.map((passenger, index) => {
                            const isChild = passenger.age !== undefined && passenger.age < 6
                            return (
                                <div key={index} className="passenger-card">
                                    <div className="passenger-header">
                                        <span className="passenger-number">
                                            {isChild ? `Niño ${index - adultsCount + 1}` : `Adulto ${index + 1}`}
                                        </span>
                                        {isChild && (
                                            <span style={{
                                                background: '#e8f5e9',
                                                color: '#2e7d32',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem'
                                            }}>
                                                Gratis
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        <div>
                                            <label className="form-label" style={{ fontSize: '0.85rem' }}>Nombre *</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={passenger.first_name}
                                                onChange={(e) => updatePassenger(index, 'first_name', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="form-label" style={{ fontSize: '0.85rem' }}>Apellido *</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={passenger.last_name}
                                                onChange={(e) => updatePassenger(index, 'last_name', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {isChild && (
                                        <div style={{ marginTop: '0.75rem' }}>
                                            <label className="form-label" style={{ fontSize: '0.85rem' }}>Edad del niño *</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                style={{ maxWidth: '100px' }}
                                                value={passenger.age ?? ''}
                                                onChange={(e) => updatePassenger(index, 'age', e.target.value)}
                                                min={0}
                                                max={5}
                                            />
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                            <button
                                className="nav-button secondary"
                                style={{ flex: 1 }}
                                onClick={() => setStep('seats')}
                            >
                                ← Atrás
                            </button>
                            <button
                                className="nav-button"
                                style={{ flex: 1 }}
                                onClick={() => setStep('summary')}
                                disabled={!responsibleName || !responsiblePhone || passengers.some(p => !p.first_name || !p.last_name)}
                            >
                                Siguiente →
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: Summary */}
                {step === 'summary' && (
                    <div className="card">
                        <h2 className="section-title">Confirma tu reservación</h2>

                        <div className="summary-row">
                            <span>Adultos</span>
                            <strong>{adultsCount}</strong>
                        </div>
                        {childrenCount > 0 && (
                            <div className="summary-row">
                                <span>Niños menores de 6</span>
                                <strong>{childrenCount} (gratis)</strong>
                            </div>
                        )}
                        <div className="summary-row">
                            <span>Precio por adulto</span>
                            <strong>$1,700</strong>
                        </div>
                        <div className="summary-row total">
                            <span>Total</span>
                            <strong>${totalAmount.toLocaleString('es-MX')}</strong>
                        </div>

                        <div className="alert alert-warning" style={{ marginTop: '1.5rem' }}>
                            <strong>Importante:</strong> Para apartar lugares es necesario enviar al menos el 50% (${depositRequired.toLocaleString('es-MX')}).
                        </div>

                        {error && (
                            <div className="alert alert-error">
                                {error}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <button
                                className="nav-button secondary"
                                style={{ flex: 1 }}
                                onClick={() => setStep('passengers')}
                            >
                                ← Atrás
                            </button>
                            <button
                                className="nav-button"
                                style={{ flex: 1 }}
                                onClick={handleCreateReservation}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Procesando...' : 'Confirmar →'}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 4: Payment Method Selection */}
                {step === 'payment' && result && (
                    <div className="card">
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <div style={{
                                background: 'var(--primary)',
                                color: 'white',
                                padding: '1rem',
                                borderRadius: '4px'
                            }}>
                                <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Tu código de reservación</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '1px' }}>
                                    {result.reservation_code}
                                </div>
                            </div>
                        </div>

                        <h3 className="section-title">¿Cómo deseas pagar?</h3>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="paymentType"
                                    checked={isDeposit}
                                    onChange={() => setIsDeposit(true)}
                                />
                                <span>Anticipo 50% — <strong>${result.deposit_required.toLocaleString('es-MX')}</strong></span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="paymentType"
                                    checked={!isDeposit}
                                    onChange={() => setIsDeposit(false)}
                                />
                                <span>Pago completo — <strong>${result.total_amount.toLocaleString('es-MX')}</strong></span>
                            </label>
                        </div>

                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <button
                                className="nav-button"
                                style={{
                                    width: '100%',
                                    background: '#009ee3',
                                }}
                                onClick={handlePayWithCard}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Redirigiendo...' : 'Pagar con tarjeta'}
                            </button>

                            <button
                                className="nav-button secondary"
                                style={{ width: '100%' }}
                                onClick={handlePayWithTransfer}
                            >
                                Pagar por transferencia
                            </button>
                        </div>

                        {error && (
                            <div className="alert alert-error" style={{ marginTop: '1rem' }}>
                                {error}
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 5: Confirmation */}
                {step === 'confirmation' && result && (
                    <div className="card">
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#2e7d32' }}>
                                ✓
                            </div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                                Reservación confirmada
                            </h2>
                        </div>

                        <div className="confirmation-code">
                            <div className="code-label">Tu número de reservación</div>
                            <div className="code-value">{result.reservation_code}</div>
                        </div>

                        <div className="summary-row">
                            <span>Total de viajeros</span>
                            <strong>{result.seats_total}</strong>
                        </div>
                        <div className="summary-row total">
                            <span>Total a pagar</span>
                            <strong>${result.total_amount.toLocaleString('es-MX')}</strong>
                        </div>

                        {paymentMethod === 'transfer' && (
                            <div style={{
                                background: '#f8f9fa',
                                padding: '1rem',
                                borderRadius: '4px',
                                marginTop: '1.5rem',
                                border: '1px solid var(--border-color)'
                            }}>
                                <h3 style={{ fontWeight: '600', marginBottom: '0.75rem' }}>
                                    Datos para transferencia:
                                </h3>
                                <div className="bank-info">
                                    <div className="bank-row">
                                        <span className="bank-label">CLABE:</span>
                                        <span className="bank-value">722969010994673004</span>
                                    </div>
                                    <div className="bank-row">
                                        <span className="bank-label">Banco:</span>
                                        <span className="bank-value">Mercado Pago</span>
                                    </div>
                                    <div className="bank-row">
                                        <span className="bank-label">Beneficiario:</span>
                                        <span className="bank-value">Gady Hernández</span>
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                                    Envía el comprobante por WhatsApp para confirmar tu pago.
                                </p>
                            </div>
                        )}

                        <a
                            href={getWhatsAppLink(buildWhatsAppMessage(
                                result.reservation_code,
                                responsibleName,
                                responsiblePhone,
                                responsibleCongregation,
                                passengers,
                                result.seats_payable,
                                result.total_amount,
                                result.deposit_required
                            ))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="whatsapp-button"
                            style={{ marginTop: '1.5rem' }}
                        >
                            Enviar información por WhatsApp
                        </a>

                        <Link href="/" className="nav-button secondary" style={{
                            display: 'block',
                            width: '100%',
                            marginTop: '0.75rem',
                            textAlign: 'center',
                            textDecoration: 'none'
                        }}>
                            Volver al inicio
                        </Link>
                    </div>
                )}
            </div>
        </main>
    )
}
