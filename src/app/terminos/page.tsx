'use client'

import Link from 'next/link'

export default function TerminosPage() {
    return (
        <div style={{ minHeight: '100vh', background: '#f5f6fa', padding: '2rem 1rem' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
                    <h1 style={{
                        fontSize: '2rem',
                        fontWeight: '800',
                        color: 'var(--primary)',
                        marginBottom: '1rem',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }}>
                        Términos y Condiciones
                    </h1>
                    <Link
                        href="/"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            background: 'white',
                            color: '#666',
                            textDecoration: 'none',
                            borderRadius: '20px',
                            fontSize: '0.9rem',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        Volver al inicio
                    </Link>
                </header>

                <div className="card" style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'grid', gap: '1.5rem', color: '#2c3e50', lineHeight: '1.6' }}>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            <div style={{ background: '#e3f2fd', padding: '0.5rem', borderRadius: '50%', color: '#1976d2', marginTop: '0.25rem' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '600' }}>Registro de Personas</h3>
                                <p style={{ margin: 0, color: '#455a64' }}>
                                    Solo podrán realizar el recorrido las personas incluidas en la reservación. Favor de no añadir personas de último momento. Los niños, incluidos los bebés, cuentan como visitantes. Si no han sido registrados previamente, es necesario actualizar la reservación.
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            <div style={{ background: '#e3f2fd', padding: '0.5rem', borderRadius: '50%', color: '#1976d2', marginTop: '0.25rem' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /><path d="M2 12h20" /></svg>
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '600' }}>Responsable de Grupo</h3>
                                <p style={{ margin: 0, color: '#455a64' }}>
                                    En cada grupo de 12 personas se asignará un responsable.
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            <div style={{ background: '#ffebee', padding: '0.5rem', borderRadius: '50%', color: '#c62828', marginTop: '0.25rem' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" /><path d="M8 15v6" /><path d="M16 15v6" /><path d="M12 15v6" /></svg>
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '600' }}>Medicamentos</h3>
                                <p style={{ margin: 0, color: '#455a64' }}>
                                    Si alguien toma medicamentos, no olvide llevarlos.
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            <div style={{ background: '#ffebee', padding: '0.5rem', borderRadius: '50%', color: '#c62828', marginTop: '0.25rem' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.6 6.7A53 53 0 0 1 12 2a53 53 0 0 1 3.4 4.7" /><path d="M6.8 12.3H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2.8" /><path d="M7.8 17.3 12 21.6l4.2-4.3" /><line x1="12" y1="21.6" x2="12" y2="12.3" /></svg>
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '600' }}>Salud</h3>
                                <p style={{ margin: 0, color: '#455a64' }}>
                                    No visite la oficina de traducción si tiene síntomas como mareo, debilidad, gripe, resfriado, dolor de garganta o estomacal, o si tuvo COVID recientemente o estuvo expuesto al virus.
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            <div style={{ background: '#e8f5e9', padding: '0.5rem', borderRadius: '50%', color: '#2e7d32', marginTop: '0.25rem' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '600' }}>Vestimenta y Calzado</h3>
                                <p style={{ margin: 0, color: '#455a64', marginBottom: '0.5rem' }}>
                                    Recomendamos calzado cómodo.
                                </p>
                                <p style={{ margin: 0, color: '#455a64' }}>
                                    Para esta visita, se espera que los hermanos lleven saco y corbata, y, las hermanas, falda o vestido. También se puede usar ropa típica, pero que sea formal.
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            <div style={{ background: '#fff3e0', padding: '0.5rem', borderRadius: '50%', color: '#ef6c00', marginTop: '0.25rem' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '600' }}>Modificaciones</h3>
                                <div style={{ color: '#455a64' }}>
                                    <p style={{ margin: 0 }}>
                                        Si necesita modificar o cancelar la reserva, favor de ponerse en contacto directamente con el administrador a través de WhatsApp:
                                        <a
                                            href="https://wa.me/529618720544"
                                            target="_blank"
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                color: '#25D366',
                                                textDecoration: 'none',
                                                fontWeight: '700',
                                                marginLeft: '6px'
                                            }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>
                                            961 872 0544
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}
