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
    const totalAmount = seatsPayable * 1700
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
            setError('Error al conectar con Mercado Pago. Intenta con transferencia.')
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

                {step !== 'seats' && step !== 'confirmation' && (
                    <button
                        onClick={() => setStep(step === 'passengers' ? 'seats' : step === 'summary' ? 'passengers' : step === 'payment' ? 'summary' : 'seats')}
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
                            <label className="form-label">Congregación (Opcional)</label>
                            <input
                                type="text"
                                className="form-input"
                                value={responsibleCongregation}
                                onChange={(e) => setResponsibleCongregation(e.target.value)}
                                placeholder="Ej: Centro, Norte, Sur..."
                            />
                        </div>

                        <button
                            onClick={initPassengers}
                            className="cta-button"
                            style={{ width: '100%', marginTop: '1rem' }}
                            disabled={!responsibleName || !responsibleLastName || !isPhoneValid}
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
                            onClick={() => setStep('summary')} // Go to summary instead of create directly? Original went to summary.
                            disabled={isLoading || passengers.slice(1).some(p => !p.first_name || !p.last_name)}
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
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Método de pago</h2>

                        <div style={{ background: '#f0f7ff', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
                            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Tu reservación está lista</h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem', letterSpacing: '1px' }}>
                                {result.reservation_code}
                            </div>
                            <p>Total a pagar: <strong>${totalAmount.toLocaleString('es-MX')}</strong></p>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label className="form-label" style={{ marginBottom: '1rem', display: 'block' }}>¿Cuánto deseas pagar?</label>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    padding: '1rem',
                                    border: isDeposit ? '2px solid var(--primary)' : '1px solid #ddd',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    background: isDeposit ? '#f0f7ff' : 'white'
                                }}>
                                    <input
                                        type="radio"
                                        name="paymentType"
                                        checked={isDeposit}
                                        onChange={() => setIsDeposit(true)}
                                    />
                                    <div>
                                        <div style={{ fontWeight: '600' }}>Anticipo 50%</div>
                                        <div>${result.deposit_required.toLocaleString('es-MX')}</div>
                                    </div>
                                </label>

                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    padding: '1rem',
                                    border: !isDeposit ? '2px solid var(--primary)' : '1px solid #ddd',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    background: !isDeposit ? '#f0f7ff' : 'white'
                                }}>
                                    <input
                                        type="radio"
                                        name="paymentType"
                                        checked={!isDeposit}
                                        onChange={() => setIsDeposit(false)}
                                    />
                                    <div>
                                        <div style={{ fontWeight: '600' }}>Pago completo</div>
                                        <div>${result.total_amount.toLocaleString('es-MX')}</div>
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
                                style={{ background: '#009ee3' }}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Procesando...' : 'Pagar con tarjeta'}
                            </button>
                            <button
                                onClick={handlePayWithTransfer}
                                className="nav-button"
                                style={{ width: '100%', justifyContent: 'center' }}
                            >
                                Pagar por transferencia
                            </button>
                        </div>
                        {error && <p style={{ color: 'red', marginTop: '1rem', textAlign: 'center' }}>{error}</p>}
                    </div>
                )}

                {/* STEP 5: Confirmation */}
                {step === 'confirmation' && result && (
                    <div className="fade-in" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '4rem', color: '#27ae60', marginBottom: '1rem' }}>✓</div>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>¡Casi listo!</h2>

                        <div style={{ background: '#2c3e50', color: 'white', padding: '2rem', borderRadius: '8px', marginBottom: '2rem' }}>
                            <p style={{ opacity: 0.8, marginBottom: '0.5rem' }}>Tu número de reservación</p>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', letterSpacing: '2px' }}>
                                {result.reservation_code}
                            </div>
                        </div>

                        {paymentMethod === 'transfer' && (
                            <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                                <p style={{ fontWeight: '600', marginBottom: '1rem' }}>Datos para transferencia:</p>
                                <div style={{ background: '#f1f2f6', padding: '1rem', borderRadius: '8px', border: '1px solid #ddd' }}>
                                    <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <span>CLABE: <strong>722969010994673004</strong></span>
                                        <button
                                            onClick={handleCopyClabe}
                                            style={{ background: '#ddd', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}
                                        >
                                            Copiar
                                        </button>
                                    </div>
                                    <p style={{ margin: '0.5rem 0' }}>Banco: <strong>Mercado Pago</strong></p>
                                    <p style={{ margin: 0 }}>Beneficiario: <strong>Gady Hernández</strong></p>
                                </div>
                            </div>
                        )}

                        <p style={{ color: '#666', marginBottom: '2rem' }}>
                            Se ha descargado tu ticket de reservación. <br />
                            Envía el comprobante por WhatsApp para confirmar tu pago.
                        </p>

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
                            style={{ display: 'block', textDecoration: 'none', marginBottom: '1rem' }}
                        >
                            Enviar información por WhatsApp
                        </Link>

                        <button
                            onClick={generateTicketImage}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', textDecoration: 'underline', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.9rem' }}
                        >
                            Descargar Ticket Nuevamente
                        </button>

                        <Link href="/" style={{ color: '#666', textDecoration: 'underline', display: 'block' }}>
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
            <p style={{ textAlign: 'center', marginTop: '2rem', color: '#999', fontSize: '0.8rem' }}>
                Guarda este ticket para cualquier aclaración.
            </p>
        </div>
    )
}
