'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function ExtraActivities() {
    return (
        <section style={{ maxWidth: '600px', margin: '3rem auto 0', padding: '0 1.5rem 1.5rem' }}>
            <h2 style={{
                textAlign: 'center',
                fontSize: '1.75rem',
                color: 'var(--primary)',
                marginBottom: '2rem',
                fontFamily: 'var(--font-luckiest), cursive',
                letterSpacing: '1px',
                textShadow: '2px 2px 0px rgba(0,0,0,0.1)'
            }}>
                ¡Más Diversión!
            </h2>

            <div style={{ display: 'grid', gap: '2.5rem' }}>

                {/* AZTLÁN PARQUE URBANO */}
                <div className="activity-card" style={{
                    background: 'white',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)',
                    border: '1px solid #f0f0f0'
                }}>
                    <div style={{ position: 'relative', height: '220px', width: '100%' }}>
                        <Image
                            src="/aztlan.png"
                            alt="Aztlán Parque Urbano"
                            fill
                            quality={100}
                            sizes="(max-width: 768px) 100vw, 600px"
                            style={{ objectFit: 'cover' }}
                        />
                    </div>

                    <div style={{ padding: '1.5rem' }}>
                        <h3 style={{
                            margin: '0 0 1rem',
                            fontSize: '1.5rem',
                            fontWeight: '800',
                            color: '#e91e63', // Color festivo para Aztlán
                            fontFamily: 'var(--font-noto), sans-serif'
                        }}>
                            Aztlán Parque Urbano
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px dashed #eee', paddingBottom: '0.5rem' }}>
                                <div>
                                    <span style={{ color: '#455a64', fontWeight: '600', display: 'block' }}>Infantil / Rueda</span>
                                    <span style={{ fontSize: '0.75rem', color: '#78909c' }}>Hasta 1.29m de estatura</span>
                                </div>
                                <span style={{ color: '#e91e63', fontWeight: '700', fontSize: '1.25rem' }}>$350.00</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <div>
                                    <span style={{ color: '#455a64', fontWeight: '600', display: 'block' }}>Plus / Rueda</span>
                                    <span style={{ fontSize: '0.75rem', color: '#78909c' }}>Más de 1.29m</span>
                                </div>
                                <span style={{ color: '#e91e63', fontWeight: '700', fontSize: '1.25rem' }}>$600.00</span>
                            </div>
                        </div>

                        <div style={{ marginTop: '1rem', background: '#fce4ec', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', color: '#880e4f' }}>
                            <strong>Importante:</strong> Se verificará la estatura en taquilla. Si excede 1.29m deberá pagar la diferencia.
                        </div>

                        <Link href="/comprar-entradas?activity=aztlan" style={{
                            display: 'block',
                            marginTop: '1.25rem',
                            textAlign: 'center',
                            background: '#e91e63',
                            color: 'white',
                            padding: '0.75rem',
                            borderRadius: '12px',
                            fontWeight: '600',
                            textDecoration: 'none',
                            transition: 'background 0.2s',
                            boxShadow: '0 4px 6px rgba(233, 30, 99, 0.2)'
                        }}>
                            Comprar Entradas
                        </Link>
                    </div>
                </div>

                {/* ACUARIO VERACRUZ */}
                <div className="activity-card" style={{
                    background: 'white',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)',
                    border: '1px solid #f0f0f0'
                }}>
                    <div style={{ position: 'relative', height: '220px', width: '100%' }}>
                        <Image
                            src="/acuario.png"
                            alt="Acuario Veracruz Entrada"
                            fill
                            quality={100}
                            sizes="(max-width: 768px) 100vw, 600px"
                            style={{ objectFit: 'cover' }}
                        />
                    </div>

                    <div style={{ padding: '1.5rem' }}>
                        <h3 style={{
                            margin: '0 0 1rem',
                            fontSize: '1.5rem',
                            fontWeight: '800',
                            color: '#0277bd', // Azul marino
                            fontFamily: 'var(--font-noto), sans-serif'
                        }}>
                            Acuario Veracruz
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #eee', paddingBottom: '0.5rem' }}>
                                <span style={{ color: '#455a64', fontWeight: '600' }}>Adultos</span>
                                <span style={{ color: '#0277bd', fontWeight: '700', fontSize: '1.25rem' }}>$170.00</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#455a64', fontWeight: '600' }}>Niños (2+ años)</span>
                                <span style={{ color: '#0277bd', fontWeight: '700', fontSize: '1.25rem' }}>$110.00</span>
                            </div>
                        </div>

                        <Link href="/comprar-entradas?activity=acuario" style={{
                            display: 'block',
                            marginTop: '1.25rem',
                            textAlign: 'center',
                            background: '#0277bd',
                            color: 'white',
                            padding: '0.75rem',
                            borderRadius: '12px',
                            fontWeight: '600',
                            textDecoration: 'none',
                            transition: 'background 0.2s',
                            boxShadow: '0 4px 6px rgba(2, 119, 189, 0.2)'
                        }}>
                            Comprar Entradas
                        </Link>
                    </div>
                </div>



            </div>
        </section>
    )
}
