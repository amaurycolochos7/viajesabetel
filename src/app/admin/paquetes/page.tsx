'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { supabaseAttractions } from '@/lib/supabase-attractions'
import { PackageReservation, AttractionPackage } from '@/types'

type FilterType = 'todos' | 'museos' | 'acuario_adultos' | 'acuario_ninos' | 'pendientes' | 'pagados'

// Interface para items consolidados por tipo de paquete
interface ConsolidatedItem {
    packageType: string
    numPeople: number
    totalAmount: number
    amountPaid: number
    originalItems: PackageReservation[] // Para acceder a los IDs originales
}

// Interface para reservaciones agrupadas por código de viaje
interface GroupedReservation {
    betelCode: string
    responsibleName: string
    consolidatedItems: ConsolidatedItem[]
    totalAmount: number
    totalPaid: number
    totalPending: number
    paymentStatus: 'pagado' | 'parcial' | 'pendiente'
}

export default function PaquetesAdminPage() {
    const router = useRouter()
    const [packages, setPackages] = useState<AttractionPackage[]>([])
    const [reservations, setReservations] = useState<PackageReservation[]>([])
    const [filteredReservations, setFilteredReservations] = useState<PackageReservation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<FilterType>('todos')
    const [showNewModal, setShowNewModal] = useState(false)
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [selectedReservation, setSelectedReservation] = useState<PackageReservation | null>(null)
    const [selectedConsolidatedItem, setSelectedConsolidatedItem] = useState<ConsolidatedItem | null>(null)

    useEffect(() => {
        checkAuthAndLoadData()
    }, [])

    useEffect(() => {
        applyFilter()
    }, [filter, reservations])

    const checkAuthAndLoadData = async () => {
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
            await supabase.auth.signOut()
            router.push('/admin/login')
            return
        }

        await loadData()
    }

    const loadData = async () => {
        setIsLoading(true)

        // Paquetes hardcodeados como fallback
        const FALLBACK_PACKAGES = [
            { id: '1', package_type: 'museos', name: 'Museos', description: 'Museo de Cera + Museo Ripley + Viaje Fantástico', price: 175, active: true, created_at: new Date().toISOString() },
            { id: '2', package_type: 'acuario_adultos', name: 'Acuario + Museos (Adultos)', description: 'Acuario + Museos completo', price: 345, active: true, created_at: new Date().toISOString() },
            { id: '3', package_type: 'acuario_ninos', name: 'Acuario + Museos (Niños)', description: 'Acuario + Museos completo', price: 285, active: true, created_at: new Date().toISOString() }
        ]

        // Cargar paquetes desde la nueva BD de atracciones
        const { data: packagesData, error: packagesError } = await supabaseAttractions
            .from('attraction_packages')
            .select('*')
            .eq('active', true)
            .order('price')

        if (packagesError || !packagesData || packagesData.length === 0) {
            console.warn('Using fallback packages:', packagesError?.message)
            setPackages(FALLBACK_PACKAGES as any)
        } else {
            setPackages(packagesData)
        }

        // Cargar reservaciones desde la nueva BD de atracciones
        const { data: reservationsData, error: reservationsError } = await supabaseAttractions
            .from('package_reservations')
            .select('*')
            .order('created_at', { ascending: false })

        if (reservationsError) {
            console.warn('Error loading reservations:', reservationsError.message)
            setReservations([])
        } else {
            setReservations(reservationsData || [])
        }

        setIsLoading(false)
    }

    const applyFilter = () => {
        let filtered = [...reservations]

        if (filter === 'museos') {
            filtered = filtered.filter(r => r.package_type === 'museos')
        } else if (filter === 'acuario_adultos') {
            filtered = filtered.filter(r => r.package_type === 'acuario_adultos')
        } else if (filter === 'acuario_ninos') {
            filtered = filtered.filter(r => r.package_type === 'acuario_ninos')
        } else if (filter === 'pendientes') {
            filtered = filtered.filter(r => r.payment_status !== 'pagado')
        } else if (filter === 'pagados') {
            filtered = filtered.filter(r => r.payment_status === 'pagado')
        }

        setFilteredReservations(filtered)
    }

    // Extraer código Betel de las notas
    const extractBetelCode = (notes: string | null): string => {
        if (!notes) return 'SIN_CODIGO'
        const match = notes.match(/Reservacion Betel:\s*(BETEL-[A-Z0-9-]+)/i)
        return match ? match[1] : 'SIN_CODIGO'
    }

    // Agrupar reservaciones por código de viaje Betel Y consolidar por tipo de paquete
    const groupReservationsByBetelCode = (reservations: PackageReservation[]): GroupedReservation[] => {
        const groups: Record<string, {
            betelCode: string
            responsibleName: string
            itemsByType: Record<string, { items: PackageReservation[], numPeople: number, totalAmount: number, amountPaid: number }>
            totalAmount: number
            totalPaid: number
        }> = {}

        reservations.forEach(r => {
            const betelCode = extractBetelCode((r as any).notes)
            const key = betelCode + '_' + ((r as any).responsible_name || 'unknown')

            if (!groups[key]) {
                groups[key] = {
                    betelCode,
                    responsibleName: (r as any).responsible_name || 'Sin nombre',
                    itemsByType: {},
                    totalAmount: 0,
                    totalPaid: 0
                }
            }

            // Consolidar por tipo de paquete
            if (!groups[key].itemsByType[r.package_type]) {
                groups[key].itemsByType[r.package_type] = {
                    items: [],
                    numPeople: 0,
                    totalAmount: 0,
                    amountPaid: 0
                }
            }

            groups[key].itemsByType[r.package_type].items.push(r)
            groups[key].itemsByType[r.package_type].numPeople += r.num_people
            groups[key].itemsByType[r.package_type].totalAmount += r.total_amount
            groups[key].itemsByType[r.package_type].amountPaid += r.amount_paid
            groups[key].totalAmount += r.total_amount
            groups[key].totalPaid += r.amount_paid
        })

        // Convertir a la estructura final
        const result: GroupedReservation[] = Object.values(groups).map(g => {
            const consolidatedItems: ConsolidatedItem[] = Object.entries(g.itemsByType).map(([packageType, data]) => ({
                packageType,
                numPeople: data.numPeople,
                totalAmount: data.totalAmount,
                amountPaid: data.amountPaid,
                originalItems: data.items
            }))

            const totalPending = g.totalAmount - g.totalPaid
            let paymentStatus: 'pagado' | 'parcial' | 'pendiente' = 'pendiente'
            if (g.totalPaid >= g.totalAmount) {
                paymentStatus = 'pagado'
            } else if (g.totalPaid > 0) {
                paymentStatus = 'parcial'
            }

            return {
                betelCode: g.betelCode,
                responsibleName: g.responsibleName,
                consolidatedItems,
                totalAmount: g.totalAmount,
                totalPaid: g.totalPaid,
                totalPending,
                paymentStatus
            }
        })

        // Ordenar por fecha más reciente
        return result.sort((a, b) => {
            const aDate = a.consolidatedItems[0]?.originalItems[0]?.created_at || ''
            const bDate = b.consolidatedItems[0]?.originalItems[0]?.created_at || ''
            return bDate.localeCompare(aDate)
        })
    }

    const groupedReservations = groupReservationsByBetelCode(filteredReservations)

    const getPackageColor = (packageType: string) => {
        const colors: Record<string, string> = {
            museos: '#e91e63',
            acuario_adultos: '#0277bd',
            acuario_ninos: '#4caf50'
        }
        return colors[packageType] || '#666'
    }

    const getPackageName = (packageType: string) => {
        const names: Record<string, string> = {
            museos: 'Museos',
            acuario_adultos: 'Acuario + Museos (Adultos)',
            acuario_ninos: 'Acuario + Museos (Niños)'
        }
        return names[packageType] || packageType
    }

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            pendiente: 'Pendiente',
            parcial: 'Parcial',
            pagado: 'Pagado'
        }
        return labels[status] || status
    }

    const formatMoney = (amount: number) => {
        return amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    const deleteReservation = async (id: string) => {
        if (!confirm('¿Eliminar esta reservación de paquete?')) return

        try {
            const { error } = await supabaseAttractions
                .from('package_reservations')
                .delete()
                .eq('id', id)

            if (error) {
                console.error('Error deleting:', error)
                alert('Error al eliminar')
            } else {
                setReservations(reservations.filter(r => r.id !== id))
            }
        } catch (e) {
            console.error('Error deleting:', e)
        }
    }

    // Consolidar múltiples registros duplicados en uno solo
    const consolidateRecords = async (items: PackageReservation[]) => {
        if (items.length <= 1) {
            alert('Solo hay 1 registro, no es necesario consolidar')
            return
        }

        if (!confirm(`¿Consolidar ${items.length} registros en 1? Esto sumará todas las personas y montos.`)) return

        try {
            const totalPeople = items.reduce((sum, i) => sum + i.num_people, 0)
            const totalAmount = items.reduce((sum, i) => sum + i.total_amount, 0)
            const totalPaid = items.reduce((sum, i) => sum + i.amount_paid, 0)

            // Actualizar el primer registro con los totales
            const { error: updateError } = await supabaseAttractions
                .from('package_reservations')
                .update({
                    num_people: totalPeople,
                    total_amount: totalAmount,
                    amount_paid: totalPaid,
                    payment_status: totalPaid >= totalAmount ? 'pagado' : totalPaid > 0 ? 'parcial' : 'pendiente'
                })
                .eq('id', items[0].id)

            if (updateError) throw updateError

            // Eliminar los registros restantes
            for (let i = 1; i < items.length; i++) {
                await supabaseAttractions
                    .from('package_reservations')
                    .delete()
                    .eq('id', items[i].id)
            }

            alert('✅ Registros consolidados correctamente')
            await loadData()
        } catch (e) {
            console.error('Error consolidating:', e)
            alert('Error al consolidar registros')
        }
    }

    // Actualizar cantidad de personas en un registro
    const updateNumPeople = async (id: string, packageType: string, newNumPeople: number) => {
        const pkg = packages.find(p => p.package_type === packageType)
        if (!pkg) return

        const newTotal = pkg.price * newNumPeople

        try {
            const { error } = await supabaseAttractions
                .from('package_reservations')
                .update({
                    num_people: newNumPeople,
                    total_amount: newTotal
                })
                .eq('id', id)

            if (error) throw error
            await loadData()
        } catch (e) {
            console.error('Error updating:', e)
            alert('Error al actualizar')
        }
    }

    // Calculate statistics
    const stats = {
        totalMuseos: reservations.filter(r => r.package_type === 'museos').reduce((sum, r) => sum + r.num_people, 0),
        totalAcuarioAdultos: reservations.filter(r => r.package_type === 'acuario_adultos').reduce((sum, r) => sum + r.num_people, 0),
        totalAcuarioNinos: reservations.filter(r => r.package_type === 'acuario_ninos').reduce((sum, r) => sum + r.num_people, 0),
        totalRecaudado: reservations.reduce((sum, r) => sum + r.amount_paid, 0),
        pendientesCobro: reservations.filter(r => r.payment_status !== 'pagado').length,
    }

    if (isLoading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8f9fa'
            }}>
                <p>Cargando...</p>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f8f9fa', paddingBottom: '4rem' }}>
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
                <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1 style={{
                                fontSize: '1.5rem',
                                fontWeight: '800',
                                color: '#1a1a1a',
                                margin: 0,
                                letterSpacing: '-0.5px'
                            }}>
                                🎟️ Paquetes de Atracciones
                            </h1>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Gestión de entradas</p>
                        </div>
                        <Link
                            href="/admin"
                            style={{
                                background: '#f5f5f5',
                                border: 'none',
                                color: '#666',
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                textDecoration: 'none',
                                fontSize: '0.9rem',
                                fontWeight: '600'
                            }}
                        >
                            ← Dashboard
                        </Link>
                    </div>
                </div>
            </header>

            <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>
                {/* Statistics Cards - Clickable */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '0.75rem',
                    marginBottom: '1.5rem'
                }}>
                    <div
                        onClick={() => setFilter('museos')}
                        style={{
                            background: filter === 'museos' ? '#fce4ec' : 'white',
                            padding: '1rem',
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            cursor: 'pointer',
                            border: filter === 'museos' ? '2px solid #e91e63' : '2px solid transparent',
                            transition: 'all 0.2s'
                        }}
                    >
                        <div style={{ fontSize: '0.7rem', color: '#e91e63', fontWeight: '600', marginBottom: '0.25rem' }}>MUSEOS</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#2c3e50' }}>{stats.totalMuseos}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>personas</div>
                    </div>
                    <div
                        onClick={() => setFilter('acuario_adultos')}
                        style={{
                            background: filter === 'acuario_adultos' ? '#e3f2fd' : 'white',
                            padding: '1rem',
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            cursor: 'pointer',
                            border: filter === 'acuario_adultos' ? '2px solid #0277bd' : '2px solid transparent',
                            transition: 'all 0.2s'
                        }}
                    >
                        <div style={{ fontSize: '0.7rem', color: '#0277bd', fontWeight: '600', marginBottom: '0.25rem' }}>ACUARIO ADULTOS</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#2c3e50' }}>{stats.totalAcuarioAdultos}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>personas</div>
                    </div>
                    <div
                        onClick={() => setFilter('acuario_ninos')}
                        style={{
                            background: filter === 'acuario_ninos' ? '#e8f5e9' : 'white',
                            padding: '1rem',
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            cursor: 'pointer',
                            border: filter === 'acuario_ninos' ? '2px solid #4caf50' : '2px solid transparent',
                            transition: 'all 0.2s'
                        }}
                    >
                        <div style={{ fontSize: '0.7rem', color: '#4caf50', fontWeight: '600', marginBottom: '0.25rem' }}>ACUARIO NIÑOS</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#2c3e50' }}>{stats.totalAcuarioNinos}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>personas</div>
                    </div>
                    <div
                        onClick={() => setFilter('pagados')}
                        style={{
                            background: filter === 'pagados' ? '#e8f5e9' : 'white',
                            padding: '1rem',
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            cursor: 'pointer',
                            border: filter === 'pagados' ? '2px solid #2e7d32' : '2px solid transparent',
                            transition: 'all 0.2s'
                        }}
                    >
                        <div style={{ fontSize: '0.7rem', color: '#2e7d32', fontWeight: '600', marginBottom: '0.25rem' }}>RECAUDADO</div>
                        <div style={{ fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', fontWeight: '800', color: '#2e7d32', wordBreak: 'break-all' }}>${formatMoney(stats.totalRecaudado)}</div>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginBottom: '1.5rem',
                    overflowX: 'auto',
                    paddingBottom: '0.5rem'
                }}>
                    {[
                        { key: 'todos', label: 'Todos' },
                        { key: 'museos', label: 'Museos' },
                        { key: 'acuario_adultos', label: 'Acuario Adultos' },
                        { key: 'acuario_ninos', label: 'Acuario Niños' },
                        { key: 'pendientes', label: 'Pendientes' },
                        { key: 'pagados', label: '✓ Pagados' }
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key as FilterType)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: filter === tab.key ? '#3b82f6' : 'white',
                                color: filter === tab.key ? 'white' : '#666',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                boxShadow: filter === tab.key ? '0 2px 4px rgba(59, 130, 246, 0.2)' : '0 2px 4px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Package Reservations List - AGRUPADO */}
                {groupedReservations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '12px' }}>
                        <p style={{ color: '#94a3b8', margin: 0 }}>No hay reservaciones de paquetes</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {groupedReservations.map((group, idx) => (
                            <div
                                key={group.betelCode + idx}
                                style={{
                                    background: 'white',
                                    borderRadius: '12px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                    overflow: 'hidden'
                                }}
                            >
                                {/* Header de la tarjeta agrupada */}
                                <div style={{
                                    background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
                                    padding: '1rem',
                                    color: 'white'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                        <div>
                                            <div style={{ fontWeight: '700', fontSize: '1rem' }}>
                                                {group.responsibleName}
                                            </div>
                                            <div style={{
                                                fontSize: '0.75rem',
                                                opacity: 0.85,
                                                fontFamily: 'monospace',
                                                marginTop: '0.25rem'
                                            }}>
                                                {group.betelCode !== 'SIN_CODIGO' ? group.betelCode : 'Sin codigo Betel'}
                                            </div>
                                        </div>
                                        <span style={{
                                            fontSize: '0.7rem',
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            background: group.paymentStatus === 'pagado' ? '#22c55e' :
                                                group.paymentStatus === 'parcial' ? '#f59e0b' : 'rgba(255,255,255,0.2)',
                                            color: 'white'
                                        }}>
                                            {getStatusLabel(group.paymentStatus)}
                                        </span>
                                    </div>
                                </div>

                                {/* Lista de paquetes dentro del grupo */}
                                <div style={{ padding: '1rem' }}>
                                    <div style={{
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        color: '#64748b',
                                        marginBottom: '0.5rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        Paquetes Reservados ({group.consolidatedItems.length})
                                    </div>

                                    {group.consolidatedItems.map((item: ConsolidatedItem) => (
                                        <div
                                            key={item.packageType}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                padding: '0.6rem 0.75rem',
                                                marginBottom: '0.5rem',
                                                background: item.originalItems.length > 1 ? '#fffbeb' : '#f8fafc',
                                                borderRadius: '8px',
                                                borderLeft: `3px solid ${getPackageColor(item.packageType)}`
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{
                                                        fontWeight: '600',
                                                        color: getPackageColor(item.packageType),
                                                        fontSize: '0.85rem'
                                                    }}>
                                                        {getPackageName(item.packageType)}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '0.75rem',
                                                        color: '#64748b',
                                                        marginTop: '0.2rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem'
                                                    }}>
                                                        {item.numPeople} persona{item.numPeople !== 1 ? 's' : ''}
                                                        {item.originalItems.length > 1 && (
                                                            <span style={{
                                                                color: '#f59e0b',
                                                                fontWeight: '600',
                                                                background: '#fef3c7',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                fontSize: '0.7rem'
                                                            }}>
                                                                ⚠️ {item.originalItems.length} registros
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: '700', color: '#1e293b' }}>
                                                        ${formatMoney(item.totalAmount)}
                                                    </div>
                                                    {item.amountPaid > 0 && (
                                                        <div style={{ fontSize: '0.7rem', color: '#22c55e' }}>
                                                            Pagado: ${formatMoney(item.amountPaid)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                                                    {/* Botón Editar */}
                                                    <button
                                                        onClick={() => {
                                                            setSelectedConsolidatedItem(item)
                                                            setShowEditModal(true)
                                                        }}
                                                        style={{
                                                            padding: '0.4rem 0.5rem',
                                                            background: '#f0f9ff',
                                                            color: '#0369a1',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            fontSize: '0.7rem',
                                                            cursor: 'pointer'
                                                        }}
                                                        title="Editar registros"
                                                    >
                                                        ✏️
                                                    </button>
                                                    {/* Botón Consolidar (solo si hay más de 1 registro) */}
                                                    {item.originalItems.length > 1 && (
                                                        <button
                                                            onClick={() => consolidateRecords(item.originalItems)}
                                                            style={{
                                                                padding: '0.4rem 0.5rem',
                                                                background: '#fef3c7',
                                                                color: '#b45309',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                fontSize: '0.7rem',
                                                                fontWeight: '600',
                                                                cursor: 'pointer'
                                                            }}
                                                            title="Consolidar registros duplicados en 1"
                                                        >
                                                            🔀
                                                        </button>
                                                    )}
                                                    {/* Botón Pagar */}
                                                    <button
                                                        onClick={() => {
                                                            if (item.originalItems.length > 0) {
                                                                setSelectedReservation(item.originalItems[0])
                                                                setShowPaymentModal(true)
                                                            }
                                                        }}
                                                        style={{
                                                            padding: '0.4rem 0.6rem',
                                                            background: '#3b82f6',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            fontSize: '0.7rem',
                                                            fontWeight: '600',
                                                            cursor: 'pointer'
                                                        }}
                                                        title="Registrar pago"
                                                    >
                                                        Pagar
                                                    </button>
                                                    {/* Botón Eliminar */}
                                                    <button
                                                        onClick={() => deleteReservation(item.originalItems[0].id)}
                                                        style={{
                                                            padding: '0.4rem 0.5rem',
                                                            background: '#fee2e2',
                                                            color: '#dc2626',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            fontSize: '0.7rem',
                                                            cursor: 'pointer'
                                                        }}
                                                        title="Eliminar"
                                                    >
                                                        X
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Totales del grupo */}
                                    <div style={{
                                        marginTop: '0.75rem',
                                        padding: '0.75rem',
                                        background: '#f1f5f9',
                                        borderRadius: '8px',
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr 1fr',
                                        gap: '0.5rem',
                                        textAlign: 'center'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Total</div>
                                            <div style={{ fontWeight: '700', color: '#1e293b' }}>
                                                ${formatMoney(group.totalAmount)}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Pagado</div>
                                            <div style={{ fontWeight: '700', color: '#22c55e' }}>
                                                ${formatMoney(group.totalPaid)}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Pendiente</div>
                                            <div style={{ fontWeight: '700', color: group.totalPending > 0 ? '#dc2626' : '#22c55e' }}>
                                                ${formatMoney(group.totalPending)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* FAB Button */}
            <button
                onClick={() => setShowNewModal(true)}
                style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: '#9c27b0',
                    color: 'white',
                    border: 'none',
                    fontSize: '2rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(156, 39, 176, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
                title="Nueva Reservación de Paquete"
            >
                +
            </button>

            {/* Modals */}
            {showNewModal && <NewPackageModal onClose={() => { setShowNewModal(false); loadData(); }} packages={packages} />}
            {showPaymentModal && selectedReservation && (
                <PaymentModal
                    packageReservation={selectedReservation}
                    onClose={() => { setShowPaymentModal(false); setSelectedReservation(null); loadData(); }}
                />
            )}
            {showEditModal && selectedConsolidatedItem && (
                <EditPackageModal
                    consolidatedItem={selectedConsolidatedItem}
                    packages={packages}
                    onClose={() => { setShowEditModal(false); setSelectedConsolidatedItem(null); loadData(); }}
                    onDelete={deleteReservation}
                    onUpdateNumPeople={updateNumPeople}
                />
            )}
        </div>
    )
}

// Modal Component for creating new package reservation with MULTIPLE packages
interface PackageLine {
    id: string
    packageType: string
    numPeople: number
}

function NewPackageModal({ onClose, packages }: { onClose: () => void, packages: AttractionPackage[] }) {
    const [reservationCode, setReservationCode] = useState('')
    const [responsibleName, setResponsibleName] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [reservationFound, setReservationFound] = useState<boolean | null>(null)
    const [packageLines, setPackageLines] = useState<PackageLine[]>([
        { id: '1', packageType: '', numPeople: 1 }
    ])
    const [notes, setNotes] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    // Search for reservation when code changes
    useEffect(() => {
        const searchReservation = async () => {
            if (!reservationCode.trim() || reservationCode.trim().length < 5) {
                setResponsibleName('')
                setReservationFound(null)
                return
            }

            setIsSearching(true)
            try {
                const { data: reservation, error: searchError } = await supabase
                    .from('reservations')
                    .select('id, responsible_name, reservation_code')
                    .eq('reservation_code', reservationCode.trim())
                    .single()

                if (reservation && !searchError) {
                    setResponsibleName(reservation.responsible_name || 'Sin nombre')
                    setReservationFound(true)
                } else {
                    setResponsibleName('')
                    setReservationFound(false)
                }
            } catch (err) {
                setResponsibleName('')
                setReservationFound(false)
            } finally {
                setIsSearching(false)
            }
        }

        const timeoutId = setTimeout(searchReservation, 500)
        return () => clearTimeout(timeoutId)
    }, [reservationCode])

    // Calculate totals
    const calculateLineTotal = (line: PackageLine) => {
        const pkg = packages.find(p => p.package_type === line.packageType)
        return pkg ? pkg.price * line.numPeople : 0
    }

    const grandTotal = packageLines.reduce((sum, line) => sum + calculateLineTotal(line), 0)
    const totalPeople = packageLines.reduce((sum, line) => line.packageType ? sum + line.numPeople : sum, 0)

    const addLine = () => {
        setPackageLines([...packageLines, { id: Date.now().toString(), packageType: '', numPeople: 1 }])
    }

    const removeLine = (id: string) => {
        if (packageLines.length > 1) {
            setPackageLines(packageLines.filter(line => line.id !== id))
        }
    }

    const updateLine = (id: string, field: keyof PackageLine, value: string | number) => {
        setPackageLines(packageLines.map(line =>
            line.id === id ? { ...line, [field]: value } : line
        ))
    }

    const handleCreate = async () => {
        // Validate at least one package selected
        const validLines = packageLines.filter(line => line.packageType && line.numPeople > 0)
        if (validLines.length === 0) {
            setError('Selecciona al menos un paquete')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            // Insertar en la nueva base de datos de atracciones
            for (const line of validLines) {
                const pkg = packages.find(p => p.package_type === line.packageType)
                if (!pkg) continue

                const totalAmount = pkg.price * line.numPeople

                const { error: insertError } = await supabaseAttractions
                    .from('package_reservations')
                    .insert({
                        reservation_code: reservationCode.trim() || null,
                        responsible_name: responsibleName || null,
                        package_type: line.packageType,
                        num_people: line.numPeople,
                        total_amount: totalAmount,
                        amount_paid: 0,
                        payment_status: 'pendiente',
                        notes: notes || null
                    })

                if (insertError) {
                    console.error('Insert error:', insertError)
                    throw insertError
                }
            }

            onClose()
        } catch (err) {
            console.error(err)
            setError('Error al guardar en la base de datos')
        } finally {
            setIsLoading(false)
        }
    }

    const getPackageName = (packageType: string) => {
        const pkg = packages.find(p => p.package_type === packageType)
        return pkg?.name || ''
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 0
        }}>
            <div style={{
                background: 'white',
                borderRadius: '20px 20px 0 0',
                padding: '1.25rem',
                width: '100%',
                maxWidth: '500px',
                maxHeight: '85vh',
                overflowY: 'auto',
                boxSizing: 'border-box'
            }}>
                <div style={{
                    width: '40px',
                    height: '4px',
                    background: '#ddd',
                    borderRadius: '2px',
                    margin: '0 auto 1rem'
                }} />
                <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: '700', textAlign: 'center' }}>
                    Nueva Reservación
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Reservation Code */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', color: '#333' }}>
                            Código de Reservación (Opcional)
                        </label>
                        <input
                            type="text"
                            value={reservationCode}
                            onChange={(e) => setReservationCode(e.target.value.toUpperCase())}
                            placeholder="BETEL-2026-XXXXXX"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: reservationFound === true ? '2px solid #4caf50' : reservationFound === false ? '2px solid #f44336' : '1px solid #ddd',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                background: reservationFound === true ? '#e8f5e9' : 'white'
                            }}
                        />
                        {/* Show search status and name */}
                        {isSearching && (
                            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                                Buscando...
                            </div>
                        )}
                        {reservationFound === true && responsibleName && (
                            <div style={{
                                marginTop: '0.5rem',
                                padding: '0.6rem',
                                background: '#e8f5e9',
                                borderRadius: '8px',
                                border: '1px solid #4caf50'
                            }}>
                                <div style={{ fontSize: '0.75rem', color: '#2e7d32', fontWeight: '600' }}>Responsable:</div>
                                <div style={{ fontSize: '0.95rem', color: '#1b5e20', fontWeight: '700' }}>{responsibleName}</div>
                            </div>
                        )}
                        {reservationFound === false && reservationCode.length >= 5 && (
                            <div style={{ fontSize: '0.8rem', color: '#f44336', marginTop: '0.5rem' }}>
                                Código no encontrado
                            </div>
                        )}
                    </div>

                    {/* Package Lines Section - Mobile Optimized */}
                    <div style={{
                        background: '#f8f9fa',
                        padding: '0.75rem',
                        borderRadius: '12px',
                        border: '1px solid #e9ecef'
                    }}>
                        <div style={{
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            color: '#555',
                            marginBottom: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            Paquetes de Atracciones
                        </div>

                        {packageLines.map((line, index) => (
                            <div key={line.id} style={{
                                marginBottom: '0.75rem',
                                padding: '0.75rem',
                                background: 'white',
                                borderRadius: '10px',
                                border: '1px solid #ddd',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }}>
                                {/* Row 1: Package Selector + Delete */}
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <select
                                        value={line.packageType}
                                        onChange={(e) => updateLine(line.id, 'packageType', e.target.value)}
                                        style={{
                                            flex: 1,
                                            padding: '0.7rem',
                                            border: '1px solid #ddd',
                                            borderRadius: '8px',
                                            fontSize: '0.85rem',
                                            background: 'white',
                                            height: '42px'
                                        }}
                                    >
                                        <option value="">Selecciona paquete...</option>
                                        {packages.map((pkg) => (
                                            <option key={pkg.id} value={pkg.package_type}>
                                                {pkg.name} - ${pkg.price.toFixed(0)}
                                            </option>
                                        ))}
                                    </select>
                                    {packageLines.length > 1 && (
                                        <button
                                            onClick={() => removeLine(line.id)}
                                            style={{
                                                width: '42px',
                                                height: '42px',
                                                minWidth: '42px',
                                                borderRadius: '8px',
                                                border: '1px solid #e57373',
                                                background: '#ffebee',
                                                color: '#c62828',
                                                cursor: 'pointer',
                                                fontSize: '1.2rem',
                                                fontWeight: '300',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>

                                {/* Row 2: Quantity + Subtotal */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.5rem',
                                    marginTop: '0.5rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#666' }}>Personas:</span>
                                        <input
                                            type="number"
                                            min={1}
                                            value={line.numPeople}
                                            onChange={(e) => updateLine(line.id, 'numPeople', parseInt(e.target.value) || 1)}
                                            onFocus={(e) => e.target.select()}
                                            style={{
                                                width: '60px',
                                                padding: '0.5rem',
                                                border: '2px solid #3b82f6',
                                                borderRadius: '8px',
                                                fontSize: '1rem',
                                                fontWeight: '600',
                                                textAlign: 'center',
                                                background: '#f8faff'
                                            }}
                                        />
                                    </div>
                                    <div style={{
                                        fontWeight: '700',
                                        fontSize: '1rem',
                                        color: line.packageType ? '#2e7d32' : '#999'
                                    }}>
                                        ${calculateLineTotal(line).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Add Line Button */}
                        <button
                            onClick={addLine}
                            style={{
                                width: '100%',
                                padding: '0.7rem',
                                background: '#fff',
                                border: '2px dashed #3b82f6',
                                borderRadius: '10px',
                                color: '#3b82f6',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                            }}
                        >
                            + Agregar paquete
                        </button>
                    </div>

                    {/* Grand Total */}
                    {grandTotal > 0 && (
                        <div style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                            padding: '1rem',
                            borderRadius: '12px',
                            color: 'white'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Total a pagar</div>
                                    <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{totalPeople} persona{totalPeople !== 1 ? 's' : ''}</div>
                                </div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                                    ${grandTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', color: '#333' }}>
                            Notas Adicionales
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Observaciones..."
                            rows={2}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            background: '#fee',
                            border: '1px solid #fcc',
                            padding: '0.75rem',
                            borderRadius: '8px',
                            color: '#c00',
                            fontSize: '0.85rem'
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Buttons */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '0.75rem',
                        marginTop: '0.5rem'
                    }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '0.9rem 0.5rem',
                                background: '#f0f0f0',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: '600',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                color: '#333'
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={isLoading || grandTotal === 0}
                            style={{
                                padding: '0.9rem 0.5rem',
                                background: grandTotal > 0 ? '#3b82f6' : '#bbb',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: '600',
                                fontSize: '0.9rem',
                                cursor: grandTotal > 0 ? 'pointer' : 'not-allowed',
                                opacity: isLoading ? 0.6 : 1
                            }}
                        >
                            {isLoading ? 'Creando...' : 'Crear'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Modal Component for register payment
function PaymentModal({ packageReservation, onClose }: { packageReservation: PackageReservation, onClose: () => void }) {
    const [amount, setAmount] = useState('')
    const [method, setMethod] = useState('efectivo')
    const [reference, setReference] = useState('')
    const [note, setNote] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const pendingAmount = packageReservation.total_amount - packageReservation.amount_paid

    const handleRegisterPayment = async () => {
        const amountNum = parseFloat(amount)
        if (!amountNum || amountNum <= 0) {
            setError('Ingresa un monto válido')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            // Calcular nuevo monto pagado
            const newAmountPaid = packageReservation.amount_paid + amountNum

            // Determinar nuevo status
            let newStatus: 'pendiente' | 'parcial' | 'pagado' = 'pendiente'
            if (newAmountPaid >= packageReservation.total_amount) {
                newStatus = 'pagado'
            } else if (newAmountPaid > 0) {
                newStatus = 'parcial'
            }

            // Actualizar directamente en la BD de atracciones
            const { error: updateError } = await supabaseAttractions
                .from('package_reservations')
                .update({
                    amount_paid: newAmountPaid,
                    payment_status: newStatus,
                    notes: packageReservation.notes
                        ? `${packageReservation.notes}\n[Pago ${new Date().toLocaleDateString('es-MX')}: $${amountNum} - ${method}${reference ? ' - Ref: ' + reference : ''}${note ? ' - ' + note : ''}]`
                        : `[Pago ${new Date().toLocaleDateString('es-MX')}: $${amountNum} - ${method}${reference ? ' - Ref: ' + reference : ''}${note ? ' - ' + note : ''}]`
                })
                .eq('id', packageReservation.id)

            if (updateError) throw updateError

            onClose()
        } catch (err) {
            console.error(err)
            setError('Error al registrar el pago')
        } finally {
            setIsLoading(false)
        }
    }

    const getPackageColor = (packageType: string) => {
        const colors: Record<string, string> = {
            museos: '#e91e63',
            acuario_adultos: '#0277bd',
            acuario_ninos: '#4caf50'
        }
        return colors[packageType] || '#666'
    }

    return (
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
            zIndex: 1000,
            padding: '1rem'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '1.5rem',
                maxWidth: '500px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto'
            }}>
                <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '700' }}>Registrar Pago</h2>

                {/* Package Info */}
                <div style={{
                    background: '#f8f9fa',
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    borderLeft: `4px solid ${getPackageColor(packageReservation.package_type)}`
                }}>
                    <div style={{ fontWeight: '600', color: getPackageColor(packageReservation.package_type), marginBottom: '0.5rem' }}>
                        {packageReservation.package_type.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                        {packageReservation.num_people} persona{packageReservation.num_people !== 1 ? 's' : ''}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                        <div>
                            <div style={{ color: '#94a3b8' }}>Total</div>
                            <div style={{ fontWeight: '700' }}>${packageReservation.total_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div>
                            <div style={{ color: '#94a3b8' }}>Pagado</div>
                            <div style={{ fontWeight: '700', color: '#2e7d32' }}>${packageReservation.amount_paid.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div>
                            <div style={{ color: '#94a3b8' }}>Pendiente</div>
                            <div style={{ fontWeight: '700', color: '#c62828' }}>${pendingAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                        </div>
                    </div>
                </div>

                {/* Payment Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', color: '#333' }}>
                            Monto a Pagar *
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                fontSize: '0.9rem'
                            }}
                        />
                        <button
                            onClick={() => setAmount(pendingAmount.toString())}
                            style={{
                                marginTop: '0.5rem',
                                padding: '0.25rem 0.5rem',
                                background: '#e3f2fd',
                                border: '1px solid #2196f3',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                color: '#2196f3',
                                cursor: 'pointer'
                            }}
                        >
                            Liquidar (${pendingAmount.toFixed(2)})
                        </button>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', color: '#333' }}>
                            Método de Pago *
                        </label>
                        <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                fontSize: '0.9rem'
                            }}
                        >
                            <option value="efectivo">Efectivo</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="tarjeta">Tarjeta</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', color: '#333' }}>
                            Referencia (Opcional)
                        </label>
                        <input
                            type="text"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder="Número de transacción, folio, etc."
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', color: '#333' }}>
                            Nota (Opcional)
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Observaciones sobre este pago..."
                            rows={2}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            background: '#fee',
                            border: '1px solid #fcc',
                            padding: '0.75rem',
                            borderRadius: '8px',
                            color: '#c00',
                            fontSize: '0.85rem'
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button
                            onClick={onClose}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                background: '#f5f5f5',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleRegisterPayment}
                            disabled={isLoading}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                opacity: isLoading ? 0.6 : 1
                            }}
                        >
                            {isLoading ? 'Registrando...' : 'Registrar Pago'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Modal Component for editing package records
function EditPackageModal({
    consolidatedItem,
    packages,
    onClose,
    onDelete,
    onUpdateNumPeople
}: {
    consolidatedItem: ConsolidatedItem
    packages: AttractionPackage[]
    onClose: () => void
    onDelete: (id: string) => Promise<void>
    onUpdateNumPeople: (id: string, packageType: string, newNumPeople: number) => Promise<void>
}) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState<number>(1)

    const getPackageName = (packageType: string) => {
        const names: Record<string, string> = {
            museos: 'Museos',
            acuario_adultos: 'Acuario + Museos (Adultos)',
            acuario_ninos: 'Acuario + Museos (Niños)'
        }
        return names[packageType] || packageType
    }

    const getPackagePrice = (packageType: string) => {
        const pkg = packages.find(p => p.package_type === packageType)
        return pkg?.price || 0
    }

    const formatMoney = (amount: number) => {
        return amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    const handleSaveEdit = async (id: string, packageType: string) => {
        if (editValue > 0) {
            await onUpdateNumPeople(id, packageType, editValue)
            setEditingId(null)
        }
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '500px',
                maxHeight: '80vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.25rem',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>
                            ✏️ Editar Registros
                        </h3>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                            {getPackageName(consolidatedItem.packageType)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            color: '#94a3b8'
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
                    {consolidatedItem.originalItems.length > 1 && (
                        <div style={{
                            background: '#fffbeb',
                            border: '1px solid #fbbf24',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            marginBottom: '1rem',
                            fontSize: '0.85rem',
                            color: '#92400e'
                        }}>
                            ⚠️ Este paquete tiene <strong>{consolidatedItem.originalItems.length} registros</strong> separados.
                            Usa el botón "🔀" para consolidarlos en 1.
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {consolidatedItem.originalItems.map((item, index) => (
                            <div
                                key={item.id}
                                style={{
                                    background: '#f8fafc',
                                    borderRadius: '8px',
                                    padding: '0.75rem',
                                    border: '1px solid #e2e8f0'
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '0.5rem'
                                }}>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        color: '#94a3b8',
                                        fontWeight: '600'
                                    }}>
                                        Registro #{index + 1}
                                    </span>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        color: '#94a3b8',
                                        fontFamily: 'monospace'
                                    }}>
                                        ID: {item.id.slice(0, 8)}...
                                    </span>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        {editingId === item.id ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(parseInt(e.target.value) || 1)}
                                                    style={{
                                                        width: '60px',
                                                        padding: '0.4rem',
                                                        border: '1px solid #d1d5db',
                                                        borderRadius: '6px',
                                                        fontSize: '0.9rem'
                                                    }}
                                                />
                                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>personas</span>
                                                <button
                                                    onClick={() => handleSaveEdit(item.id, item.package_type)}
                                                    style={{
                                                        padding: '0.3rem 0.6rem',
                                                        background: '#10b981',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    style={{
                                                        padding: '0.3rem 0.6rem',
                                                        background: '#f1f5f9',
                                                        color: '#64748b',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#1e293b' }}>
                                                    {item.num_people} persona{item.num_people !== 1 ? 's' : ''}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                    ${formatMoney(item.total_amount)}
                                                    {item.amount_paid > 0 && (
                                                        <span style={{ color: '#22c55e', marginLeft: '0.5rem' }}>
                                                            (Pagado: ${formatMoney(item.amount_paid)})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {editingId !== item.id && (
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            <button
                                                onClick={() => {
                                                    setEditingId(item.id)
                                                    setEditValue(item.num_people)
                                                }}
                                                style={{
                                                    padding: '0.4rem 0.6rem',
                                                    background: '#f0f9ff',
                                                    color: '#0369a1',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer'
                                                }}
                                                title="Editar cantidad"
                                            >
                                                ✏️ Editar
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm('¿Eliminar este registro?')) {
                                                        onDelete(item.id)
                                                    }
                                                }}
                                                style={{
                                                    padding: '0.4rem 0.6rem',
                                                    background: '#fee2e2',
                                                    color: '#dc2626',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer'
                                                }}
                                                title="Eliminar registro"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Summary */}
                    <div style={{
                        marginTop: '1rem',
                        padding: '0.75rem',
                        background: '#f1f5f9',
                        borderRadius: '8px',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '0.5rem',
                        textAlign: 'center'
                    }}>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Total Personas</div>
                            <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#1e293b' }}>
                                {consolidatedItem.numPeople}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Monto Total</div>
                            <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#1e293b' }}>
                                ${formatMoney(consolidatedItem.totalAmount)}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Pagado</div>
                            <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#22c55e' }}>
                                ${formatMoney(consolidatedItem.amountPaid)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem 1.25rem',
                    borderTop: '1px solid #e5e7eb'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: '#f1f5f9',
                            color: '#64748b',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    )
}
