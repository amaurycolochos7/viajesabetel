-- ===================================================================
-- SCRIPT FINAL - SI ESTO NO FUNCIONA, HAY UN PROBLEMA EN SUPABASE
-- ===================================================================

-- PASO 1: Eliminar TODAS las políticas y deshabilitar RLS
DO $$
DECLARE
    pol record;
BEGIN
    -- Eliminar todas las políticas de las tablas de paquetes
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE tablename IN ('attraction_packages', 'package_reservations', 'package_payments')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Deshabilitar RLS completamente
ALTER TABLE IF EXISTS attraction_packages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS package_reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTE package_payments DISABLE ROW LEVEL SECURITY;

-- PASO 2: Verificar que RLS está deshabilitado
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('attraction_packages', 'package_reservations', 'package_payments')
AND schemaname = 'public';

-- Resultado esperado: rls_enabled = false para las 3 tablas

-- PASO 3: Verificar datos
SELECT 'Total paquetes:' as info, COUNT(*) as cantidad FROM attraction_packages
UNION ALL
SELECT 'Paquetes activos:', COUNT(*) FROM attraction_packages WHERE active = true;

-- Resultado esperado: 3 paquetes totales, 3 activos

-- PASO 4: Ver los paquetes exactamente como los vería Supabase API
SELECT 
    id,
    package_type,
    name,
    price,
    active
FROM attraction_packages 
WHERE active = true
ORDER BY price;

-- ===================================================================
-- SI VES LOS 3 PAQUETES AQUÍ PERO NO EN LA APLICACIÓN,
-- entonces el problema es que Supabase no está exponiendo
-- las tablas en su API REST. 
--
-- SOLUCIÓN: Ve a Supabase Dashboard > Settings > API
-- y asegúrate de que las tablas estén habilitadas.
-- ===================================================================
