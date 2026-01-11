-- ================================================
-- CORRECCIÓN DE ERRORES: Columnas Faltantes
-- Ejecutar en Supabase SQL Editor
-- ================================================

-- 1. Agregar columna 'boarded' en 'reservation_passengers' (Causa del error actual)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservation_passengers' AND column_name = 'boarded') THEN
        ALTER TABLE reservation_passengers ADD COLUMN boarded BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Asegurar que existe 'boarding_access_code' en 'reservations'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'boarding_access_code') THEN
        ALTER TABLE reservations ADD COLUMN boarding_access_code TEXT;
    END IF;
END $$;
