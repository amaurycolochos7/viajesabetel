'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface TourGroup {
    id: string
    group_name: string
    tour_datetime: string | null
    max_members: number
    notes: string | null
    created_at: string
}

interface EligiblePassenger {
    id: string
    first_name: string
    last_name: string
    congregation: string | null
    reservation_id: string
    reservation_code: string
    responsible_phone: string
}

interface GroupMember {
    id: string
    passenger_id: string
    passenger_first_name: string
    passenger_last_name: string
    reservation_code: string
}

export default function TourGroupsPage() {
    const router = useRouter()
    const [groups, setGroups] = useState<TourGroup[]>([])
    const [eligiblePassengers, setEligiblePassengers] = useState<EligiblePassenger[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [userEmail, setUserEmail] = useState('')

    const [newGroupName, setNewGroupName] = useState('')
    const [newGroupDatetime, setNewGroupDatetime] = useState('')
    const [isCreating, setIsCreating] = useState(false)

    const [selectedGroup, setSelectedGroup] = useState<TourGroup | null>(null)
    const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
    const [selectedPassengers, setSelectedPassengers] = useState<string[]>([])

    useEffect(() => {
        checkAuthAndLoadData()
    }, [])

    const checkAuthAndLoadData = async () => {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            router.push('/admin/login')
            return
        }

        setUserEmail(session.user.email || '')
        await loadData()
        setIsLoading(false)
    }

    const loadData = async () => {
        // Load groups
        const { data: groupsData } = await supabase
            .from('tour_groups')
            .select('*')
            .order('tour_datetime', { ascending: true })

        if (groupsData) {
            setGroups(groupsData as TourGroup[])
        }

        // Load eligible passengers (those with anticipo or full payment, not yet assigned)
        const { data: passengersData } = await supabase
            .from('reservation_passengers')
            .select(`
        id,
        first_name,
        last_name,
        congregation,
        reservation_id,
        reservations!inner(reservation_code, responsible_phone, status)
      `)
            .in('reservations.status', ['anticipo_pagado', 'pagado_completo'])

        if (passengersData) {
            // Filter out those already assigned
            const { data: assignedData } = await supabase
                .from('tour_group_members')
                .select('passenger_id')

            const assignedIds = new Set((assignedData || []).map(a => a.passenger_id))

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const eligible = passengersData
                .filter((p: any) => !assignedIds.has(p.id))
                .map((p: any) => ({
                    id: p.id,
                    first_name: p.first_name,
                    last_name: p.last_name,
                    congregation: p.congregation,
                    reservation_id: p.reservation_id,
                    reservation_code: p.reservations?.reservation_code || '',
                    responsible_phone: p.reservations?.responsible_phone || '',
                }))

            setEligiblePassengers(eligible)
        }
    }

    const loadGroupMembers = async (groupId: string) => {
        const { data } = await supabase
            .from('tour_group_members')
            .select(`
        id,
        passenger_id,
        reservation_passengers!inner(first_name, last_name),
        reservations!inner(reservation_code)
      `)
            .eq('group_id', groupId)

        if (data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setGroupMembers(data.map((m: any) => ({
                id: m.id,
                passenger_id: m.passenger_id,
                passenger_first_name: m.reservation_passengers?.first_name || '',
                passenger_last_name: m.reservation_passengers?.last_name || '',
                reservation_code: m.reservations?.reservation_code || '',
            })))
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/admin/login')
    }

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return
        setIsCreating(true)

        try {
            const { error } = await supabase
                .from('tour_groups')
                .insert({
                    group_name: newGroupName,
                    tour_datetime: newGroupDatetime || null,
                })

            if (error) throw error

            setNewGroupName('')
            setNewGroupDatetime('')
            await loadData()
        } catch (err) {
            console.error(err)
            alert('Error al crear el grupo')
        } finally {
            setIsCreating(false)
        }
    }

    const handleSelectGroup = async (group: TourGroup) => {
        setSelectedGroup(group)
        setSelectedPassengers([])
        await loadGroupMembers(group.id)
    }

    const handleTogglePassenger = (passengerId: string) => {
        setSelectedPassengers(prev =>
            prev.includes(passengerId)
                ? prev.filter(id => id !== passengerId)
                : [...prev, passengerId]
        )
    }

    const handleAssignPassengers = async () => {
        if (!selectedGroup || selectedPassengers.length === 0) return

        const remainingSlots = selectedGroup.max_members - groupMembers.length
        if (selectedPassengers.length > remainingSlots) {
            alert(`Solo quedan ${remainingSlots} lugares en este grupo`)
            return
        }

        try {
            const inserts = selectedPassengers.map(passengerId => {
                const passenger = eligiblePassengers.find(p => p.id === passengerId)!
                return {
                    group_id: selectedGroup.id,
                    passenger_id: passengerId,
                    reservation_id: passenger.reservation_id,
                }
            })

            const { error } = await supabase
                .from('tour_group_members')
                .insert(inserts)

            if (error) throw error

            setSelectedPassengers([])
            await loadData()
            await loadGroupMembers(selectedGroup.id)
        } catch (err) {
            console.error(err)
            alert('Error al asignar pasajeros')
        }
    }

    const handleRemoveMember = async (memberId: string) => {
        try {
            const { error } = await supabase
                .from('tour_group_members')
                .delete()
                .eq('id', memberId)

            if (error) throw error

            if (selectedGroup) {
                await loadData()
                await loadGroupMembers(selectedGroup.id)
            }
        } catch (err) {
            console.error(err)
            alert('Error al quitar miembro')
        }
    }

    const handleUpdateDatetime = async (datetime: string) => {
        if (!selectedGroup) return

        try {
            const { error } = await supabase
                .from('tour_groups')
                .update({ tour_datetime: datetime || null })
                .eq('id', selectedGroup.id)

            if (error) throw error

            setSelectedGroup({ ...selectedGroup, tour_datetime: datetime })
            await loadData()
        } catch (err) {
            console.error(err)
            alert('Error al actualizar horario')
        }
    }

    const handleUpdateGroupName = async (name: string) => {
        if (!selectedGroup || !name.trim() || name === selectedGroup.group_name) return

        try {
            const { error } = await supabase
                .from('tour_groups')
                .update({ group_name: name.trim() })
                .eq('id', selectedGroup.id)

            if (error) throw error

            setSelectedGroup({ ...selectedGroup, group_name: name.trim() })
            await loadData()
        } catch (err) {
            console.error(err)
            alert('Error al actualizar nombre del grupo')
        }
    }

    const handleDeleteGroup = async (groupId: string) => {
        if (!confirm('¿Estás seguro de eliminar este grupo?')) return

        try {
            const { error } = await supabase
                .from('tour_groups')
                .delete()
                .eq('id', groupId)

            if (error) throw error

            setSelectedGroup(null)
            setGroupMembers([])
            await loadData()
        } catch (err) {
            console.error(err)
            alert('Error al eliminar grupo')
        }
    }

    const getPublicLink = () => {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        return `${baseUrl}/mi-grupo`
    }

    if (isLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa' }}>
                <p>Cargando...</p>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f5f6fa' }}>
            {/* Header */}
            <header style={{
                background: 'var(--primary)',
                color: 'white',
                padding: '1rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link href="/admin" style={{ color: 'white', textDecoration: 'none', opacity: 0.9 }}>
                        ← Dashboard
                    </Link>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Grupos de Tour</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{userEmail}</span>
                    <button
                        onClick={handleLogout}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                        }}
                    >
                        Cerrar sesión
                    </button>
                </div>
            </header>

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
                {/* Link público */}
                <div style={{
                    background: '#e3f2fd',
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                }}>
                    <div>
                        <strong>Link público para consultar grupo:</strong>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                            {getPublicLink()}
                        </div>
                    </div>
                    <button
                        onClick={() => navigator.clipboard.writeText(getPublicLink())}
                        style={{
                            padding: '0.5rem 1rem',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Copiar link
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
                    {/* Left: Groups list */}
                    <div>
                        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '1rem' }}>
                            <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Crear nuevo grupo</h2>
                            <div style={{ marginBottom: '0.75rem' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Nombre del grupo (ej: Grupo 1)"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                />
                            </div>
                            <div style={{ marginBottom: '0.75rem' }}>
                                <input
                                    type="datetime-local"
                                    className="form-input"
                                    value={newGroupDatetime}
                                    onChange={(e) => setNewGroupDatetime(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={handleCreateGroup}
                                disabled={isCreating || !newGroupName.trim()}
                                className="nav-button"
                                style={{ width: '100%' }}
                            >
                                {isCreating ? 'Creando...' : 'Crear grupo'}
                            </button>
                        </div>

                        <div style={{ background: 'white', padding: '1rem', borderRadius: '8px' }}>
                            <h3 style={{ fontWeight: '600', marginBottom: '0.75rem' }}>Grupos ({groups.length})</h3>
                            {groups.length === 0 ? (
                                <p style={{ color: '#666', textAlign: 'center', padding: '1rem' }}>
                                    No hay grupos creados
                                </p>
                            ) : (
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                    {groups.map(group => (
                                        <button
                                            key={group.id}
                                            onClick={() => handleSelectGroup(group)}
                                            style={{
                                                padding: '0.75rem',
                                                border: selectedGroup?.id === group.id ? '2px solid var(--primary)' : '1px solid #ddd',
                                                borderRadius: '4px',
                                                background: selectedGroup?.id === group.id ? '#e3f2fd' : 'white',
                                                cursor: 'pointer',
                                                textAlign: 'left'
                                            }}
                                        >
                                            <div style={{ fontWeight: '600' }}>{group.group_name}</div>
                                            {group.tour_datetime && (
                                                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                                    {new Date(group.tour_datetime).toLocaleString('es-MX', {
                                                        weekday: 'short',
                                                        day: 'numeric',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Group details */}
                    <div>
                        {selectedGroup ? (
                            <>

                                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <div style={{ flex: 1, marginRight: '1rem' }}>
                                            <input
                                                type="text"
                                                className="form-input"
                                                style={{ fontSize: '1.5rem', fontWeight: '600', padding: '0.25rem 0.5rem' }}
                                                defaultValue={selectedGroup.group_name}
                                                key={selectedGroup.id}
                                                onBlur={(e) => handleUpdateGroupName(e.target.value)}
                                            />
                                        </div>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '20px',
                                            background: groupMembers.length >= selectedGroup.max_members ? '#27ae60' : '#f39c12',
                                            color: 'white',
                                            fontSize: '0.85rem',
                                            fontWeight: '600'
                                        }}>
                                            {groupMembers.length}/{selectedGroup.max_members}
                                        </span>
                                    </div>

                                    <div style={{ marginBottom: '1rem' }}>
                                        <label className="form-label">Horario del tour</label>
                                        <input
                                            type="datetime-local"
                                            className="form-input"
                                            value={selectedGroup.tour_datetime?.slice(0, 16) || ''}
                                            onChange={(e) => handleUpdateDatetime(e.target.value)}
                                        />
                                    </div>

                                    <button
                                        onClick={() => handleDeleteGroup(selectedGroup.id)}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: '#e74c3c',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        Eliminar grupo
                                    </button>
                                </div>

                                {/* Members */}
                                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '1rem' }}>
                                    <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Miembros asignados</h3>
                                    {groupMembers.length === 0 ? (
                                        <p style={{ color: '#666', textAlign: 'center' }}>Sin miembros asignados</p>
                                    ) : (
                                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                                            {groupMembers.map((member, idx) => (
                                                <div
                                                    key={member.id}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '0.5rem 0.75rem',
                                                        background: '#f8f9fa',
                                                        borderRadius: '4px'
                                                    }}
                                                >
                                                    <div>
                                                        <strong>{idx + 1}.</strong> {member.passenger_first_name} {member.passenger_last_name}
                                                        <span style={{ color: '#666', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                                                            ({member.reservation_code})
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveMember(member.id)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: '#e74c3c',
                                                            cursor: 'pointer',
                                                            fontSize: '0.9rem'
                                                        }}
                                                    >
                                                        Quitar
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Add passengers grouped by reservation */}
                                {groupMembers.length < selectedGroup.max_members && eligiblePassengers.length > 0 && (
                                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px' }}>
                                        <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>
                                            Pasajeros disponibles ({eligiblePassengers.length})
                                        </h3>
                                        <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                            Agrupados por reservación. Selecciona para asignar.
                                        </p>
                                        <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '1rem' }}>
                                            {Object.entries(
                                                eligiblePassengers.reduce((acc, p) => {
                                                    const code = p.reservation_code
                                                    if (!acc[code]) acc[code] = []
                                                    acc[code].push(p)
                                                    return acc
                                                }, {} as Record<string, EligiblePassenger[]>)
                                            ).map(([code, passengers]) => (
                                                <div key={code} style={{ marginBottom: '1rem', border: '1px solid #eee', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        background: '#f8f9fa',
                                                        padding: '0.5rem 0.75rem',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '600',
                                                        color: '#555',
                                                        borderBottom: '1px solid #eee'
                                                    }}>
                                                        Reserva: {code} ({passengers.length})
                                                    </div>
                                                    {passengers.map(passenger => (
                                                        <label
                                                            key={passenger.id}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem',
                                                                padding: '0.5rem 0.75rem',
                                                                cursor: 'pointer',
                                                                borderBottom: '1px solid #eee',
                                                                background: selectedPassengers.includes(passenger.id) ? '#e3f2fd' : 'white'
                                                            }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedPassengers.includes(passenger.id)}
                                                                onChange={() => handleTogglePassenger(passenger.id)}
                                                            />
                                                            <div>
                                                                <div>{passenger.first_name} {passenger.last_name}</div>
                                                                {passenger.congregation && (
                                                                    <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                                                        {passenger.congregation}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={handleAssignPassengers}
                                            disabled={selectedPassengers.length === 0}
                                            className="nav-button"
                                        >
                                            Asignar {selectedPassengers.length} seleccionados
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{
                                background: 'white',
                                padding: '3rem',
                                borderRadius: '8px',
                                textAlign: 'center',
                                color: '#666'
                            }}>
                                <p>Selecciona un grupo para ver detalles y asignar miembros</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
