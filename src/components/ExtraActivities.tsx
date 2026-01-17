'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { supabaseAttractions } from '@/lib/supabase-attractions'
import { generateAttractionReceiptPDF } from '@/utils/generateAttractionPDF'

interface Package {
    id: string
    name: string
    shortName: string
    price: number
    color: string
    includes: string[]
    note?: string
}

interface CartItem {
    packageId: string
    packageName: string
    quantity: number
    unitPrice: number
    total: number
}

export default function ExtraActivities() {
    // Estados
    const [step, setStep] = useState<'lookup' | 'selection'>('lookup')
    const [reservationCode, setReservationCode] = useState('')
    const [responsibleName, setResponsibleName] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [showModal, setShowModal] = useState(false)

    // Carrito de paquetes
    const [cart, setCart] = useState<CartItem[]>([])
    const [showSuccess, setShowSuccess] = useState(false)
    const [generatedCode, setGeneratedCode] = useState('')

    const packages: Package[] = [
        {
            id: 'museos',
            name: 'Paquete Museos',
            shortName: 'Solo Museos',
            price: 175,
            color: '#1a365d',
            includes: [
                'Museo de Cera',
                'Museo Ripley',
                'Viaje Fantastico',
                'Tunel Giratorio',
                'Laberinto de Espejos'
            ]
        },
        {
            id: 'acuario_adultos',
            name: 'Acuario + Museos',
            shortName: 'Adultos',
            price: 345,
            color: '#0d6ebd',
            includes: [
                'Acuario de Veracruz',
                'Museo de Cera',
                'Museo de Ripley',
                'Viaje Fantastico',
                'Tunel Giratorio',
                'Laberinto de Espejos'
            ]
        },
        {
            id: 'acuario_ninos',
            name: 'Acuario + Museos',
            shortName: 'Ninos (2-11 anos)',
            price: 285,
            color: '#2563eb',
            includes: [
                'Acuario de Veracruz',
                'Museo de Cera',
                'Museo de Ripley',
                'Viaje Fantastico',
                'Tunel Giratorio',
                'Laberinto de Espejos'
            ],
            note: 'Tambien aplica para adultos mayores con INAPAM'
        }
    ]


    // Buscar reservación
    const handleLookup = async () => {
        if (!reservationCode.trim()) return

        setIsLoading(true)
        setError('')

        try {
            const searchValue = reservationCode.trim()
            const { data, error: fetchError } = await supabase
                .from('reservations')
                .select('id, reservation_code, responsible_name')
                .or(`reservation_code.ilike.%${searchValue}%,responsible_phone.ilike.%${searchValue}%`)
                .limit(1)
                .single()

            if (fetchError || !data) {
                setError('No encontramos tu reservacion. Verifica el folio o teléfono.')
                setIsLoading(false)
                return
            }

            setResponsibleName(data.responsible_name)
            setStep('selection')
        } catch (err) {
            console.error(err)
            setError('Error al buscar. Intentalo de nuevo.')
        } finally {
            setIsLoading(false)
        }
    }

    // Actualizar cantidad en carrito
    const updateCartQuantity = (packageId: string, quantity: number) => {
        const pkg = packages.find(p => p.id === packageId)
        if (!pkg) return

        if (quantity <= 0) {
            setCart(prev => prev.filter(item => item.packageId !== packageId))
        } else {
            setCart(prev => {
                const existing = prev.find(item => item.packageId === packageId)
                if (existing) {
                    return prev.map(item =>
                        item.packageId === packageId
                            ? { ...item, quantity, total: pkg.price * quantity }
                            : item
                    )
                } else {
                    return [...prev, {
                        packageId: pkg.id,
                        packageName: `${pkg.name} (${pkg.shortName})`,
                        quantity,
                        unitPrice: pkg.price,
                        total: pkg.price * quantity
                    }]
                }
            })
        }
    }

    const getQuantity = (packageId: string) => {
        return cart.find(item => item.packageId === packageId)?.quantity || 0
    }

    const cartTotal = cart.reduce((sum, item) => sum + item.total, 0)
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

    // Generar código
    const generateCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let code = 'ATR-'
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return code
    }

    // Guardar reserva
    const handleReserve = async () => {
        if (cart.length === 0 || !responsibleName) return

        setIsLoading(true)
        const code = generateCode()

        try {
            // Guardar cada paquete del carrito
            for (const item of cart) {
                const { error } = await supabaseAttractions
                    .from('package_reservations')
                    .insert({
                        package_type: item.packageId,
                        responsible_name: responsibleName,
                        num_people: item.quantity,
                        total_amount: item.total,
                        reservation_code: code,
                        payment_status: 'pendiente',
                        notes: `Reservacion Betel: ${reservationCode} | ${item.packageName}`
                    })

                if (error) throw error
            }

            setGeneratedCode(code)
            setShowSuccess(true)

            // Generar PDF automaticamente
            setTimeout(() => {
                generateAttractionReceiptPDF({
                    reservationCode: reservationCode,
                    attractionCode: code,
                    responsibleName: responsibleName,
                    betelCode: reservationCode,
                    cart: cart,
                    totalAmount: cartTotal
                })
            }, 500)

        } catch (err) {
            console.error('Error al reservar:', err)
            alert('Error al crear la reserva. Por favor intenta de nuevo.')
        } finally {
            setIsLoading(false)
        }
    }

    // Cerrar modal
    const closeModal = () => {
        setShowModal(false)
        setStep('lookup')
        setReservationCode('')
        setResponsibleName('')
        setCart([])
        setShowSuccess(false)
        setGeneratedCode('')
        setError('')
    }

    return (
        <section style={{ maxWidth: '600px', margin: '2rem auto 0', padding: '0 1rem' }}>
            <h2 style={{
                textAlign: 'center',
                fontSize: '1.5rem',
                color: 'var(--primary)',
                marginBottom: '0.25rem',
                fontFamily: 'var(--font-luckiest), cursive',
                letterSpacing: '1px'
            }}>
                Paquetes de Atracciones
            </h2>
            <p style={{
                textAlign: 'center',
                color: '#666',
                fontSize: '0.8rem',
                marginBottom: '1rem'
            }}>
                Tarifa para grupos Veracruz 2026 - *Sujeto a cambio
            </p>

            {/* Lista de paquetes (preview) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {packages.map((pkg) => (
                    <div
                        key={pkg.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'white',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            border: '1px solid #eee'
                        }}
                    >
                        <div style={{
                            width: '60px',
                            minHeight: '70px',
                            background: pkg.color,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            padding: '0.5rem',
                            fontSize: '0.5rem',
                            fontWeight: '700',
                            textAlign: 'center'
                        }}>
                            {pkg.id.includes('acuario') ? 'ACUARIO\n+MUSEOS' : 'MUSEOS'}
                        </div>

                        <div style={{
                            flex: 1,
                            padding: '0.75rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: '#1a1a1a' }}>
                                    {pkg.name}
                                </h3>
                                <p style={{ margin: '0.1rem 0 0', fontSize: '0.75rem', color: pkg.color, fontWeight: '600' }}>
                                    {pkg.shortName}
                                </p>
                            </div>
                            <div style={{
                                background: pkg.color,
                                color: 'white',
                                padding: '0.4rem 0.6rem',
                                borderRadius: '8px',
                                fontSize: '1.1rem',
                                fontWeight: '800'
                            }}>
                                ${pkg.price}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Botón para abrir modal */}
            <button
                onClick={() => setShowModal(true)}
                style={{
                    width: '100%',
                    marginTop: '1rem',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: 'white',
                    fontSize: '1rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                }}
            >
                Reservar Paquetes
            </button>

            <p style={{
                textAlign: 'center',
                fontSize: '0.7rem',
                color: '#999',
                marginTop: '0.5rem'
            }}>
                Menores de 2 anos no pagan
            </p>

            {/* Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        maxWidth: '450px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                    }}>
                        {/* Header */}
                        <div style={{
                            background: 'var(--primary)',
                            color: 'white',
                            padding: '1rem',
                            textAlign: 'center'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>
                                Reservar Paquetes de Atracciones
                            </h3>
                        </div>

                        {!showSuccess ? (
                            <div style={{ padding: '1.25rem' }}>
                                {/* PASO 1: Buscar reservación */}
                                {step === 'lookup' && (
                                    <div>
                                        <p style={{ margin: '0 0 1rem', color: '#555', fontSize: '0.9rem', textAlign: 'center' }}>
                                            Ingresa tu folio de reservación o número de teléfono
                                        </p>
                                        <input
                                            type="text"
                                            value={reservationCode}
                                            onChange={(e) => setReservationCode(e.target.value.toUpperCase())}
                                            placeholder="Ej: BETEL-XXXX o 9611234567"
                                            style={{
                                                width: '100%',
                                                padding: '0.85rem',
                                                borderRadius: '10px',
                                                border: '1px solid #ddd',
                                                fontSize: '1rem',
                                                textAlign: 'center',
                                                textTransform: 'uppercase',
                                                marginBottom: '0.75rem'
                                            }}
                                        />
                                        {error && (
                                            <p style={{ color: '#c62828', fontSize: '0.85rem', textAlign: 'center', margin: '0 0 0.75rem' }}>
                                                {error}
                                            </p>
                                        )}
                                        <button
                                            onClick={handleLookup}
                                            disabled={!reservationCode.trim() || isLoading}
                                            style={{
                                                width: '100%',
                                                padding: '0.85rem',
                                                borderRadius: '10px',
                                                border: 'none',
                                                background: reservationCode.trim() ? 'var(--primary)' : '#ccc',
                                                color: 'white',
                                                fontSize: '1rem',
                                                fontWeight: '600',
                                                cursor: reservationCode.trim() ? 'pointer' : 'not-allowed'
                                            }}
                                        >
                                            {isLoading ? 'Buscando...' : 'Buscar Reservacion'}
                                        </button>
                                    </div>
                                )}

                                {/* PASO 2: Selección de paquetes */}
                                {step === 'selection' && (
                                    <div>
                                        {/* Info del responsable */}
                                        <div style={{
                                            background: '#e3f2fd',
                                            borderRadius: '10px',
                                            padding: '0.75rem',
                                            marginBottom: '1rem',
                                            fontSize: '0.85rem'
                                        }}>
                                            <div><strong>Reservacion:</strong> {reservationCode}</div>
                                            <div><strong>Responsable:</strong> {responsibleName}</div>
                                        </div>

                                        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#333' }}>
                                            Selecciona los paquetes que deseas:
                                        </h4>

                                        {/* Lista de paquetes para seleccionar */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                                            {packages.map((pkg) => {
                                                const qty = getQuantity(pkg.id)
                                                return (
                                                    <div key={pkg.id} style={{
                                                        border: qty > 0 ? `2px solid ${pkg.color}` : '1px solid #e0e0e0',
                                                        borderRadius: '12px',
                                                        padding: '1rem',
                                                        background: qty > 0 ? '#f8fafc' : 'white'
                                                    }}>
                                                        {/* Header del paquete */}
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                            <div>
                                                                <div style={{ fontWeight: '700', fontSize: '1rem', color: pkg.color }}>
                                                                    {pkg.name}
                                                                </div>
                                                                <div style={{ fontSize: '0.8rem', color: '#666', fontWeight: '600' }}>
                                                                    {pkg.shortName} - ${pkg.price} c/u
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Lista de lo que incluye */}
                                                        <div style={{
                                                            background: '#f8f9fa',
                                                            borderRadius: '8px',
                                                            padding: '0.6rem 0.75rem',
                                                            marginBottom: '0.75rem',
                                                            fontSize: '0.75rem'
                                                        }}>
                                                            <div style={{ fontWeight: '600', color: '#333', marginBottom: '0.35rem' }}>Incluye:</div>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.75rem' }}>
                                                                {pkg.includes.map((item, idx) => (
                                                                    <span key={idx} style={{ color: '#495057', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                        <span style={{ color: '#22c55e', fontWeight: '700' }}>+</span> {item}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Controles de cantidad */}
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                <button
                                                                    onClick={() => updateCartQuantity(pkg.id, qty - 1)}
                                                                    style={{
                                                                        width: '36px',
                                                                        height: '36px',
                                                                        borderRadius: '8px',
                                                                        border: '1px solid #ddd',
                                                                        background: 'white',
                                                                        fontSize: '1.25rem',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >-</button>
                                                                <span style={{ fontSize: '1.25rem', fontWeight: '700', minWidth: '30px', textAlign: 'center' }}>
                                                                    {qty}
                                                                </span>
                                                                <button
                                                                    onClick={() => updateCartQuantity(pkg.id, qty + 1)}
                                                                    style={{
                                                                        width: '36px',
                                                                        height: '36px',
                                                                        borderRadius: '8px',
                                                                        border: '1px solid #ddd',
                                                                        background: 'white',
                                                                        fontSize: '1.25rem',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >+</button>
                                                            </div>
                                                            {qty > 0 && (
                                                                <div style={{ fontWeight: '700', fontSize: '1.1rem', color: pkg.color }}>
                                                                    ${pkg.price * qty}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {pkg.note && (
                                                            <p style={{ margin: '0.5rem 0 0', fontSize: '0.7rem', color: '#666', fontStyle: 'italic' }}>
                                                                * {pkg.note}
                                                            </p>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {/* Resumen del carrito */}
                                        {cart.length > 0 && (
                                            <div style={{
                                                background: '#f5f5f5',
                                                borderRadius: '10px',
                                                padding: '0.75rem',
                                                marginBottom: '1rem'
                                            }}>
                                                <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                                    <strong>Resumen:</strong> {cartCount} entrada(s)
                                                </div>
                                                {cart.map(item => (
                                                    <div key={item.packageId} style={{ fontSize: '0.8rem', color: '#555', display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>{item.quantity}x {item.packageName}</span>
                                                        <span>${item.total}</span>
                                                    </div>
                                                ))}
                                                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
                                                    <span>TOTAL:</span>
                                                    <span>${cartTotal}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Datos de transferencia */}
                                        <div style={{
                                            background: '#e8f5e9',
                                            border: '1px solid #c8e6c9',
                                            borderRadius: '10px',
                                            padding: '0.75rem',
                                            marginBottom: '1rem'
                                        }}>
                                            <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem', color: '#2e7d32' }}>
                                                Datos para Transferencia:
                                            </h4>
                                            <div style={{ fontSize: '0.8rem', color: '#1b5e20' }}>
                                                <p style={{ margin: '0.2rem 0' }}><strong>Banco:</strong> Mercado Pago</p>
                                                <div style={{ margin: '0.2rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    <strong>CLABE:</strong>
                                                    <span style={{ fontFamily: 'monospace' }}>722969010994673004</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            navigator.clipboard.writeText('722969010994673004')
                                                            const btn = e.currentTarget
                                                            btn.textContent = 'Copiado!'
                                                            btn.style.background = '#4caf50'
                                                            setTimeout(() => {
                                                                btn.textContent = 'Copiar'
                                                                btn.style.background = '#2e7d32'
                                                            }, 2000)
                                                        }}
                                                        style={{
                                                            background: '#2e7d32',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            padding: '0.25rem 0.5rem',
                                                            fontSize: '0.7rem',
                                                            cursor: 'pointer',
                                                            fontWeight: '600'
                                                        }}
                                                    >
                                                        Copiar
                                                    </button>
                                                </div>
                                                <p style={{ margin: '0.2rem 0' }}><strong>Beneficiario:</strong> Gady Hernandez</p>
                                                <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', fontStyle: 'italic' }}>
                                                    Concepto: {responsibleName} - Atracciones Betel
                                                </p>
                                            </div>
                                        </div>

                                        {/* Botón reservar */}
                                        <button
                                            onClick={handleReserve}
                                            disabled={cart.length === 0 || isLoading}
                                            style={{
                                                width: '100%',
                                                padding: '0.85rem',
                                                borderRadius: '10px',
                                                border: 'none',
                                                background: cart.length > 0 ? 'var(--primary)' : '#ccc',
                                                color: 'white',
                                                fontSize: '1rem',
                                                fontWeight: '700',
                                                cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
                                                marginBottom: '0.5rem'
                                            }}
                                        >
                                            {isLoading ? 'Reservando...' : `Reservar - $${cartTotal}`}
                                        </button>

                                        <button
                                            onClick={() => { setStep('lookup'); setCart([]); }}
                                            style={{
                                                width: '100%',
                                                padding: '0.6rem',
                                                borderRadius: '10px',
                                                border: '1px solid #ddd',
                                                background: 'white',
                                                color: '#666',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Cambiar reservacion
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Confirmación de éxito - Diseño limpio */
                            <div style={{ padding: '0' }}>
                                {/* Header con codigo prominente */}
                                <div style={{
                                    background: 'var(--primary)',
                                    padding: '1.5rem',
                                    textAlign: 'center',
                                    color: 'white'
                                }}>
                                    <div style={{
                                        fontSize: '0.75rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px',
                                        opacity: 0.85,
                                        marginBottom: '0.5rem'
                                    }}>
                                        Tu Codigo de Pre-Reserva
                                    </div>
                                    <div style={{
                                        fontFamily: 'monospace',
                                        fontSize: '1.75rem',
                                        fontWeight: '800',
                                        letterSpacing: '3px',
                                        marginBottom: '0.75rem'
                                    }}>
                                        {generatedCode}
                                    </div>
                                    <div style={{
                                        display: 'inline-block',
                                        background: 'rgba(255,255,255,0.2)',
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '20px',
                                        fontSize: '0.8rem'
                                    }}>
                                        Recibo descargado
                                    </div>
                                </div>

                                {/* Contenido */}
                                <div style={{ padding: '1.25rem' }}>
                                    {/* Resumen de paquetes */}
                                    <div style={{
                                        background: '#f8fafc',
                                        borderRadius: '12px',
                                        padding: '1rem',
                                        marginBottom: '1rem',
                                        border: '1px solid #e2e8f0'
                                    }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.5rem' }}>
                                            Resumen de Paquetes:
                                        </div>
                                        {cart.map(item => (
                                            <div key={item.packageId} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                padding: '0.4rem 0',
                                                borderBottom: '1px dashed #e2e8f0',
                                                fontSize: '0.85rem'
                                            }}>
                                                <span style={{ color: '#475569' }}>{item.quantity}x {item.packageName}</span>
                                                <strong style={{ color: '#1e293b' }}>${item.total}</strong>
                                            </div>
                                        ))}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            padding: '0.75rem 0 0',
                                            marginTop: '0.5rem',
                                            fontSize: '1rem',
                                            fontWeight: '800'
                                        }}>
                                            <span>TOTAL A PAGAR:</span>
                                            <span style={{ color: '#16a34a' }}>${cartTotal}</span>
                                        </div>
                                    </div>

                                    {/* Datos de transferencia */}
                                    <div style={{
                                        background: '#fef3c7',
                                        borderRadius: '12px',
                                        padding: '1rem',
                                        marginBottom: '1rem',
                                        border: '1px solid #fcd34d'
                                    }}>
                                        <div style={{ fontWeight: '700', color: '#b45309', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                                            Datos para Transferencia:
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#92400e' }}>
                                            <div style={{ marginBottom: '0.25rem' }}>Banco: <strong>Mercado Pago</strong></div>
                                            <div style={{ marginBottom: '0.25rem' }}>CLABE: <strong style={{ fontFamily: 'monospace' }}>722969010994673004</strong></div>
                                            <div>Beneficiario: <strong>Gady Hernandez</strong></div>
                                        </div>
                                    </div>

                                    {/* Botones de accion */}
                                    <button
                                        onClick={() => generateAttractionReceiptPDF({
                                            reservationCode: reservationCode,
                                            attractionCode: generatedCode,
                                            responsibleName: responsibleName,
                                            betelCode: reservationCode,
                                            cart: cart,
                                            totalAmount: cartTotal
                                        })}
                                        style={{
                                            width: '100%',
                                            padding: '0.85rem',
                                            borderRadius: '10px',
                                            border: '1px solid #2563eb',
                                            background: 'white',
                                            color: '#2563eb',
                                            fontSize: '0.9rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            marginBottom: '0.5rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        Descargar Recibo PDF
                                    </button>

                                    <a
                                        href={`https://wa.me/5219618720544?text=Hola,%20acabo%20de%20reservar%20paquetes%20de%20atracciones.%20Mi%20codigo%20es:%20${generatedCode}.%20Responsable:%20${encodeURIComponent(responsibleName)}.%20Total:%20$${cartTotal}`}
                                        target="_blank"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            background: '#25D366',
                                            color: 'white',
                                            padding: '0.85rem',
                                            borderRadius: '10px',
                                            textDecoration: 'none',
                                            fontWeight: '700',
                                            fontSize: '0.9rem',
                                            marginBottom: '0.5rem'
                                        }}
                                    >
                                        Enviar Comprobante por WhatsApp
                                    </a>

                                    <button
                                        onClick={closeModal}
                                        style={{
                                            width: '100%',
                                            padding: '0.6rem',
                                            borderRadius: '10px',
                                            border: '1px solid #e2e8f0',
                                            background: 'white',
                                            color: '#64748b',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Botón cerrar (X) */}
                        {!showSuccess && (
                            <button
                                onClick={closeModal}
                                style={{
                                    position: 'absolute',
                                    top: '10px',
                                    right: '10px',
                                    width: '30px',
                                    height: '30px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    background: 'rgba(255,255,255,0.9)',
                                    color: '#333',
                                    fontSize: '1.25rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                x
                            </button>
                        )}
                    </div>
                </div>
            )
            }
        </section >
    )
}
