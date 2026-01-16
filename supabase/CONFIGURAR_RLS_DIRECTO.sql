-- ================================================================
-- CONFIGURAR RLS PARA ACCESO DIRECTO A TABLAS
-- ================================================================

-- 1️⃣ Verificar si RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('attraction_packages', 'package_reservations');

-- 2️⃣ Habilitar RLS en las tablas (si no está habilitado)
ALTER TABLE attraction_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_reservations ENABLE ROW LEVEL SECURITY;

-- 3️⃣ ELIMINAR políticas existentes que puedan estar bloqueando
DROP POLICY IF EXISTS "Allow public read access to active packages" ON attraction_packages;
DROP POLICY IF EXISTS "Allow authenticated read access to package reservations" ON package_reservations;
DROP POLICY IF EXISTS "Allow admin full access to attraction_packages" ON attraction_packages;
DROP POLICY IF EXISTS "Allow admin full access to package_reservations" ON package_reservations;

-- 4️⃣ Crear políticas PERMISIVAS para lectura pública
CREATE POLICY "Public can read active packages"
ON attraction_packages
FOR SELECT
TO public
USING (active = true);

CREATE POLICY "Authenticated can read package reservations"
ON package_reservations
FOR SELECT
TO authenticated
USING (true);

-- 5️⃣ Crear políticas para INSERT/UPDATE (solo authenticated)
CREATE POLICY "Authenticated can insert package reservations"
ON package_reservations
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update package reservations"
ON package_reservations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 6️⃣ Verificar que las políticas se crearon
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('attraction_packages', 'package_reservations')
ORDER BY tablename, policyname;

-- 7️⃣ Probar acceso directo a las tablas
SELECT 'TEST: Direct access to attraction_packages' as test;
SELECT * FROM attraction_packages WHERE active = true;

SELECT 'TEST: Direct access to package_reservations' as test;
SELECT * FROM package_reservations;
