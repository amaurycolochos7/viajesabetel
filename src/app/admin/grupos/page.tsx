'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface TourGroup {
    id: string
    group_name: string
    tour_datetime: string | null
    max_members: number
    notes: string | null
    created_at: string
    bethel_code?: string
    captain_id?: string
    captain?: {
        first_name: string
        last_name: string
    }
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
    passenger_age: number | null
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
    const [newGroupBethelCode, setNewGroupBethelCode] = useState('')
    const [isCreating, setIsCreating] = useState(false)

    const [selectedGroup, setSelectedGroup] = useState<TourGroup | null>(null)
    const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
    const [selectedPassengers, setSelectedPassengers] = useState<string[]>([])

    // Helper to format Date for input (YYYY-MM-DDTHH:mm)
    const formatForInput = (isoString: string | null) => {
        if (!isoString) return ''
        const date = new Date(isoString)
        const pad = (n: number) => n.toString().padStart(2, '0')
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    // Helper to format Input to ISO for DB
    const formatForDB = (localString: string) => {
        if (!localString) return null
        return new Date(localString).toISOString()
    }

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
        // Load groups
        const { data: groupsData } = await supabase
            .from('tour_groups')
            .select(`
                *,
                captain:captain_id(first_name, last_name)
            `)
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
        reservation_passengers!inner(first_name, last_name, age),
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
                passenger_age: m.reservation_passengers?.age,
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
                    tour_datetime: formatForDB(newGroupDatetime),
                    bethel_code: newGroupBethelCode || null,
                })

            if (error) throw error

            setNewGroupName('')
            setNewGroupDatetime('')
            setNewGroupBethelCode('')
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
        // Auto-scroll to details on mobile/tablet
        if (window.innerWidth < 1024) {
            setTimeout(() => {
                document.getElementById('group-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 100)
        }
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
                .update({ tour_datetime: formatForDB(datetime) })
                .eq('id', selectedGroup.id)

            if (error) throw error

            setSelectedGroup({ ...selectedGroup, tour_datetime: formatForDB(datetime) || null })
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

    const handleUpdateBethelCode = async (code: string) => {
        if (!selectedGroup) return

        try {
            const { error } = await supabase
                .from('tour_groups')
                .update({ bethel_code: code || null })
                .eq('id', selectedGroup.id)

            if (error) throw error

            setSelectedGroup({ ...selectedGroup, bethel_code: code })
            await loadData()
        } catch (err) {
            console.error(err)
            alert('Error al actualizar código Bethel')
        }
    }

    const handleUpdateCaptain = async (captainId: string) => {
        if (!selectedGroup) return

        try {
            const { error } = await supabase
                .from('tour_groups')
                .update({ captain_id: captainId || null })
                .eq('id', selectedGroup.id)

            if (error) throw error

            // Find captain name
            const captainMember = groupMembers.find(m => m.passenger_id === captainId)
            const captainData = captainMember
                ? { first_name: captainMember.passenger_first_name, last_name: captainMember.passenger_last_name }
                : undefined

            setSelectedGroup({ ...selectedGroup, captain_id: captainId, captain: captainData })
            await loadData()
        } catch (err) {
            console.error(err)
            alert('Error al actualizar capitán')
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

    const handleDownloadPDF = () => {
        if (!selectedGroup || groupMembers.length === 0) return

        const doc = new jsPDF()
        const pageWidth = doc.internal.pageSize.width
        const darkColor = [30, 41, 59] as [number, number, number] // #1e293b

        // --- Header Background ---
        doc.setFillColor(darkColor[0], darkColor[1], darkColor[2])
        doc.rect(0, 0, pageWidth, 40, 'F')

        // --- Header Text ---
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(22)
        doc.setFont('helvetica', 'bold')
        doc.text('REPORTE DE GRUPO', 14, 20)

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text('VIAJE A BETEL 2026', 14, 28)

        // --- Group Info Box ---
        const startY = 55

        // Group Name
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text(`Grupo: ${selectedGroup.group_name}`, 14, startY)

        // Reset font for details
        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(50)

        let currentY = startY + 8

        // Bethel Code
        if (selectedGroup.bethel_code) {
            doc.setFont('helvetica', 'bold')
            doc.text(`Código Bethel: ${selectedGroup.bethel_code}`, 14, currentY)
            doc.setFont('helvetica', 'normal') // reset
            currentY += 8
        }

        // Captain
        if (selectedGroup.captain) {
            doc.text(`Capitán: ${selectedGroup.captain.first_name} ${selectedGroup.captain.last_name}`, 14, currentY)
            currentY += 8
        }

        // Date
        const dateStr = selectedGroup.tour_datetime
            ? new Date(selectedGroup.tour_datetime).toLocaleString('es-MX', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            })
            : 'Sin fecha asignada'

        // Capitalize date
        const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)

        doc.text(`Fecha y Horario: ${formattedDate}`, 14, currentY)
        currentY += 8

        doc.text(`Total de personas: ${groupMembers.length} / ${selectedGroup.max_members}`, 14, currentY)
        currentY += 12 // Space before table

        // --- Table ---
        const tableData = groupMembers.map((m, index) => [
            index + 1,
            m.passenger_first_name,
            m.passenger_last_name,
            m.passenger_age !== undefined && m.passenger_age !== null ? m.passenger_age : '-',
            m.reservation_code
        ])

        autoTable(doc, {
            head: [['No.', 'NOMBRE', 'APELLIDOS', 'EDAD', 'CÓDIGO DE RESERVA']],
            body: tableData,
            startY: currentY,
            theme: 'grid',
            headStyles: {
                fillColor: darkColor,
                textColor: [255, 255, 255],
                fontSize: 10,
                fontStyle: 'bold',
                halign: 'center',
                minCellHeight: 12,
                valign: 'middle'
            },
            bodyStyles: {
                fontSize: 10,
                cellPadding: 6,
                textColor: [51, 65, 85]
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 15 }, // No.
                3: { halign: 'center', cellWidth: 20 }, // Edad
                4: { fontStyle: 'bold', halign: 'center' } // Code
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            didDrawPage: (data) => {
                // Footer
                doc.setFontSize(8)
                doc.setTextColor(150)
                doc.text(
                    `Generado el ${new Date().toLocaleString('es-MX')}`,
                    14,
                    doc.internal.pageSize.height - 10
                )
                doc.text(
                    `Página ${data.pageNumber}`,
                    pageWidth - 25,
                    doc.internal.pageSize.height - 10
                )
            }
        })

        const fileName = `Grupo-${selectedGroup.group_name.replace(/\s+/g, '-')}.pdf`
        doc.save(fileName)
    }

    if (isLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                <p style={{ color: '#64748b' }}>Cargando...</p>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f8f9fa', paddingBottom: '2rem' }}>
            {/* Header */}
            <header style={{
                background: 'white',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                padding: '1rem',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link href="/admin" style={{ color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                    </Link>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: '#1e293b' }}>Grupos de Tour</h1>
                </div>
            </header>

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
                {/* Link público */}
                <div style={{
                    background: 'white',
                    padding: '1.5rem',
                    borderRadius: '16px',
                    marginBottom: '2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3b82f6' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                                <strong style={{ color: '#334155', fontSize: '1rem' }}>Link público para pasajeros</strong>
                            </div>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#64748b', wordBreak: 'break-all', background: '#f1f5f9', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                                {getPublicLink()}
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(getPublicLink())
                                alert('Link copiado al portapapeles')
                            }}
                            style={{
                                padding: '0.75rem 1.25rem',
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '700',
                                fontSize: '0.9rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                            Copiar Link
                        </button>
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '2rem',
                    alignItems: 'flex-start'
                }}>
                    {/* Left: Groups list */}
                    <div style={{
                        flex: '1 1 300px',
                        minWidth: '280px',
                        width: '100%'
                    }}>
                        {/* New Group Card */}
                        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', marginBottom: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)' }}>
                            <h2 style={{ fontWeight: '700', marginBottom: '1.25rem', color: '#1e293b', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10b981' }}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                Crear Nuevo Grupo
                            </h2>
                            <div style={{ marginBottom: '1rem' }}>
                                <input
                                    type="text"
                                    style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                    placeholder="Nombre del grupo (ej: Grupo 1)"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                />
                            </div>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <input
                                    type="datetime-local"
                                    style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', color: '#334155', boxSizing: 'border-box' }}
                                    value={newGroupDatetime}
                                    onChange={(e) => setNewGroupDatetime(e.target.value)}
                                />
                            </div>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <input
                                    type="text"
                                    style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                    placeholder="Código Bethel (Opcional)"
                                    value={newGroupBethelCode}
                                    onChange={(e) => setNewGroupBethelCode(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={handleCreateGroup}
                                disabled={isCreating || !newGroupName.trim()}
                                style={{
                                    width: '100%',
                                    padding: '0.85rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: '#10b981',
                                    color: 'white',
                                    fontWeight: '700',
                                    cursor: isCreating ? 'not-allowed' : 'pointer',
                                    opacity: isCreating ? 0.7 : 1,
                                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                                }}
                            >
                                {isCreating ? 'Creando...' : 'Crear Grupo'}
                            </button>
                        </div>

                        {/* List Groups */}
                        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)' }}>
                            <h3 style={{ fontWeight: '700', marginBottom: '1.25rem', color: '#334155', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Grupos Disponibles ({groups.length})
                            </h3>
                            {groups.length === 0 ? (
                                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem 1rem', border: '1px dashed #e2e8f0', borderRadius: '8px' }}>
                                    No hay grupos creados
                                </p>
                            ) : (
                                <div style={{ display: 'grid', gap: '0.75rem' }}>
                                    {groups.map(group => (
                                        <button
                                            key={group.id}
                                            onClick={() => handleSelectGroup(group)}
                                            style={{
                                                padding: '1rem',
                                                border: selectedGroup?.id === group.id ? '2px solid #3b82f6' : '1px solid #f1f5f9',
                                                borderRadius: '10px',
                                                background: selectedGroup?.id === group.id ? '#eff6ff' : '#f8fafc',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                transition: 'all 0.2s',
                                                width: '100%',
                                                position: 'relative'
                                            }}
                                        >
                                            <div style={{ fontWeight: '700', color: selectedGroup?.id === group.id ? '#1d4ed8' : '#334155', fontSize: '1.05rem', marginBottom: '4px' }}>
                                                {group.group_name}
                                            </div>
                                            {group.tour_datetime ? (
                                                <div style={{ fontSize: '0.85rem', color: selectedGroup?.id === group.id ? '#60a5fa' : '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                                    {new Date(group.tour_datetime).toLocaleString('es-MX', {
                                                        weekday: 'short', day: 'numeric', month: 'short',
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Sin horario asignado</div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Group details */}
                    <div id="group-details" style={{ flex: '999 1 300px', minWidth: '300px', width: '100%' }}>
                        {selectedGroup ? (
                            <>
                                {/* Group Info Card */}
                                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', marginBottom: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                        <div style={{ flex: 1, minWidth: '200px' }}>
                                            <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Nombre del Grupo</label>
                                            <input
                                                type="text"
                                                style={{ fontSize: '1.5rem', fontWeight: '800', padding: '0.5rem', border: '1px solid transparent', borderRadius: '6px', width: '100%', color: '#1e293b', background: 'transparent', transition: 'border 0.2s', marginLeft: '-0.5rem' }}
                                                defaultValue={selectedGroup.group_name}
                                                key={selectedGroup.id}
                                                onBlur={(e) => handleUpdateGroupName(e.target.value)}
                                                className="editable-input" // Add global css for focus state if needed
                                            />
                                        </div>
                                        <div style={{
                                            padding: '0.75rem 1.25rem',
                                            borderRadius: '50px',
                                            background: groupMembers.length >= selectedGroup.max_members ? '#ecfdf5' : '#fffbeb',
                                            color: groupMembers.length >= selectedGroup.max_members ? '#059669' : '#d97706',
                                            fontSize: '1rem',
                                            fontWeight: '700',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            border: `1px solid ${groupMembers.length >= selectedGroup.max_members ? '#a7f3d0' : '#fcd34d'}`
                                        }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                            {groupMembers.length} / {selectedGroup.max_members}
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Código Bethel</label>
                                        <input
                                            type="text"
                                            style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', color: '#334155' }}
                                            value={selectedGroup.bethel_code || ''}
                                            onChange={(e) => handleUpdateBethelCode(e.target.value)}
                                            placeholder="Ingresa código..."
                                        />
                                    </div>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Capitán del Grupo</label>
                                        <select
                                            style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', color: '#334155' }}
                                            value={selectedGroup.captain_id || ''}
                                            onChange={(e) => handleUpdateCaptain(e.target.value)}
                                        >
                                            <option value="">-- Sin Capitán --</option>
                                            {groupMembers.map(member => (
                                                <option key={member.passenger_id} value={member.passenger_id}>
                                                    {member.passenger_first_name} {member.passenger_last_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{ marginBottom: '2rem' }}>
                                        <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Horario del tour</label>
                                        <input
                                            type="datetime-local"
                                            style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', color: '#334155' }}
                                            value={formatForInput(selectedGroup.tour_datetime)}
                                            onChange={(e) => handleUpdateDatetime(e.target.value)}
                                        />
                                    </div>

                                    <button
                                        onClick={() => handleDeleteGroup(selectedGroup.id)}
                                        style={{
                                            padding: '0.75rem',
                                            background: '#fef2f2',
                                            color: '#dc2626',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: '700',
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            transition: 'background 0.2s'
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                        Eliminar Grupo
                                    </button>

                                    <button
                                        onClick={handleDownloadPDF}
                                        disabled={groupMembers.length === 0}
                                        style={{
                                            padding: '0.75rem',
                                            background: '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: groupMembers.length === 0 ? 'not-allowed' : 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: '700',
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            marginTop: '1rem',
                                            opacity: groupMembers.length === 0 ? 0.6 : 1
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                        Descargar PDF
                                    </button>
                                </div>

                                {/* Members List */}
                                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', marginBottom: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)' }}>
                                    <h3 style={{ fontWeight: '700', marginBottom: '1.25rem', color: '#1e293b', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></svg>
                                        Miembros Asignados
                                    </h3>
                                    {groupMembers.length === 0 ? (
                                        <div style={{ padding: '3rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', color: '#94a3b8', border: '1px dashed #e2e8f0' }}>
                                            Este grupo está vacío
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                                            {groupMembers.map((member, idx) => (
                                                <div
                                                    key={member.id}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '1rem',
                                                        background: 'white',
                                                        border: '1px solid #f1f5f9',
                                                        borderRadius: '12px',
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                                        transition: 'transform 0.1s'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <span style={{ color: '#cbd5e1', fontWeight: '700', fontSize: '1.2rem', minWidth: '24px' }}>{idx + 1}</span>
                                                        <div>
                                                            <strong style={{ color: '#334155', display: 'block', fontSize: '1rem' }}>
                                                                {member.passenger_first_name} {member.passenger_last_name}
                                                                {member.passenger_id === selectedGroup.captain_id && (
                                                                    <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fcd34d' }}>CAPITÁN</span>
                                                                )}
                                                            </strong>
                                                            <span style={{ color: '#64748b', fontSize: '0.8rem', fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                                                {member.reservation_code}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveMember(member.id)}
                                                        style={{
                                                            background: '#fee2e2',
                                                            border: 'none',
                                                            color: '#dc2626',
                                                            cursor: 'pointer',
                                                            fontSize: '0.75rem',
                                                            fontWeight: '700',
                                                            padding: '0.5rem 0.75rem',
                                                            borderRadius: '6px',
                                                            transition: 'background 0.2s'
                                                        }}
                                                    >
                                                        Quitar
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Add passengers */}
                                {groupMembers.length < selectedGroup.max_members && eligiblePassengers.length > 0 && (
                                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)' }}>
                                        <h3 style={{ fontWeight: '700', marginBottom: '0.25rem', color: '#1e293b', fontSize: '1.1rem' }}>
                                            Agregar Pasajeros
                                        </h3>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                                            Selecciona pasajeros para agregarlos a este grupo.
                                        </p>

                                        <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
                                            {Object.entries(
                                                eligiblePassengers.reduce((acc, p) => {
                                                    const code = p.reservation_code
                                                    if (!acc[code]) acc[code] = []
                                                    acc[code].push(p)
                                                    return acc
                                                }, {} as Record<string, EligiblePassenger[]>)
                                            ).map(([code, passengers]) => (
                                                <div key={code} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                    <div style={{
                                                        background: '#f1f5f9',
                                                        padding: '0.75rem 1rem',
                                                        fontSize: '0.8rem',
                                                        fontWeight: '800',
                                                        color: '#475569',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px'
                                                    }}>
                                                        {code} <span style={{ fontWeight: '600', color: '#94a3b8' }}>({passengers.length})</span>
                                                    </div>
                                                    {passengers.map(passenger => (
                                                        <label
                                                            key={passenger.id}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '1rem',
                                                                padding: '1rem',
                                                                cursor: 'pointer',
                                                                borderBottom: '1px solid #f1f5f9',
                                                                background: selectedPassengers.includes(passenger.id) ? '#eff6ff' : 'white',
                                                                transition: 'background 0.2s'
                                                            }}
                                                        >
                                                            <div style={{
                                                                width: '24px',
                                                                height: '24px',
                                                                borderRadius: '6px',
                                                                border: selectedPassengers.includes(passenger.id) ? '2px solid #3b82f6' : '2px solid #cbd5e1',
                                                                background: selectedPassengers.includes(passenger.id) ? '#3b82f6' : 'white',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'all 0.2s'
                                                            }}>
                                                                {selectedPassengers.includes(passenger.id) && (
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                )}
                                                            </div>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedPassengers.includes(passenger.id)}
                                                                onChange={() => handleTogglePassenger(passenger.id)}
                                                                style={{ display: 'none' }} // Custom checkbox above
                                                            />
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ color: '#334155', fontWeight: '600', fontSize: '0.95rem' }}>{passenger.first_name} {passenger.last_name}</div>
                                                                {passenger.congregation && (
                                                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
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
                                            style={{
                                                width: '100%',
                                                padding: '1rem',
                                                background: selectedPassengers.length > 0 ? '#3b82f6' : '#cbd5e1',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '12px',
                                                fontWeight: '800',
                                                fontSize: '1rem',
                                                cursor: selectedPassengers.length === 0 ? 'not-allowed' : 'pointer',
                                                boxShadow: selectedPassengers.length > 0 ? '0 4px 6px -1px rgba(59, 130, 246, 0.5)' : 'none',
                                                transition: 'all 0.2s',
                                                transform: selectedPassengers.length > 0 ? 'translateY(0)' : 'translateY(1px)'
                                            }}
                                        >
                                            Asignar {selectedPassengers.length} seleccionados
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{
                                background: 'white',
                                padding: '4rem 2rem',
                                borderRadius: '16px',
                                textAlign: 'center',
                                color: '#94a3b8',
                                border: '2px dashed #e2e8f0',
                                height: '100%',
                                minHeight: '300px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <div style={{ background: '#f1f5f9', padding: '1.5rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#cbd5e1' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                </div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#64748b', marginBottom: '0.5rem' }}>Ningún grupo seleccionado</h3>
                                <p style={{ fontSize: '0.9rem', maxWidth: '250px', lineHeight: '1.5' }}>Selecciona un grupo de la lista de la izquierda para ver sus detalles y administrar pasajeros.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
