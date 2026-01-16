-- ================================================
-- SCRIPT DE DIAGNÓSTICO
-- Ejecuta esto en Supabase SQL Editor
-- ================================================

-- 1. Verificar si las tablas existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('attraction_packages', 'package_reservations', 'package_payments')
ORDER BY table_name;

-- 2. Si NO aparece nada arriba, las tablas NO EXISTEN
-- En ese caso, verifica que estás en el proyecto correcto de Supabase

-- 3. Verificar la URL de tu proyecto actual
-- La URL debe coincidir con NEXT_PUBLIC_SUPABASE_URL en tu .env.local
SELECT current_database();

-- 4. Si las tablas SÍ existen, verificar cuántos paquetes hay
SELECT COUNT(*) as total_packages FROM attraction_packages;

-- 5. Ver los paquetes (si existen)
SELECT * FROM attraction_packages;
