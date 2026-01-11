'use client'

import { useState } from 'react'

interface DaySchedule {
    day: string
    date: string
    items: { time: string; desc: string }[]
}

export default function Itinerary() {
    const [expandedDay, setExpandedDay] = useState<number | null>(0)

    const schedule: DaySchedule[] = [
        {
            day: 'Día 1',
            date: 'Lunes 7 de Abril',
            items: [
                { time: '1:00 PM', desc: 'Salida desde Venustiano Carranza' },
            ]
        },
        {
            day: 'Día 2',
            date: 'Martes 8 de Abril',
            items: [
                { time: '7:00 AM', desc: 'Llegada a México' },
                { time: '7:00 - 8:00 AM', desc: 'Desayuno (de preferencia Llevar lonche)' },
                { time: '8:00 - 8:45 AM', desc: 'Arreglarse para entrar a Betel' },
                { time: '8:45 AM', desc: 'Inicia el primer recorrido a Betel' },
                { time: '1:00 PM', desc: 'Concluyen recorridos, Y cambios de ropa' },
                { time: '1:00 - 7:00 PM', desc: 'Viaje a Aztlán y Comida' },
                { time: '7:00 - 10:00 PM', desc: 'Cena' },
                { time: '10:00 PM', desc: 'Salida rumbo a Veracruz' },
            ]
        },
        {
            day: 'Día 3',
            date: 'Miércoles 9 de Abril',
            items: [
                { time: 'Mañana', desc: 'Llegada a Veracruz' },
                { time: 'Mañana', desc: 'Cambio de ropa y desayuno' },
                { time: 'Día', desc: 'Entrada al Acuario de Veracruz' },
                { time: 'Tarde', desc: 'Comida' },
                { time: 'Tarde - Noche', desc: 'Paseo libre en Veracruz' },
                { time: 'Noche', desc: 'Salida a Venustiano Carranza' },
            ]
        },
        {
            day: 'Día 4',
            date: 'Jueves 10 de Abril',
            items: [
                { time: 'Mañana', desc: 'Llegada a Venustiano Carranza' },
            ]
        },
    ]

    return (
        <section className="card" style={{ marginBottom: '1rem' }}>
            <h2 className="section-title">Itinerario del Viaje</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {schedule.map((day, dayIndex) => (
                    <div
                        key={dayIndex}
                        style={{
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            background: expandedDay === dayIndex ? '#f8faff' : 'white',
                        }}
                    >
                        <button
                            onClick={() => setExpandedDay(expandedDay === dayIndex ? null : dayIndex)}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                textAlign: 'left',
                            }}
                        >
                            <div>
                                <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>{day.day}</strong>
                                <span style={{ color: '#666', marginLeft: '0.75rem', fontSize: '0.9rem' }}>{day.date}</span>
                            </div>
                            <span style={{
                                transform: expandedDay === dayIndex ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s',
                                fontSize: '0.8rem',
                                color: '#999'
                            }}>
                                ▼
                            </span>
                        </button>

                        {expandedDay === dayIndex && (
                            <div style={{ padding: '0 1rem 1rem 1rem' }}>
                                {day.items.map((item, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            display: 'flex',
                                            gap: '1rem',
                                            padding: '0.5rem 0',
                                            borderBottom: idx < day.items.length - 1 ? '1px dashed #eee' : 'none',
                                        }}
                                    >
                                        <span style={{
                                            minWidth: '100px',
                                            fontWeight: '600',
                                            color: 'var(--primary)',
                                            fontSize: '0.85rem',
                                        }}>
                                            {item.time}
                                        </span>
                                        <span style={{ color: '#333', fontSize: '0.9rem' }}>{item.desc}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    )
}
