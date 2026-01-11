import Link from 'next/link'
import HeroCarousel from '@/components/HeroCarousel'
import Itinerary from '@/components/Itinerary'
import CostRules from '@/components/CostRules'
import PaymentMethods from '@/components/PaymentMethods'

export default function Home() {
  return (
    <main>
      {/* Header */}
      <header className="page-header">
        <h1>Viaje a Betel</h1>
        <p>5 de abril de 2026 (domingo)</p>
      </header>

      {/* Hero Carousel */}
      <HeroCarousel />

      {/* Content */}
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>
        <Itinerary />
        <CostRules />
        <PaymentMethods />
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
