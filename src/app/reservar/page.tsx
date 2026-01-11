'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Passenger } from '@/types'
import { supabase } from '@/lib/supabase'
import { buildWhatsAppMessage, getWhatsAppLink } from '@/lib/whatsapp'

type Step = 'seats' | 'passengers' | 'summary' | 'confirmation'

interface ReservationResult {
    reservation_code: string
    seats_total: number
    seats_payable: number
    total_amount: number
    deposit_required: number
}

export default function ReservarPage() {
    const [step, setStep] = useState<Step>('seats')
    const [totalSeats, setTotalSeats] = useState(1)
    const [minorsCount, setMinorsCount] = useState(0)
    const [passengers, setPassengers] = useState<Passenger[]>([])
    const [responsibleName, setResponsibleName] = useState('')
    const [responsiblePhone, setResponsiblePhone] = useState('')
    const [responsibleCongregation, setResponsibleCongregation] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<ReservationResult | null>(null)
    const [error, setError] = useState('')

    const seatsPayable = totalSeats - minorsCount
    const totalAmount = seatsPayable * 1700
    const depositRequired = totalAmount * 0.5

    // Initialize passengers when moving from step 1 to 2
    const initPassengers = () => {
        const newPassengers: Passenger[] = []
        for (let i = 0; i < totalSeats; i++) {
            newPassengers.push({
                first_name: '',
                last_name: '',
                phone: '',
                congregation: '',
                age: i < minorsCount ? 5 : undefined,
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

    const handleSubmit = async () => {
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
            setStep('confirmation')
        } catch (err) {
            console.error(err)
            setError('Error al crear la reservación. Por favor intenta de nuevo.')
        } finally {
            setIsLoading(false)
        }
    }

    const renderStepIndicator = () => (
        <div className="step-indicator">
            {['seats', 'passengers', 'summary', 'confirmation'].map((s, i) => (
                <div
                    key={s}
                    className={`step-dot ${s === step ? 'active' :
                        ['seats', 'passengers', 'summary', 'confirmation'].indexOf(step) > i ? 'completed' : ''
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

                {/* STEP 1: Seats Selection */}
                {step === 'seats' && (
                    <div className="card">
                        <h2 className="section-title">¿Cuántos lugares necesitas?</h2>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '600' }}>
                                Total de personas
                            </label>
                            <div className="counter">
                                <button
                                    className="counter-btn"
                                    onClick={() => setTotalSeats(Math.max(1, totalSeats - 1))}
                                    disabled={totalSeats <= 1}
                                >
                                    −
                                </button>
                                <span className="counter-value">{totalSeats}</span>
                                <button
                                    className="counter-btn"
                                    onClick={() => setTotalSeats(totalSeats + 1)}
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '600' }}>
                                Menores de 6 años (no pagan)
                            </label>
                            <div className="counter">
                                <button
                                    className="counter-btn"
                                    onClick={() => setMinorsCount(Math.max(0, minorsCount - 1))}
                                    disabled={minorsCount <= 0}
                                >
                                    −
                                </button>
                                <span className="counter-value">{minorsCount}</span>
                                <button
                                    className="counter-btn"
                                    onClick={() => setMinorsCount(Math.min(totalSeats - 1, minorsCount + 1))}
                                    disabled={minorsCount >= totalSeats - 1}
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div style={{
                            background: '#f0f9ff',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            marginBottom: '1.5rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span>Lugares que pagan:</span>
                                <strong>{seatsPayable}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Total estimado:</span>
                                <strong style={{ color: 'var(--primary)' }}>${totalAmount.toLocaleString('es-MX')}</strong>
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
                        <h2 className="section-title">Datos de los pasajeros</h2>

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

                        {passengers.map((passenger, index) => (
                            <div key={index} className="passenger-card">
                                <div className="passenger-header">
                                    <span className="passenger-number">Pasajero {index + 1}</span>
                                    {passenger.age !== undefined && passenger.age < 6 && (
                                        <span style={{
                                            background: '#d1fae5',
                                            color: '#065f46',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem'
                                        }}>
                                            Menor (no paga)
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

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.85rem' }}>Congregación</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={passenger.congregation || ''}
                                            onChange={(e) => updatePassenger(index, 'congregation', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label" style={{ fontSize: '0.85rem' }}>Edad</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={passenger.age ?? ''}
                                            onChange={(e) => updatePassenger(index, 'age', e.target.value)}
                                            min={0}
                                            max={120}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}

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
                        <h2 className="section-title">Resumen de tu reservación</h2>

                        <div className="summary-row">
                            <span>Total de lugares</span>
                            <strong>{passengers.length}</strong>
                        </div>
                        <div className="summary-row">
                            <span>Lugares que pagan</span>
                            <strong>{passengers.filter(p => !p.age || p.age >= 6).length}</strong>
                        </div>
                        <div className="summary-row">
                            <span>Precio por lugar</span>
                            <strong>$1,700</strong>
                        </div>
                        <div className="summary-row total">
                            <span>Total</span>
                            <strong>${(passengers.filter(p => !p.age || p.age >= 6).length * 1700).toLocaleString('es-MX')}</strong>
                        </div>
                        <div className="summary-row" style={{ color: 'var(--secondary)' }}>
                            <span>Anticipo mínimo (50%)</span>
                            <strong>${(passengers.filter(p => !p.age || p.age >= 6).length * 1700 * 0.5).toLocaleString('es-MX')}</strong>
                        </div>

                        <div style={{
                            background: '#fef3c7',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            marginTop: '1.5rem',
                            marginBottom: '1.5rem',
                            color: '#92400e',
                            fontSize: '0.9rem'
                        }}>
                            <strong>Importante:</strong> Para apartar lugares es indispensable enviar al menos el 50% del total. Los asientos se asignan conforme se registre tu pago.
                        </div>

                        {error && (
                            <div style={{
                                background: '#fee2e2',
                                padding: '1rem',
                                borderRadius: '0.5rem',
                                marginBottom: '1rem',
                                color: '#991b1b'
                            }}>
                                {error}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
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
                                onClick={handleSubmit}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Procesando...' : 'Confirmar reservación'}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 4: Confirmation */}
                {step === 'confirmation' && result && (
                    <div className="card">
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '0.5rem', color: 'var(--accent)' }}>OK</div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)' }}>
                                ¡Reservación creada!
                            </h2>
                        </div>

                        <div className="confirmation-code">
                            <div className="code-label">Tu número de reservación</div>
                            <div className="code-value">{result.reservation_code}</div>
                        </div>

                        <div className="summary-row">
                            <span>Total de lugares</span>
                            <strong>{result.seats_total}</strong>
                        </div>
                        <div className="summary-row">
                            <span>Lugares que pagan</span>
                            <strong>{result.seats_payable}</strong>
                        </div>
                        <div className="summary-row total">
                            <span>Total a pagar</span>
                            <strong>${result.total_amount.toLocaleString('es-MX')}</strong>
                        </div>
                        <div className="summary-row" style={{ color: 'var(--secondary)' }}>
                            <span>Anticipo mínimo</span>
                            <strong>${result.deposit_required.toLocaleString('es-MX')}</strong>
                        </div>

                        <div style={{
                            background: '#f0fdf4',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            marginTop: '1.5rem',
                            marginBottom: '1.5rem'
                        }}>
                            <h3 style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#065f46' }}>
                                Datos para transferencia:
                            </h3>
                            <div style={{ fontSize: '0.9rem', color: '#166534' }}>
                                <div><strong>CLABE:</strong> 722969010994673004</div>
                                <div><strong>Banco:</strong> Mercado Pago</div>
                                <div><strong>Beneficiario:</strong> Gady Hernández</div>
                            </div>
                        </div>

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
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            Enviar información por WhatsApp
                        </a>

                        <button
                            className="nav-button secondary"
                            style={{ width: '100%', marginTop: '0.75rem' }}
                            onClick={() => {
                                navigator.clipboard.writeText(buildWhatsAppMessage(
                                    result.reservation_code,
                                    responsibleName,
                                    responsiblePhone,
                                    responsibleCongregation,
                                    passengers,
                                    result.seats_payable,
                                    result.total_amount,
                                    result.deposit_required
                                ))
                                alert('Mensaje copiado al portapapeles')
                            }}
                        >
                            Copiar mensaje
                        </button>

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
