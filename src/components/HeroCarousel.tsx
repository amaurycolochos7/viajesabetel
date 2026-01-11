'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

const images = ['/betel-1.png', '/betel-2.jpg']

export default function HeroCarousel() {
    const [current, setCurrent] = useState(0)

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrent((prev) => (prev + 1) % images.length)
        }, 5000)
        return () => clearInterval(timer)
    }, [])

    return (
        <div className="hero-carousel">
            {images.map((src, index) => (
                <Image
                    key={src}
                    src={src}
                    alt={`Betel ${index + 1}`}
                    fill
                    style={{
                        opacity: index === current ? 1 : 0,
                        position: 'absolute',
                        transition: 'opacity 0.7s ease-in-out',
                    }}
                    priority={index === 0}
                />
            ))}
            <div className="carousel-dots">
                {images.map((_, index) => (
                    <button
                        key={index}
                        className={`carousel-dot ${index === current ? 'active' : ''}`}
                        onClick={() => setCurrent(index)}
                        aria-label={`Ir a imagen ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    )
}
