export default function CostRules() {
    return (
        <section className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 className="section-title">Costo</h2>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div className="price-highlight">$1,800 MXN</div>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.95rem' }}>
                    por lugar
                </p>
            </div>

            {/* What's included - JW Style */}
            <div style={{
                background: '#f0f4f8',
                borderLeft: '4px solid #4a6da7',
                padding: '1rem 1.25rem',
                marginBottom: '1rem'
            }}>
                <p style={{
                    fontWeight: '700',
                    color: '#3d5a80',
                    marginBottom: '0.5rem',
                    fontSize: '0.85rem',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                }}>
                    Incluye
                </p>
                <p style={{ color: '#2c3e50', fontSize: '0.95rem', margin: 0, lineHeight: '1.5' }}>
                    Transporte redondo en autobús.
                </p>
            </div>

            {/* What's NOT included - JW Style */}
            <div style={{
                background: '#fafafa',
                borderLeft: '4px solid #6c757d',
                padding: '1rem 1.25rem',
                marginBottom: '1.25rem'
            }}>
                <p style={{
                    fontWeight: '700',
                    color: '#495057',
                    marginBottom: '0.5rem',
                    fontSize: '0.85rem',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                }}>
                    No incluye
                </p>
                <p style={{
                    color: '#495057',
                    fontSize: '0.95rem',
                    margin: 0,
                    lineHeight: '1.6'
                }}>
                    Entradas a centros turísticos, alimentos y bebidas.
                </p>
                <p style={{
                    color: '#6c757d',
                    fontSize: '0.85rem',
                    marginTop: '0.75rem',
                    marginBottom: 0,
                    fontStyle: 'italic',
                    borderTop: '1px solid #e9ecef',
                    paddingTop: '0.75rem'
                }}>
                    Estos gastos corren por cuenta de cada viajero.
                </p>
            </div>

            {/* Notes - Clean style */}
            <div style={{
                borderTop: '1px solid #e9ecef',
                paddingTop: '1rem',
                marginBottom: '0.5rem'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                    color: '#495057',
                    fontSize: '0.9rem'
                }}>
                    <span style={{ color: '#4a6da7', fontWeight: '700' }}>•</span>
                    <span>Anticipo mínimo: <strong>50% del total</strong></span>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    color: '#495057',
                    fontSize: '0.9rem'
                }}>
                    <span style={{ color: '#4a6da7', fontWeight: '700' }}>•</span>
                    <span>Asientos asignados por orden de pago</span>
                </div>
            </div>

            {/* CTA Button */}
            <a href="/reservar" className="cta-button" style={{ marginTop: '1.5rem', display: 'block', width: '100%', textAlign: 'center', boxSizing: 'border-box' }}>
                Reservar lugar
            </a>
        </section>
    )
}


