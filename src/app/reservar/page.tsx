'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Passenger } from '@/types'
import { supabase } from '@/lib/supabase'
import { buildWhatsAppMessage, getWhatsAppLink } from '@/lib/whatsapp'
import html2canvas from 'html2canvas'

type Step = 'seats' | 'passengers' | 'summary' | 'payment' | 'confirmation'
type PaymentMethod = 'card' | 'transfer' | null

interface ReservationResult {
    reservation_code: string
    boarding_access_code?: string
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
    const [responsibleLastName, setResponsibleLastName] = useState('')
    const [responsiblePhone, setResponsiblePhone] = useState('')
    const [responsibleCongregation, setResponsibleCongregation] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<ReservationResult | null>(null)
    const [error, setError] = useState('')
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null)
    const [isDeposit, setIsDeposit] = useState(true)

    const totalSeats = adultsCount + childrenCount
    const seatsPayable = adultsCount
    const totalAmount = seatsPayable * 1800
    const depositRequired = totalAmount * 0.5

    // Solo permite números y máximo 10 dígitos
    const handlePhoneChange = (value: string) => {
        const numbersOnly = value.replace(/\D/g, '').slice(0, 10)
        setResponsiblePhone(numbersOnly)
    }

    const initPassengers = () => {
        const newPassengers: Passenger[] = []

        // Si solo hay 1 adulto, el responsable ES ese adulto (no pedir de nuevo)
        const startAdultIndex = adultsCount === 1 && childrenCount === 0 ? 0 : 0

        // Adultos adicionales (si el responsable ya cuenta como 1)
        for (let i = 0; i < adultsCount; i++) {
            // Si es 1 solo adulto sin niños, usamos los datos del responsable
            if (adultsCount === 1 && childrenCount === 0) {
                newPassengers.push({
                    first_name: responsibleName,
                    last_name: responsibleLastName,
                    phone: responsiblePhone,
                    congregation: responsibleCongregation,
                    age: undefined,
                    observations: '',
                })
            } else {
                // Primer adulto = responsable
                if (i === 0) {
                    newPassengers.push({
                        first_name: responsibleName,
                        last_name: responsibleLastName,
                        phone: responsiblePhone,
                        congregation: responsibleCongregation,
                        age: undefined,
                        observations: '',
                    })
                } else {
                    newPassengers.push({
                        first_name: '',
                        last_name: '',
                        phone: '',
                        congregation: '',
                        age: undefined,
                        observations: '',
                    })
                }
            }
        }

        // Niños
        for (let i = 0; i < childrenCount; i++) {
            newPassengers.push({
                first_name: '',
                last_name: '',
                phone: '',
                congregation: '',
                age: 5,
                observations: '',
            })
        }

        setPassengers(newPassengers)

        // Si es 1 adulto sin niños, saltar directo a resumen
        if (adultsCount === 1 && childrenCount === 0) {
            setStep('summary')
        } else {
            setStep('passengers')
        }
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
                p_responsible_name: `${responsibleName} ${responsibleLastName}`,
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

    const generateTicketImage = async () => {
        const ticketElement = document.getElementById('reservation-ticket')
        if (!ticketElement || !result) return

        try {
            // Wait a bit for rendering
            await new Promise(resolve => setTimeout(resolve, 500))
            const canvas = await html2canvas(ticketElement, { scale: 2, useCORS: true })
            const image = canvas.toDataURL('image/png')
            const link = document.createElement('a')
            link.href = image
            link.download = `Ticket-Betel-${result.reservation_code}.png`
            link.click()
        } catch (err) {
            console.error('Error generating ticket:', err)
        }
    }

    const handlePayWithCard = async () => {
        if (!result) return

        // Generate ticket implicitly on intent to pay, or at least try
        generateTicketImage()

        setIsLoading(true)
        setError('')

        try {
            const response = await fetch('/api/mp/create-preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reservationCode: result.reservation_code,
                    responsibleName: `${responsibleName} ${responsibleLastName}`,
                    totalAmount: result.total_amount,
                    seatsPayable: result.seats_payable,
                    isDeposit,
                }),
            })

            const data = await response.json()

            if (data.error) {
                throw new Error(data.error)
            }

            if (data.initPoint) {
                // Delay slightly to allow download to start
                setTimeout(() => {
                    window.location.href = data.initPoint
                }, 1500)
            } else if (data.sandboxInitPoint) {
                setTimeout(() => {
                    window.location.href = data.sandboxInitPoint
                }, 1500)
            } else {
                throw new Error('No se recibió URL de pago')
            }
        } catch (err) {
            console.error(err)
            const msg = err instanceof Error ? err.message : 'Error al conectar con Mercado Pago'
            setError(msg)
            setIsLoading(false)
        }
    }

    const handlePayWithTransfer = () => {
        setPaymentMethod('transfer')
        generateTicketImage()
        setStep('confirmation')
    }

    const handleCopyClabe = () => {
        navigator.clipboard.writeText('722969010994673004')
        alert('CLABE copiada al portapapeles')
    }

    const renderStepIndicator = () => {
        const steps = adultsCount === 1 && childrenCount === 0
            ? ['seats', 'summary', 'payment', 'confirmation']
            : ['seats', 'passengers', 'summary', 'payment', 'confirmation']

        return (
            <div className="step-indicator">
                {steps.map((s, i) => (
                    <div
                        key={s}
                        className={`step-dot ${s === step ? 'active' : steps.indexOf(step) > i ? 'completed' : ''}`}
                    />
                ))}
            </div>
        )
    }

    const isPhoneValid = responsiblePhone.length === 10

    return (
        <main style={{ minHeight: '100vh', background: '#f5f6fa', padding: '1rem', fontFamily: 'var(--font-geist-sans)' }}>
            {/* Render hidden ticket for capture */}
            {result && (
                <ReservationTicket
                    result={result}
                    passengers={passengers}
                    responsibleName={responsibleName}
                    responsibleLastName={responsibleLastName}
                    totalAmount={result.total_amount}
                    isDeposit={isDeposit}
                />
            )}

            <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '1.5rem', overflow: 'hidden' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                        Vamos a Betel
                    </h1>
                    <p style={{ color: '#666' }}>7-9 de Abril 2026</p>
                </div>

                {step !== 'seats' && (step !== 'confirmation' || paymentMethod === 'transfer') && (
                    <button
                        onClick={() => {
                            if (step === 'confirmation') {
                                setStep('payment')
                            } else {
                                setStep(step === 'passengers' ? 'seats' : step === 'summary' ? 'passengers' : step === 'payment' ? 'summary' : 'seats')
                            }
                        }}
                        style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
                    >
                        ← Volver
                    </button>
                )}

                {step !== 'confirmation' && renderStepIndicator()}

                {/* STEP 1: Seats Selection */}
                {step === 'seats' && (
                    <div className="fade-in">
                        <h2 className="section-title">¿Quiénes viajan?</h2>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label className="form-label">Adultos ($1,700)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <button
                                    onClick={() => setAdultsCount(Math.max(1, adultsCount - 1))}
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '1.25rem' }}
                                >
                                    -
                                </button>
                                <span style={{ fontSize: '1.25rem', fontWeight: '600', minWidth: '30px', textAlign: 'center' }}>{adultsCount}</span>
                                <button
                                    onClick={() => setAdultsCount(Math.min(10, adultsCount + 1))}
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '1.25rem' }}
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        {/* ... children input ... */}
                        <div style={{ marginBottom: '2rem' }}>
                            <label className="form-label">Niños (5-11 años) ($1,700)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <button
                                    onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))}
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '1.25rem' }}
                                >
                                    -
                                </button>
                                <span style={{ fontSize: '1.25rem', fontWeight: '600', minWidth: '30px', textAlign: 'center' }}>{childrenCount}</span>
                                <button
                                    onClick={() => setChildrenCount(Math.min(10, childrenCount + 1))}
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '1.25rem' }}
                                >
                                    +
                                </button>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>Menores de 5 años no pagan (viajan en piernas).</p>
                        </div>

                        <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span>Total asientos:</span>
                                <strong>{totalSeats}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                <span>Total a pagar:</span>
                                <span>${totalAmount.toLocaleString('es-MX')}</span>
                            </div>
                        </div>

                        <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />

                        <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Datos del responsable</h3>

                        <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div>
                                <label className="form-label">Nombre *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={responsibleName}
                                    onChange={(e) => setResponsibleName(e.target.value)}
                                    placeholder="Nombre"
                                />
                            </div>
                            <div>
                                <label className="form-label">Apellido *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={responsibleLastName}
                                    onChange={(e) => setResponsibleLastName(e.target.value)}
                                    placeholder="Apellido"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Teléfono (10 dígitos) *</label>
                            <input
                                type="tel"
                                className="form-input"
                                value={responsiblePhone}
                                onChange={(e) => handlePhoneChange(e.target.value)}
                                placeholder="Ej: 9611234567"
                                maxLength={10}
                                inputMode="numeric"
                                pattern="[0-9]*"
                            />
                            {responsiblePhone && !isPhoneValid && (
                                <p style={{ color: '#c62828', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                    Debe ser un número de 10 dígitos
                                </p>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Congregación *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={responsibleCongregation}
                                onChange={(e) => setResponsibleCongregation(e.target.value)}
                                placeholder="Ej: Centro, Norte, Sur..."
                            />
                        </div>

                        <button
                            onClick={() => {
                                const missing = []
                                if (!responsibleName) missing.push('Nombre')
                                if (!responsibleLastName) missing.push('Apellido')
                                if (!isPhoneValid) missing.push('Teléfono válido (10 dígitos)')
                                if (!responsibleCongregation) missing.push('Congregación')

                                if (missing.length > 0) {
                                    alert(`Por favor completa los siguientes campos para continuar:\n- ${missing.join('\n- ')}`)
                                    return
                                }

                                initPassengers()
                            }}
                            className="cta-button"
                            style={{ width: '100%', marginTop: '1rem' }}
                        >
                            Continuar
                        </button>
                    </div>
                )}

                {/* STEP 2: Additional Passengers */}
                {step === 'passengers' && (
                    <div className="fade-in">
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>Datos de los viajeros</h2>

                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--primary)' }}>Responsable de la reserva</h3>
                            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}>
                                <p style={{ margin: 0, fontWeight: '600' }}>{responsibleName} {responsibleLastName}</p>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>{responsiblePhone}</p>
                            </div>
                        </div>

                        {passengers.map((p, idx) => (
                            // Skip default responsible slot unless logic dictates otherwise, but typically passengers[0] is responsible
                            // If user is alone, we skip this step entirely in initPassengers
                            (idx > 0) && (
                                <div key={idx} style={{ marginBottom: '2rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>
                                        {p.age !== undefined ? `Niño ${idx - adultsCount + 1}` : `Adulto ${idx + 1}`}
                                    </h3>
                                    <div style={{ display: 'grid', gap: '1rem' }}>
                                        <input
                                            type="text"
                                            placeholder="Nombre"
                                            className="form-input"
                                            value={p.first_name}
                                            onChange={e => updatePassenger(idx, 'first_name', e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Apellidos"
                                            className="form-input"
                                            value={p.last_name}
                                            onChange={e => updatePassenger(idx, 'last_name', e.target.value)}
                                        />
                                        {p.age !== undefined && (
                                            <input
                                                type="number"
                                                className="form-input"
                                                placeholder="Edad"
                                                value={p.age ?? ''}
                                                onChange={(e) => updatePassenger(idx, 'age', e.target.value)}
                                                min={0}
                                                max={5}
                                            />
                                        )}
                                    </div>
                                </div>
                            )
                        ))}

                        <button
                            className="cta-button"
                            style={{ width: '100%' }}
                            onClick={() => {
                                const hasEmptyFields = passengers.slice(1).some(p => !p.first_name || !p.last_name)
                                if (hasEmptyFields) {
                                    alert('Por favor completa los nombres y apellidos de todos los viajeros extra.')
                                    return
                                }
                                setStep('summary')
                            }}
                            disabled={isLoading}
                        >
                            Continuar
                        </button>
                    </div>
                )}

                {/* STEP 3: Summary (Optional, but good for review) */}
                {step === 'summary' && (
                    <div className="fade-in">
                        <h2 className="section-title">Confirma los datos</h2>
                        <div className="summary-row">
                            <span>Total asientos</span>
                            <strong>{totalSeats}</strong>
                        </div>
                        <div className="summary-row">
                            <span>Total a pagar</span>
                            <strong>${totalAmount.toLocaleString('es-MX')}</strong>
                        </div>

                        <div style={{ marginTop: '1.5rem' }}>
                            <button
                                onClick={handleCreateReservation}
                                className="cta-button"
                                style={{ width: '100%' }}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Creando reservación...' : 'Confirmar y Pagar'}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 4: Payment */}
                {step === 'payment' && result && (
                    <div className="fade-in">
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', fontWeight: 'bold', color: '#1a1a1a' }}>Método de pago</h2>

                        <div style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reservación</h3>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)', letterSpacing: '1px', fontFamily: 'monospace' }}>
                                        {result.reservation_code}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.9rem', color: '#666' }}>Total</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>${totalAmount.toLocaleString('es-MX')}</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label className="form-label" style={{ marginBottom: '1rem', display: 'block', fontWeight: '600' }}>¿Cuánto deseas pagar hoy?</label>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {/* Option 1: Deposit */}
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    padding: '1.25rem',
                                    border: isDeposit ? '2px solid var(--primary)' : '1px solid #e0e0e0',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    background: isDeposit ? '#f0f7ff' : 'white',
                                    transition: 'all 0.2s ease',
                                    boxShadow: isDeposit ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                                }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        width: '24px', height: '24px', borderRadius: '50%',
                                        border: isDeposit ? '6px solid var(--primary)' : '2px solid #ccc',
                                        background: 'white'
                                    }}></div>
                                    <input
                                        type="radio"
                                        name="paymentType"
                                        checked={isDeposit}
                                        onChange={() => setIsDeposit(true)}
                                        style={{ display: 'none' }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '600', fontSize: '1.1rem', color: isDeposit ? 'var(--primary-dark)' : 'inherit' }}>Pagar Anticipo (50%)</div>
                                        <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.2rem' }}>Liquidas antes del viaje</div>
                                    </div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: isDeposit ? 'var(--primary)' : '#333' }}>
                                        ${result.deposit_required.toLocaleString('es-MX')}
                                    </div>
                                </label>

                                {/* Option 2: Full Payment */}
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    padding: '1.25rem',
                                    border: !isDeposit ? '2px solid var(--primary)' : '1px solid #e0e0e0',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    background: !isDeposit ? '#f0f7ff' : 'white',
                                    transition: 'all 0.2s ease',
                                    boxShadow: !isDeposit ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                                }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        width: '24px', height: '24px', borderRadius: '50%',
                                        border: !isDeposit ? '6px solid var(--primary)' : '2px solid #ccc',
                                        background: 'white'
                                    }}></div>
                                    <input
                                        type="radio"
                                        name="paymentType"
                                        checked={!isDeposit}
                                        onChange={() => setIsDeposit(false)}
                                        style={{ display: 'none' }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '600', fontSize: '1.1rem', color: !isDeposit ? 'var(--primary-dark)' : 'inherit' }}>Pagar Completo (100%)</div>
                                        <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.2rem' }}>¡Dejas todo listo!</div>
                                    </div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: !isDeposit ? 'var(--primary)' : '#333' }}>
                                        ${result.total_amount.toLocaleString('es-MX')}
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <button
                                onClick={() => {
                                    setPaymentMethod('card')
                                    handlePayWithCard()
                                }}
                                className="cta-button"
                                style={{
                                    background: 'linear-gradient(135deg, #009ee3 0%, #007bb0 100%)',
                                    border: 'none',
                                    padding: '1rem',
                                    fontSize: '1.1rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                                    boxShadow: '0 4px 6px rgba(0,158,227, 0.2)'
                                }}
                                disabled={isLoading}
                            >
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                                {isLoading ? 'Procesando...' : 'Pagar con Tarjeta'}
                            </button>

                            <button
                                onClick={handlePayWithTransfer}
                                className="nav-button"
                                style={{
                                    width: '100%',
                                    justifyContent: 'center',
                                    background: 'white',
                                    color: 'var(--primary)',
                                    border: '2px solid var(--border-color)',
                                    padding: '1rem',
                                    fontSize: '1rem',
                                    height: 'auto'
                                }}
                            >
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                                Pagar con Transferencia
                            </button>
                        </div>
                        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '1rem', borderRadius: '8px', marginTop: '1rem', textAlign: 'center', border: '1px solid #fca5a5' }}>{error}</div>}
                    </div>
                )}

                {/* STEP 5: Confirmation */}
                {step === 'confirmation' && result && (
                    <div className="fade-in" style={{ textAlign: 'center' }}>
                        <div style={{ margin: '0 auto 1.5rem', width: '80px', height: '80px', background: '#e8f5e9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>

                        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', fontWeight: 'bold', color: '#1a1a1a' }}>¡Casi listo!</h2>
                        <p style={{ color: '#666', marginBottom: '2rem' }}>
                            Tu lugar ha sido apartado. <br />
                            {paymentMethod === 'transfer' ? 'Realiza el pago para confirmar.' : 'Completa el proceso.'}
                        </p>

                        <div style={{ background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)', color: 'white', padding: '2rem', borderRadius: '16px', marginBottom: '2rem', boxShadow: '0 10px 20px -5px rgba(44, 62, 80, 0.3)' }}>
                            <p style={{ opacity: 0.8, marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Tu número de reservación</p>
                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', letterSpacing: '2px', fontFamily: 'monospace', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                                {result.reservation_code}
                            </div>

                            {result.boarding_access_code && (
                                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                    <p style={{ opacity: 0.8, marginBottom: '0.25rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#ffb74d', fontWeight: 'bold' }}>⭐ Tu código de abordaje ⭐</p>
                                    <div style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '1px', color: '#ffcc80' }}>
                                        {result.boarding_access_code}
                                    </div>
                                </div>
                            )}
                        </div>

                        {paymentMethod === 'transfer' && (
                            <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ fontWeight: '600', margin: 0, fontSize: '1.1rem', color: '#333' }}>Datos para transferencia</h3>
                                    <button
                                        onClick={() => setStep('payment')}
                                        style={{ fontSize: '0.9rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                                    >
                                        Cambiar método
                                    </button>
                                </div>
                                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
                                    <div style={{ padding: '1.25rem', borderBottom: '1px solid #eee' }}>
                                        <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>CLABE Interbancaria</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '1.2rem', fontWeight: '600', fontFamily: 'monospace', color: '#333' }}>722969010994673004</span>
                                            <button
                                                onClick={handleCopyClabe}
                                                style={{
                                                    background: '#f1f2f6', border: 'none', borderRadius: '6px',
                                                    width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    cursor: 'pointer', color: '#666'
                                                }}
                                                title="Copiar CLABE"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ padding: '1.25rem', background: '#f8f9fa', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Banco</div>
                                            <div style={{ fontWeight: '600', color: '#333' }}>Mercado Pago</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Beneficiario</div>
                                            <div style={{ fontWeight: '600', color: '#333' }}>Gady Hernández</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ background: '#fff3cd', color: '#856404', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', fontSize: '0.95rem', border: '1px solid #ffeeba' }}>
                            <p style={{ margin: 0 }}>
                                <strong>Importante:</strong> Envía tu comprobante por WhatsApp para confirmar tu pago y asegurar tus lugares.
                            </p>
                        </div>

                        <Link
                            href={getWhatsAppLink(buildWhatsAppMessage(
                                result.reservation_code,
                                `${responsibleName} ${responsibleLastName}`,
                                responsiblePhone,
                                responsibleCongregation,
                                passengers,
                                result.seats_payable,
                                result.total_amount,
                                result.deposit_required
                            ))}
                            target="_blank"
                            className="cta-button"
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                                textDecoration: 'none', marginBottom: '1rem',
                                background: '#25D366' // WhatsApp brand color
                            }}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                            Enviar comprobante por WhatsApp
                        </Link>

                        <button
                            onClick={generateTicketImage}
                            style={{
                                background: 'transparent',
                                border: '2px solid #e0e0e0', color: '#666',
                                borderRadius: '8px', padding: '0.75rem', width: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Descargar Ticket
                        </button>

                        <Link href="/" style={{ color: '#999', textDecoration: 'none', display: 'block', marginTop: '1.5rem', fontSize: '0.9rem' }}>
                            Volver al inicio
                        </Link>
                    </div>
                )}
            </div>
        </main>
    )
}

function ReservationTicket({ result, passengers, responsibleName, responsibleLastName, totalAmount, isDeposit }: {
    result: ReservationResult
    passengers: Passenger[]
    responsibleName: string
    responsibleLastName: string
    totalAmount: number
    isDeposit: boolean
}) {
    return (
        <div
            id="reservation-ticket"
            style={{
                position: 'absolute',
                top: '-9999px',
                left: '-9999px',
                width: '600px', // Fixed width for consistent image
                background: 'white',
                padding: '2rem',
                fontFamily: 'sans-serif',
                color: '#333'
            }}
        >
            <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid var(--primary)', paddingBottom: '1rem' }}>
                <h1 style={{ color: 'var(--primary)', margin: 0, fontSize: '2rem' }}>Vamos a Betel</h1>
                <p style={{ fontSize: '1.2rem', color: '#666', margin: '0.5rem 0 0' }}>7-9 de Abril 2026</p>
            </div>

            <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#666', textTransform: 'uppercase' }}>Código de Reservación</p>
                <h2 style={{ margin: '0.5rem 0 0', fontSize: '2.5rem', letterSpacing: '2px', color: '#2c3e50' }}>{result.reservation_code}</h2>
                {result.boarding_access_code && (
                    <div style={{ marginTop: '1rem', borderTop: '1px dashed #ccc', paddingTop: '1rem' }}>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' }}>Código de Abordaje</p>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: 'bold', color: '#e65100', letterSpacing: '1px' }}>
                            {result.boarding_access_code}
                        </p>
                    </div>
                )}
            </div>

            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>Responsable</h3>
                <p style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0 }}>{responsibleName} {responsibleLastName}</p>
                <p style={{ margin: '0.25rem 0 0', color: '#666' }}>{passengers.length} viajeros</p>
            </div>

            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>Lista de Pasajeros</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8f9fa', fontSize: '0.9rem', textAlign: 'left' }}>
                            <th style={{ padding: '0.5rem' }}>#</th>
                            <th style={{ padding: '0.5rem' }}>Nombre</th>
                            <th style={{ padding: '0.5rem' }}>Tipo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {passengers.map((p, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '0.5rem', color: '#666' }}>{i + 1}</td>
                                <td style={{ padding: '0.5rem', fontWeight: '500' }}>{p.first_name} {p.last_name}</td>
                                <td style={{ padding: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                    {p.age !== undefined ? 'Niño' : 'Adulto'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--primary)', color: 'white', padding: '1.5rem', borderRadius: '8px' }}>
                <div>
                    <p style={{ margin: 0, opacity: 0.9 }}>Total a Pagar</p>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
                        ${totalAmount.toLocaleString('es-MX')}
                    </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, opacity: 0.9 }}>{isDeposit ? 'Anticipo' : 'Pago Completo'}</p>
                    <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
                        {isDeposit ? '50%' : '100%'}
                    </p>
                </div>
            </div>
            <p style={{ textAlign: 'center', marginTop: '2rem', color: '#999', fontSize: '0.9rem' }}>
                Guarda este ticket para cualquier aclaración.<br />
                <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Dudas o comprobantes: 961 872 0544</span>
            </p>
        </div>
    )
}
