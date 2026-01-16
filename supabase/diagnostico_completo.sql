-- ================================================
-- DIAGNÓSTICO COMPLETO - EJECUTA TODO ESTO
-- ================================================

-- 1. Verificar si las tablas existen
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%package%'
ORDER BY table_name;

-- 2. Verificar RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('attraction_packages', 'package_reservations', 'package_payments');

-- 3. Verificar políticas (si existen)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('attraction_packages', 'package_reservations', 'package_payments');

-- 4. Verificar datos
SELECT COUNT(*) as total FROM attraction_packages;
SELECT * FROM attraction_packages;

-- 5. Intentar un SELECT simple
SELECT id,name, price FROM attraction_packages WHERE active = true;
