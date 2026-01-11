export default function Itinerary() {
    const items = [
        { time: 'Por confirmar', desc: 'Salida desde punto de reunión' },
        { time: 'Por confirmar', desc: 'Llegada a Betel' },
        { time: 'Por confirmar', desc: 'Recorrido por las instalaciones' },
        { time: 'Por confirmar', desc: 'Comida' },
        { time: 'Por confirmar', desc: 'Regreso' },
    ]

    return (
        <section className="card" style={{ marginBottom: '1rem' }}>
            <h2 className="section-title">Itinerario</h2>
            <div>
                {items.map((item, index) => (
                    <div key={index} className="itinerary-item">
                        <span className="itinerary-time">{item.time}</span>
                        <span className="itinerary-desc">{item.desc}</span>
                    </div>
                ))}
            </div>
        </section>
    )
}
