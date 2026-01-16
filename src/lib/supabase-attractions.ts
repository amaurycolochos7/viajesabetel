import { createClient } from '@supabase/supabase-js'

// Base de datos de ATRACCIONES (separada)
const attractionsUrl = process.env.NEXT_PUBLIC_SUPABASE_ATTRACTIONS_URL!
const attractionsAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ATTRACTIONS_ANON_KEY!

export const supabaseAttractions = createClient(attractionsUrl, attractionsAnonKey)
