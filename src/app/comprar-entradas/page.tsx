'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// Define activities constants
const ACTIVITIES = {
    aztlan: {
        id: 'aztlan',
        name: 'Aztlán Parque Urbano',
        variants: [
            { id: 'aztlan_infant', name: 'Infantil / Rueda (<1.29m)', price: 350 },
            { id: 'aztlan_plus', name: 'Plus / Rueda (>1.29m)', price: 600 }
        ]
    },
    acuario: {
        id: 'acuario',
        name: 'Acuario Veracruz',
        variants: [
            { id: 'acuario_adult', name: 'Adulto', price: 170 },
            { id: 'acuario_child', name: 'Niño (2+ años)', price: 110 }
        ]
    },
    blumia: {
        id: 'blumia',
        name: 'Blumia',
        variants: [
            { id: 'blumia_adult', name: 'Adulto', price: 159 },
            { id: 'blumia_child', name: 'Niño', price: 89 }
        ]
    }
}

type ActivityId = keyof typeof ACTIVITIES

interface CartItem {
    activityId: ActivityId
    variantId: string
    quantity: number
    price: number
    name: string
    variantName: string
    passengerId: string
    passengerName: string
}

interface Reservation {
    id: string
    reservation_code: string
    responsible_name: string
    seats_total: number
}

interface Passenger {
    id: string
    first_name: string
    last_name: string
    age: number | null
    seat_number: string | null
}

