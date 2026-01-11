import Link from 'next/link'
import HeroCarousel from '@/components/HeroCarousel'
import Itinerary from '@/components/Itinerary'
import CostRules from '@/components/CostRules'

export default function Home() {
  return (
    <main>
      {/* Hero Carousel first */}
      <HeroCarousel />

      {/* Title below carousel */}
      <header style={{
        background: 'var(--primary)',
        color: 'white',
        padding: '1.5rem',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '600', margin: 0 }}>
          Vamos a Betel
        </h1>
        <p style={{ fontSize: '1rem', opacity: 0.95, marginTop: '0.5rem' }}>
          7-9 de Abril 2026
        </p>
      </header>

      {/* Content */}
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>
        <Itinerary />
        <CostRules />
      </div>

      {/* Footer with hidden admin access */}
      <footer style={{
        textAlign: 'center',
        padding: '2rem 1rem',
        marginTop: '1rem',
        borderTop: '1px solid #e0e0e0',
        background: '#fafafa'
      }}>
        <Link
          href="/admin"
          style={{
            color: '#999',
            fontSize: '0.8rem',
            textDecoration: 'none'
          }}
        >
          © 2026
        </Link>
      </footer>
    </main>
  )
}
