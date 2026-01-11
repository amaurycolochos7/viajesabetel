const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function keepAlive() {
    console.log(`[${new Date().toISOString()}] Ejecutando ping de mantenimiento...`)

    // Hacemos una consulta ligera (contar reservaciones)
    const { count, error } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })

    if (error) {
        console.error('❌ Error en el ping:', error.message)
        process.exit(1)
    } else {
        console.log('✅ Ping exitoso. La base de datos está activa.')
        console.log(`   Reservaciones actuales: ${count}`)
    }
}

keepAlive()
