'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { supabaseAttractions } from '@/lib/supabase-attractions'
import { PackageReservation, AttractionPackage } from '@/types'

type FilterType = 'todos' | 'museos' | 'acuario_adultos' | 'acuario_ninos' | 'pendientes' | 'pagados'

export default function PaquetesAdminPage() {
    const router = useRouter()
    const [packages, setPackages] = useState<AttractionPackage[]>([])
    const [reservations, setReservations] = useState<PackageReservation[]>([])
    const [filteredReservations, setFilteredReservations] = useState<PackageReservation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<FilterType>('todos')
    const [showNewModal, setShowNewModal] = useState(false)
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [selectedReservation, setSelectedReservation] = useState<PackageReservation | null>(null)

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

                {/* Package Reservations List */}
                {filteredReservations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '12px' }}>
                        <p style={{ color: '#94a3b8', margin: 0 }}>No hay reservaciones de paquetes</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {filteredReservations.map((pr) => (
                            <div
                                key={pr.id}
                                style={{
                                    background: 'white',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                    borderLeft: `4px solid ${getPackageColor(pr.package_type)}`
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                                    <div>
                                        <div style={{ fontWeight: '700', color: getPackageColor(pr.package_type), fontSize: '0.95rem' }}>
                                            {getPackageName(pr.package_type)}
                                        </div>
                                        {(pr as any).responsible_name && (
                                            <div style={{ fontSize: '0.8rem', color: '#333', marginTop: '0.25rem', fontWeight: '500' }}>
                                                {(pr as any).responsible_name}
                                            </div>
                                        )}
                                        {(pr as any).reservation_code && (
                                            <div style={{ fontSize: '0.7rem', color: '#3b82f6', marginTop: '0.15rem', fontFamily: 'monospace' }}>
                                                {(pr as any).reservation_code}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                                            {pr.num_people} persona{pr.num_people !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        padding: '4px 8px',
                                        borderRadius: '10px',
                                        fontWeight: '600',
                                        background: pr.payment_status === 'pagado' ? '#dcfce7' : pr.payment_status === 'parcial' ? '#fef3c7' : '#f1f5f9',
                                        color: pr.payment_status === 'pagado' ? '#166534' : pr.payment_status === 'parcial' ? '#92400e' : '#475569'
                                    }}>
                                        {getStatusLabel(pr.payment_status)}
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                                    <div>
                                        <span style={{ color: '#94a3b8' }}>Personas:</span>{' '}
                                        <strong>{pr.num_people}</strong>
                                    </div>
                                    <div>
                                        <span style={{ color: '#94a3b8' }}>Total:</span>{' '}
                                        <strong>${formatMoney(pr.total_amount)}</strong>
                                    </div>
                                    <div>
                                        <span style={{ color: '#94a3b8' }}>Pagado:</span>{' '}
                                        <strong style={{ color: '#2e7d32' }}>${formatMoney(pr.amount_paid)}</strong>
                                    </div>
                                    <div>
                                        <span style={{ color: '#94a3b8' }}>Pendiente:</span>{' '}
                                        <strong style={{ color: '#c62828' }}>${formatMoney(pr.total_amount - pr.amount_paid)}</strong>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => {
                                            setSelectedReservation(pr)
                                            setShowPaymentModal(true)
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '0.5rem',
                                            background: '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: '600',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Registrar Pago
                                    </button>
                                    <button
                                        onClick={() => deleteReservation(pr.id)}
                                        style={{
                                            padding: '0.5rem 0.75rem',
                                            background: '#ffebee',
                                            color: '#c62828',
                                            border: '1px solid #ef9a9a',
                                            borderRadius: '8px',
                                            fontWeight: '600',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Eliminar
                                    </button>
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
            const { error: rpcError } = await supabase.rpc('register_package_payment', {
                p_package_reservation_id: packageReservation.id,
                p_amount: amountNum,
                p_method: method,
                p_reference: reference || null,
                p_note: note || null
            })

            if (rpcError) throw rpcError

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
