import Link from 'next/link'
import HeroCarousel from '@/components/HeroCarousel'
import Itinerary from '@/components/Itinerary'
import CostRules from '@/components/CostRules'
import ReservationLookup from '@/components/ReservationLookup'
import ExtraActivities from '@/components/ExtraActivities'

export default function Home() {
  return (
    <main>
      {/* Hero Carousel first */}
      <HeroCarousel />

      {/* Title below carousel */}
      <header style={{
        background: 'var(--primary)',
        color: 'white',
        padding: '0.75rem 1rem', // Reduced padding
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: '400', margin: 0, fontFamily: 'var(--font-luckiest), cursive', letterSpacing: '1px', color: '#ffffff', textShadow: '2px 2px 0px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
          ¡Vamos a Betel!
        </h1>
        <p style={{ fontSize: '1rem', opacity: 0.95, marginTop: '0.25rem' }}>
          7-9 de Abril 2026
        </p>
      </header>

      {/* Content */}
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>
        <Itinerary />
        <CostRules />

        {/* New Section */}
        <ExtraActivities />

        <ReservationLookup />

        {/* Contact CTA */}
        <div style={{ marginTop: '3rem', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#1a1a1a' }}>¿Tienes dudas o quieres enviar tu pago?</h3>
          <a
            href="https://wa.me/5219618720544?text=Hola,%20tengo%20una%20duda%20sobre%20el%20viaje%20a%20Betel"
            target="_blank"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              background: '#25D366',
              color: 'white',
              padding: '1rem',
              borderRadius: '12px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '1rem',
              boxShadow: '0 4px 6px rgba(37, 211, 102, 0.2)',
              transition: 'transform 0.2s ease'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            Enviar Comprobante o Consultar
          </a>
        </div>
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
