-- ================================================================
-- FIX INMEDIATO: Deshabilitar RLS temporalmente
-- ================================================================

-- Deshabilitar RLS en todas las tablas de paquetes
ALTER TABLE attraction_packages DISABLE ROW LEVEL SECURITY;
ALTER TABLE package_reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE package_payments DISABLE ROW LEVEL SECURITY;

-- Otorgar permisos completos
GRANT ALL ON attraction_packages TO anon, authenticated;
GRANT ALL ON package_reservations TO anon, authenticated;
GRANT ALL ON package_payments TO anon, authenticated;

-- Forzar reload
NOTIFY pgrst, 'reload schema';

-- Verificar
SELECT 'RLS DESHABILITADO' as status;
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('attraction_packages', 'package_reservations', 'package_payments');
