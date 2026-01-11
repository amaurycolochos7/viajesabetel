export default function CostRules() {
    return (
        <section className="card" style={{ marginBottom: '1rem' }}>
            <h2 className="section-title">Costo y Reglas</h2>

            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <div className="price-highlight">$1,700 MXN</div>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.95rem' }}>
                    por lugar
                </p>
            </div>

            <div>
                <div className="price-note">
                    <span className="icon">—</span>
                    <span>Niños menores de 6 años no pagan</span>
                </div>
                <div className="price-note">
                    <span className="icon">—</span>
                    <span>Anticipo mínimo: 50% del total</span>
                </div>
                <div className="price-note">
                    <span className="icon">—</span>
                    <span>Asientos asignados por orden de pago</span>
                </div>
            </div>
        </section>
    )
}
