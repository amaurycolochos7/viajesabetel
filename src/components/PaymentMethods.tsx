import Link from 'next/link'

export default function PaymentMethods() {
    return (
        <section className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 className="section-title">Métodos de Pago</h2>

            <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '1rem' }}>
                    Transferencia Bancaria
                </h3>
                <div className="bank-info">
                    <div className="bank-row">
                        <span className="bank-label">CLABE:</span>
                        <span className="bank-value">722969010994673004</span>
                    </div>
                    <div className="bank-row">
                        <span className="bank-label">Banco:</span>
                        <span className="bank-value">Mercado Pago</span>
                    </div>
                    <div className="bank-row">
                        <span className="bank-label">Beneficiario:</span>
                        <span className="bank-value">Gady Hernández</span>
                    </div>
                </div>
            </div>

            <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
                <strong>Mercado Pago:</strong> Próximamente
            </div>

            {/* CTA Button - appears after payment info */}
            <Link href="/reservar" className="cta-button">
                Reservar lugar
            </Link>
        </section>
    )
}