// Wrapper component to handle Suspense for useSearchParams
function BuyTicketsContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const initialActivity = searchParams.get('activity') as ActivityId | null

    const [step, setStep] = useState<'lookup' | 'selection' | 'payment'>('lookup')
    const [reservationCode, setReservationCode] = useState('')
    const [reservation, setReservation] = useState<Reservation | null>(null)
    const [passengers, setPassengers] = useState<Passenger[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    // Cart State
    const [cart, setCart] = useState<CartItem[]>([])
    const [currentActivity, setCurrentActivity] = useState<ActivityId>(initialActivity && ACTIVITIES[initialActivity] ? initialActivity : 'aztlan')

    // UI State for Selection
    const [showPassengerSelector, setShowPassengerSelector] = useState<{ variantId: string, variantName: string, price: number } | null>(null)

    // Payment State
    const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'card'>('transfer')

    // --- STEP 1: LOOKUP ---
    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!reservationCode.trim()) return

        setIsLoading(true)
        setError('')

        try {
            const searchValue = reservationCode.trim()
            const { data, error } = await supabase
                .from('reservations')
                .select('id, reservation_code, responsible_name, seats_total')
                .or(`reservation_code.ilike.%${searchValue}%,responsible_phone.ilike.%${searchValue}%`)
                .limit(1)
                .single()

            if (error || !data) {
                setError('No encontramos tu reservación. Verifica el folio o teléfono.')
                setIsLoading(false)
                return
            }

            // Fetch Passengers
            const { data: passengersData, error: passError } = await supabase
                .from('reservation_passengers')
                .select('id, first_name, last_name, age, seat_number')
                .eq('reservation_id', data.id)

            if (passError) throw passError

            setReservation(data)
            setPassengers(passengersData || [])
            setStep('selection')
        } catch (err) {
            console.error(err)
            setError('Error al buscar. Inténtalo de nuevo.')
        } finally {
            setIsLoading(false)
        }
    }

    // --- STEP 2: SELECTION ---

    // Helper to check if passenger already has a ticket for CURRENT activity
    const hasTicketForCurrentActivity = (passengerId: string) => {
        return cart.some(item => item.activityId === currentActivity && item.passengerId === passengerId)
    }

    const togglePassengerSelection = (passenger: Passenger, variantId: string, price: number, variantName: string) => {
        const isSelected = cart.some(item =>
            item.activityId === currentActivity &&
            item.variantId === variantId &&
            item.passengerId === passenger.id
        )

        if (isSelected) {
            // Remove
            setCart(prev => prev.filter(item => !(item.activityId === currentActivity && item.passengerId === passenger.id)))
        } else {
            // Add
            // Check if already has ANY ticket for this activity (maybe different variant)
            if (hasTicketForCurrentActivity(passenger.id)) {
                // Remove the old one first strictly if we want to switch? 
                // Or just block? Let's block implies they must uncheck the other one first.
                // Or easier: auto-replace.
                // Let's simple: Auto remove other variants for same activity, then add this one.
                setCart(prev => {
                    const filtered = prev.filter(item => !(item.activityId === currentActivity && item.passengerId === passenger.id))
                    return [...filtered, {
                        activityId: currentActivity,
                        variantId: variantId,
                        quantity: 1, // Always 1 per person per activity
                        price: price,
                        name: ACTIVITIES[currentActivity].name,
                        variantName: variantName,
                        passengerId: passenger.id,
                        passengerName: `${passenger.first_name} ${passenger.last_name}`
                    }]
                })
            } else {
                setCart(prev => [...prev, {
                    activityId: currentActivity,
                    variantId: variantId,
                    quantity: 1,
                    price: price,
                    name: ACTIVITIES[currentActivity].name,
                    variantName: variantName,
                    passengerId: passenger.id,
                    passengerName: `${passenger.first_name} ${passenger.last_name}`
                }])
            }
        }
    }

    const removeFromCart = (passengerId: string, activityId: string) => {
        setCart(prev => prev.filter(item => !(item.activityId === activityId && item.passengerId === passengerId)))
    }

    const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)

    // --- STEP 3: PAYMENT ---
    const handleCreateOrder = async () => {
        if (!reservation || cart.length === 0) return

        setIsLoading(true)
        try {
            // Calculate final amounts
            const isCard = paymentMethod === 'card'
            const commission = isCard ? cartTotal * 0.05 : 0
            const finalTotal = cartTotal + commission

            // 1. Create Order in DB
            const { data: orderData, error: orderError } = await supabase
                .from('ticket_orders')
                .insert({
                    reservation_id: reservation.id,
                    items: cart, // We keep original items in JSON for record
                    total_amount: finalTotal, // Save the TOTAL amount including commission
                    payment_method: paymentMethod,
                    status: 'pending' // Default pending
                })
                .select()
                .single()

            if (orderError) throw orderError

            // 2. Generate and download PDF immediately (for both methods)
            try {
                const { generateTicketPDF } = await import('@/utils/generateTicketPDF')
                generateTicketPDF(orderData, {
                    reservation_code: reservation.reservation_code,
                    responsible_name: reservation.responsible_name
                })
            } catch (pdfError) {
                console.error('Error generating PDF:', pdfError)
                // Don't block the flow if PDF fails
            }

            if (paymentMethod === 'transfer') {
                // For transfer, redirect to confirmation
                router.push(`/comprar-entradas/confirmacion?status=pending&order=${orderData.id}&method=transfer`)
            } else {
                // MercadoPago - Generate preference and redirect
                setIsLoading(true) // Keep loading state

                // Prepare items for MercadoPago (Add commission if applicable)
                const mpItems = [...cart]
                if (commission > 0) {
                    mpItems.push({
                        name: 'Comisión por servicio (5%)',
                        variantName: 'MercadoPago',
                        price: commission,
                        quantity: 1,
                        activityId: 'commission' as any,
                        passengerId: 'system',
                        passengerName: 'Sistema',
                        variantId: 'commission'
                    })
                }

                const response = await fetch('/api/tickets/preference', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId: orderData.id,
                        items: mpItems,
                        payerName: reservation.responsible_name,
                        reservationCode: reservation.reservation_code
                    })
                })

                const prefData = await response.json()
                if (prefData.error) throw new Error(prefData.error)

                // Small delay to ensure PDF download starts
                await new Promise(resolve => setTimeout(resolve, 500))

                // Redirect to MercadoPago
                if (prefData.initPoint) {
                    window.location.href = prefData.initPoint
                } else {
                    throw new Error('No se recibió URL de pago')
                }
            }

        } catch (err: any) {
            console.error(err)
            alert('Error al crear la orden: ' + err.message)
            setIsLoading(false)
        }
    }


    // --- RENDER ---

    return (
        <main style={{ minHeight: '100vh', background: '#f5f6fa', padding: '2rem 1rem' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>

                {/* Header */}
                <header style={{ background: 'var(--primary)', padding: '1.5rem', textAlign: 'center', color: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <h1 style={{
                        margin: 0,
                        fontSize: '1.75rem',
                        fontFamily: 'var(--font-luckiest), cursive',
                        letterSpacing: '3px',
                        color: '#ffffff',
                        textShadow: '2px 2px 0px rgba(0,0,0,0.2)'
                    }}>
                        COMPRAR ENTRADAS
                    </h1>
                    {step !== 'lookup' && reservation && (
                        <p style={{ margin: '0.5rem 0 0', opacity: 0.9, color: '#f8fafc', fontWeight: '500', fontSize: '0.9rem', letterSpacing: '0.5px' }}>
                            RESERVACIÓN: <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold' }}>{reservation.reservation_code}</span>
                        </p>
                    )}
                </header>

                <div style={{ padding: '2rem' }}>

                    {/* Payment Deadline Notice - Dos tarjetas visuales */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', color: '#c62828', fontSize: '0.85rem', fontWeight: 'bold', textAlign: 'center' }}>
                            FECHAS LÍMITE
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            {/* Tarjeta 1: Adelanto 50% */}
                            <div style={{
                                background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                                borderRadius: '10px',
                                padding: '0.75rem',
                                textAlign: 'center',
                                color: 'white',
                                boxShadow: '0 3px 10px rgba(255, 152, 0, 0.3)'
                            }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 'bold', marginBottom: '0.15rem' }}>ADELANTO 50%</div>
                                <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', opacity: 0.9, marginBottom: '0.2rem' }}>Fecha Límite</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: '900' }}>25 ENE 2026</div>
                            </div>
                            {/* Tarjeta 2: Liquidar viaje */}
                            <div style={{
                                background: 'linear-gradient(135deg, #e53935 0%, #c62828 100%)',
                                borderRadius: '10px',
                                padding: '0.75rem',
                                textAlign: 'center',
                                color: 'white',
                                boxShadow: '0 3px 10px rgba(229, 57, 53, 0.3)'
                            }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 'bold', marginBottom: '0.15rem' }}>LIQUIDAR VIAJE</div>
                                <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', opacity: 0.9, marginBottom: '0.2rem' }}>Fecha Límite</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: '900' }}>23 MAR 2026</div>
                            </div>
                        </div>
                    </div>

                    {/* STEP 1: LOOKUP */}
                    {step === 'lookup' && (
                        <form onSubmit={handleLookup}>
                            <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#546e7a' }}>
                                Ingresa tu folio de reservación o número de teléfono
                            </p>
                            <input
                                type="text"
                                placeholder="Ej: BETEL-XXXX o 9611234567"
                                value={reservationCode}
                                onChange={(e) => setReservationCode(e.target.value.toUpperCase())}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    border: '1px solid #cfd8dc',
                                    fontSize: '1.25rem',
                                    textAlign: 'center',
                                    textTransform: 'uppercase',
                                    marginBottom: '1.5rem',
                                    background: '#fafafa'
                                }}
                            />
                            {error && <p style={{ color: 'red', textAlign: 'center', marginBottom: '1rem' }}>{error}</p>}
                            <button
                                type="submit"
                                disabled={isLoading || !reservationCode}
                                className="cta-button"
                                style={{ width: '100%' }}
                            >
                                {isLoading ? 'Buscando...' : 'Continuar'}
                            </button>
                            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                                <Link href="/" style={{ color: '#888', textDecoration: 'none' }}>Cancelar y volver</Link>
                            </div>
                        </form>
                    )}

                    {/* STEP 2: SELECTION */}
                    {step === 'selection' && (
                        <div>
                            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#e3f2fd', borderRadius: '8px', border: '1px solid #bbdefb', color: '#0d47a1', fontSize: '0.9rem' }}>
                                <p style={{ margin: 0 }}>
                                    <strong>Capacidad disponible:</strong> Tu reservación es para {reservation?.seats_total} personas.
                                    Puedes comprar entradas para una, varias o todas las atracciones disponibles.
                                </p>
                            </div>

                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--primary-dark)' }}>Selecciona las atracciones que deseas visitar:</h3>

                            {/* All Attractions as Expandable Cards */}
                            <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
                                {Object.values(ACTIVITIES).map(activity => {
                                    const activityId = activity.id as ActivityId
                                    const hasTickets = cart.some(item => item.activityId === activityId)
                                    const activityTotal = cart
                                        .filter(item => item.activityId === activityId)
                                        .reduce((sum, item) => sum + item.price, 0)

                                    return (
                                        <div
                                            key={activity.id}
                                            style={{
                                                border: hasTickets ? '2px solid var(--primary)' : '1px solid #e0e0e0',
                                                borderRadius: '12px',
                                                overflow: 'hidden',
                                                background: hasTickets ? '#f0f7ff' : 'white',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            {/* Activity Header */}
                                            <div
                                                onClick={() => setCurrentActivity(activityId)}
                                                style={{
                                                    padding: '1rem 1.25rem',
                                                    cursor: 'pointer',
                                                    background: hasTickets ? 'var(--primary)' : '#fafafa',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '6px',
                                                        border: hasTickets ? '2px solid white' : '2px solid var(--primary)',
                                                        background: hasTickets ? 'white' : 'transparent',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '1rem',
                                                        fontWeight: 'bold',
                                                        color: hasTickets ? 'var(--primary)' : 'var(--primary)'
                                                    }}>
                                                        {hasTickets && '✓'}
                                                    </div>
                                                    <h4 style={{
                                                        margin: 0,
                                                        fontSize: '1.1rem',
                                                        fontWeight: '600',
                                                        color: hasTickets ? 'white' : 'var(--primary-dark)'
                                                    }}>
                                                        {activity.name}
                                                    </h4>
                                                </div>
                                                {hasTickets && (
                                                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white' }}>
                                                        ${activityTotal.toLocaleString('es-MX')}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Expandable Content - Only show if this activity is currently selected */}
                                            {currentActivity === activityId && (
                                                <div style={{ padding: '1rem 1.25rem' }}>
                                                    {activity.variants.map(variant => (
                                                        <div key={variant.id} style={{ marginBottom: '1rem' }}>
                                                            <div style={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                marginBottom: '0.75rem',
                                                                paddingBottom: '0.5rem',
                                                                borderBottom: '1px solid #e0e0e0'
                                                            }}>
                                                                <span style={{ fontWeight: '600', fontSize: '1rem' }}>{variant.name}</span>
                                                                <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>${variant.price}</span>
                                                            </div>

                                                            {/* Passenger Selection for this Variant */}
                                                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                                                {passengers.map(p => {
                                                                    const isSelectedHere = cart.some(item =>
                                                                        item.activityId === activityId &&
                                                                        item.variantId === variant.id &&
                                                                        item.passengerId === p.id
                                                                    )
                                                                    const isSelectedOtherVariant = cart.some(item =>
                                                                        item.activityId === activityId &&
                                                                        item.variantId !== variant.id &&
                                                                        item.passengerId === p.id
                                                                    )

                                                                    return (
                                                                        <label key={p.id} style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            padding: '0.625rem 0.75rem',
                                                                            borderRadius: '8px',
                                                                            background: isSelectedHere ? '#e3f2fd' : 'white',
                                                                            border: isSelectedHere ? '1px solid #2196f3' : '1px solid #e0e0e0',
                                                                            cursor: isSelectedOtherVariant ? 'not-allowed' : 'pointer',
                                                                            opacity: isSelectedOtherVariant ? 0.5 : 1,
                                                                            transition: 'all 0.15s ease'
                                                                        }}>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isSelectedHere}
                                                                                disabled={isSelectedOtherVariant}
                                                                                onChange={() => togglePassengerSelection(p, variant.id, variant.price, variant.name)}
                                                                                style={{ width: '18px', height: '18px', marginRight: '0.75rem', accentColor: '#2196f3' }}
                                                                            />
                                                                            <div style={{ flex: 1 }}>
                                                                                <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>{p.first_name} {p.last_name}</span>
                                                                                {p.age && <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: '0.5rem' }}>({p.age} años)</span>}
                                                                            </div>
                                                                        </label>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Cart Summary */}
                            {cart.length > 0 && (
                                <div style={{ background: '#fafafa', padding: '1rem', borderRadius: '12px', border: '1px solid #eee' }}>
                                    <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Resumen de Entrada</h3>
                                    {cart.map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                                                <div style={{ color: '#666' }}>{item.variantName} — {item.passengerName}</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <strong>${item.price}</strong>
                                                <button onClick={() => removeFromCart(item.passengerId, item.activityId)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.5rem' }}>×</button>
                                            </div>
                                        </div>
                                    ))}
                                    <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid #ddd' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                        <span>Total</span>
                                        <span>${cartTotal.toLocaleString('es-MX')}</span>
                                    </div>

                                    <button
                                        onClick={() => setStep('payment')}
                                        className="cta-button"
                                        style={{ width: '100%', marginTop: '1.5rem' }}
                                    >
                                        Pagar ${cartTotal.toLocaleString('es-MX')}
                                    </button>
                                </div>
                            )}

                            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                                <Link href="/" style={{ color: '#888', textDecoration: 'none' }}>Volver al inicio</Link>
                            </div>

                        </div>
                    )}

                    {/* STEP 3: PAYMENT */}
                    {step === 'payment' && (
                        <div>
                            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Método de Pago</h2>

                            {paymentMethod === 'transfer' && (
                                <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                                    <p style={{ margin: '0 0 0.5rem', fontWeight: 'bold', color: '#495057' }}>Datos para Transferencia:</p>
                                    <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
                                        <div>
                                            <span style={{ color: '#6c757d' }}>Banco:</span> <strong style={{ color: '#212529' }}>Mercado Pago</strong>
                                        </div>
                                        <div>
                                            <span style={{ color: '#6c757d' }}>CLABE:</span> <strong style={{ color: '#212529', fontFamily: 'monospace', fontSize: '1rem' }}>722969010994673004</strong>
                                        </div>
                                        <div>
                                            <span style={{ color: '#6c757d' }}>Beneficiario:</span> <strong style={{ color: '#212529' }}>Gady Hernández</strong>
                                        </div>
                                    </div>
                                    <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: '#ff9800', fontStyle: 'italic' }}>
                                        * Envía tu comprobante por WhatsApp indicando tu código de reservación.
                                    </p>
                                </div>
                            )}

                            <div
                                onClick={() => setPaymentMethod('transfer')}
                                style={{
                                    padding: '1rem',
                                    border: paymentMethod === 'transfer' ? '2px solid var(--primary)' : '1px solid #ddd',
                                    borderRadius: '12px',
                                    marginBottom: '1rem',
                                    cursor: 'pointer',
                                    background: paymentMethod === 'transfer' ? '#f3e5f5' : 'white'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong>Transferencia Bancaria</strong>
                                    <span style={{ fontSize: '0.8rem', background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>Sin comisión</span>
                                </div>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#666' }}>Envía comprobante por WhatsApp</p>
                            </div>

                            <div
                                onClick={() => setPaymentMethod('card')}
                                style={{
                                    padding: '1rem',
                                    border: paymentMethod === 'card' ? '2px solid var(--primary)' : '1px solid #ddd',
                                    borderRadius: '12px',
                                    marginBottom: '2rem',
                                    cursor: 'pointer',
                                    background: paymentMethod === 'card' ? '#e3f2fd' : 'white',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong>Tarjeta (Crédito/Débito)</strong>
                                    <span style={{ fontSize: '0.8rem', background: '#ffebee', color: '#c62828', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>+ 5% comisión</span>
                                </div>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#666' }}>Mercado Pago</p>

                                {paymentMethod === 'card' && (
                                    <div className="fade-in" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #bbdefb' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                            <span>Subtotal Entradas:</span>
                                            <span>${cartTotal.toLocaleString('es-MX')}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#666' }}>
                                            <span>Comisión (5%):</span>
                                            <span>${(cartTotal * 0.05).toLocaleString('es-MX')}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem', color: '#1565c0' }}>
                                            <span>Total a Pagar:</span>
                                            <span>${(cartTotal * 1.05).toLocaleString('es-MX')}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    // If Card, we need to handle the commission
                                    // We will modify handleCreateOrder to check paymentMethod and adjust total
                                    handleCreateOrder()
                                }}
                                disabled={isLoading}
                                className="cta-button"
                                style={{ width: '100%' }}
                            >
                                {isLoading ? 'Procesando...' : `Confirmar Orden ($${(paymentMethod === 'card' ? cartTotal * 1.05 : cartTotal).toLocaleString('es-MX')})`}
                            </button>
                            <button
                                onClick={() => setStep('selection')}
                                style={{
                                    width: '100%',
                                    marginTop: '1rem',
                                    padding: '0.75rem',
                                    border: 'none',
                                    background: 'none',
                                    color: '#666',
                                    cursor: 'pointer'
                                }}
                            >
                                Volver a seleccionar
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </main>
    )
}

export default function BuyTicketsPage() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <BuyTicketsContent />
        </Suspense>
    )
}
