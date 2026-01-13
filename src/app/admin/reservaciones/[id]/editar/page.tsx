'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface PassengerEdit {
    id?: string
    first_name: string
    last_name: string
    age: number | null
    congregation: string
    is_free_under6: boolean
    seat_number: string
    isNew?: boolean
    toDelete?: boolean
}

interface ReservationEdit {
    id: string
    reservation_code: string
    responsible_name: string
    responsible_phone: string
    responsible_congregation: string
    total_amount: number
    amount_paid: number
    status: string
    is_host?: boolean
}

const PRICE_PER_SEAT = 1800

export default function EditarReservacionPage() {
    const router = useRouter()
    const params = useParams()
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [reservation, setReservation] = useState<ReservationEdit | null>(null)
    const [passengers, setPassengers] = useState<PassengerEdit[]>([])
    const [saveSuccess, setSaveSuccess] = useState(false)

    useEffect(() => {
        loadData()
    }, [params.id])

    const loadData = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            router.push('/admin/login')
            return
        }

        const { data: adminUser } = await supabase
            .from('admin_users')
            .select('email')
            .eq('email', session.user.email)
            .single()

        if (!adminUser) {
            router.push('/admin/login')
            return
        }

        const { data: resData } = await supabase
            .from('reservations')
            .select('*')
            .eq('id', params.id)
            .single()

        if (!resData) {
            router.push('/admin/reservaciones')
            return
        }

        setReservation(resData)

        const { data: passData } = await supabase
            .from('reservation_passengers')
            .select('*')
            .eq('reservation_id', params.id)
            .order('created_at', { ascending: true })

        setPassengers((passData || []).map(p => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            age: p.age,
            congregation: p.congregation || '',
            is_free_under6: p.is_free_under6,
            seat_number: p.seat_number || ''
        })))

        setIsLoading(false)
    }

    const updateReservation = (field: keyof ReservationEdit, value: any) => {
        if (!reservation) return
        setReservation({ ...reservation, [field]: value })
    }

    const updatePassenger = (index: number, field: keyof PassengerEdit, value: any) => {
        const updated = [...passengers]
        updated[index] = { ...updated[index], [field]: value }
        if (field === 'age' && typeof value === 'number') {
            updated[index].is_free_under6 = value < 6
        }
        setPassengers(updated)
    }

    const addPassenger = () => {
        setPassengers([...passengers, {
            first_name: '',
            last_name: '',
            age: null,
            congregation: '',
            is_free_under6: false,
            seat_number: '',
            isNew: true
        }])
    }

    const removePassenger = (index: number) => {
        const updated = [...passengers]
        if (updated[index].isNew) {
            updated.splice(index, 1)
        } else {
            updated[index].toDelete = true
        }
        setPassengers(updated)
    }

    const restorePassenger = (index: number) => {
        const updated = [...passengers]
        updated[index].toDelete = false
        setPassengers(updated)
    }

    const calculateTotal = () => {
        const active = passengers.filter(p => !p.toDelete)
        const payable = active.filter(p => !p.is_free_under6).length
        return { total: payable * PRICE_PER_SEAT, payable, activeCount: active.length }
    }

    const handleSave = async () => {
        if (!reservation) return
        setIsSaving(true)
        setSaveSuccess(false)

        try {
            const active = passengers.filter(p => !p.toDelete)
            const { total, payable } = calculateTotal()

            const toDelete = passengers.filter(p => p.toDelete && p.id)
            for (const p of toDelete) {
                await supabase.from('reservation_passengers').delete().eq('id', p.id)
            }

            const toUpdate = active.filter(p => p.id && !p.isNew)
            for (const p of toUpdate) {
                await supabase
                    .from('reservation_passengers')
                    .update({
                        first_name: p.first_name,
                        last_name: p.last_name,
                        age: p.age,
                        congregation: p.congregation,
                        is_free_under6: p.is_free_under6,
                        seat_number: p.seat_number || null
                    })
                    .eq('id', p.id)
            }

            const toInsert = active.filter(p => p.isNew)
            for (const p of toInsert) {
                await supabase
                    .from('reservation_passengers')
                    .insert({
                        reservation_id: reservation.id,
                        first_name: p.first_name,
                        last_name: p.last_name,
                        age: p.age,
                        congregation: p.congregation,
                        is_free_under6: p.is_free_under6,
                        seat_number: p.seat_number || null
                    })
            }

            await supabase
                .from('reservations')
                .update({
                    responsible_name: reservation.responsible_name,
                    responsible_phone: reservation.responsible_phone,
                    responsible_congregation: reservation.responsible_congregation,
                    seats_total: active.length,
                    seats_payable: payable,
                    total_amount: total,
                    deposit_required: Math.ceil(total * 0.5),
                    is_host: reservation.is_host
                })
                .eq('id', reservation.id)

            setSaveSuccess(true)
            await loadData()

        } catch (err) {
            console.error(err)
            alert('Error al guardar')
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                <p>Cargando...</p>
            </div>
        )
    }

    const { total, activeCount } = calculateTotal()

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', paddingBottom: '2rem' }}>
            {/* Header */}
            <header style={{ background: '#2c3e50', color: 'white', padding: '1rem' }}>
                <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Link href={`/admin/reservaciones/${params.id}`} style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
                            Volver
                        </Link>
                        <div>
                            <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>Editando</div>
                            <div style={{ fontSize: '1rem', fontWeight: '700', fontFamily: 'monospace' }}>
                                {reservation?.reservation_code}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem 1rem' }}>
                {saveSuccess && (
                    <div style={{ background: '#dcfce7', color: '#166534', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', textAlign: 'center', fontWeight: '600' }}>
                        Cambios guardados correctamente
                    </div>
                )}

                {/* Responsible Info */}
                <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.25rem', color: '#1e293b' }}>Datos del Responsable</h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem' }}>Nombre completo</label>
                            <input
                                type="text"
                                value={reservation?.responsible_name || ''}
                                onChange={e => updateReservation('responsible_name', e.target.value)}
                                style={{ width: '100%', padding: '0.85rem', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '1rem', background: '#f8fafc' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem' }}>Telefono</label>
                            <input
                                type="tel"
                                value={reservation?.responsible_phone || ''}
                                onChange={e => updateReservation('responsible_phone', e.target.value)}
                                style={{ width: '100%', padding: '0.85rem', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '1rem', background: '#f8fafc' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem' }}>Congregacion</label>
                            <input
                                type="text"
                                value={reservation?.responsible_congregation || ''}
                                onChange={e => updateReservation('responsible_congregation', e.target.value)}
                                style={{ width: '100%', padding: '0.85rem', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '1rem', background: '#f8fafc' }}
                            />
                        </div>

                        <div style={{ padding: '1rem', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={reservation?.is_host || false}
                                    onChange={e => updateReservation('is_host', e.target.checked)}
                                    style={{ width: '1.25rem', height: '1.25rem' }}
                                />
                                <div>
                                    <div style={{ fontWeight: '700', color: '#0369a1' }}>Es Anfitrión (Staff)</div>
                                    <div style={{ fontSize: '0.8rem', color: '#0c4a6e' }}>
                                        Si se marca, el dinero de esta reservación <strong>NO contará</strong> en los reportes financieros.
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Passengers */}
                <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, color: '#1e293b' }}>
                            Pasajeros ({activeCount})
                        </h2>
                        <button
                            onClick={addPassenger}
                            style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}
                        >
                            + Agregar
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {passengers.map((p, idx) => (
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
                                        <button onClick={() => restorePassenger(idx)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                                            Restaurar
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {/* Pasajero numero */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Pasajero {idx + 1}</span>
                                            <button
                                                onClick={() => removePassenger(idx)}
                                                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
                                            >
                                                Eliminar
                                            </button>
                                        </div>

                                        {/* Nombre */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                            <input
                                                type="text"
                                                placeholder="Nombre"
                                                value={p.first_name}
                                                onChange={e => updatePassenger(idx, 'first_name', e.target.value)}
                                                style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Apellido"
                                                value={p.last_name}
                                                onChange={e => updatePassenger(idx, 'last_name', e.target.value)}
                                                style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }}
                                            />
                                        </div>

                                        {/* Edad, Asiento, Congregacion */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '80px 80px 1fr', gap: '0.75rem' }}>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Edad</label>
                                                <input
                                                    type="number"
                                                    value={p.age || ''}
                                                    onChange={e => updatePassenger(idx, 'age', e.target.value ? parseInt(e.target.value) : null)}
                                                    style={{ width: '100%', padding: '0.65rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', textAlign: 'center' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', color: '#d97706', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Asiento</label>
                                                <input
                                                    type="text"
                                                    value={p.seat_number}
                                                    onChange={e => updatePassenger(idx, 'seat_number', e.target.value)}
                                                    style={{ width: '100%', padding: '0.65rem', border: '2px solid #fcd34d', borderRadius: '8px', fontSize: '0.95rem', textAlign: 'center', background: '#fffbeb' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Congregacion</label>
                                                <input
                                                    type="text"
                                                    value={p.congregation}
                                                    onChange={e => updatePassenger(idx, 'congregation', e.target.value)}
                                                    style={{ width: '100%', padding: '0.65rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }}
                                                />
                                            </div>
                                        </div>

                                        {p.is_free_under6 && (
                                            <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#166534', padding: '0.35rem 0.75rem', borderRadius: '6px', fontWeight: '600', alignSelf: 'flex-start' }}>
                                                Menor de 6 - Gratis
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Summary */}
                <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Nuevo Total</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b' }}>${total.toLocaleString()}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Pagado</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#16a34a' }}>${reservation?.amount_paid.toLocaleString()}</div>
                        </div>
                    </div>
                </div>

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
                        fontSize: '1.05rem',
                        fontWeight: '700',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        opacity: isSaving ? 0.7 : 1
                    }}
                >
                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </main>
        </div>
    )
}
