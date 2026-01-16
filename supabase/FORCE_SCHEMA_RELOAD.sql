-- ================================================================
-- DIAGNÓSTICO Y FORZAR RELOAD DEL SCHEMA CACHE
-- ================================================================

-- 1️⃣ Verificar que las funciones existen
SELECT 
  routine_name,
  routine_type,
  specific_name
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'get_active_packages',
    'get_package_reservations',
    'create_package_reservation',
    'register_package_payment'
  )
ORDER BY routine_name;

-- 2️⃣ Verificar permisos (grants)
SELECT 
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_active_packages',
    'get_package_reservations',
    'create_package_reservation',
    'register_package_payment'
  )
ORDER BY routine_name, grantee;

-- 3️⃣ Re-aplicar GRANTS por si acaso
GRANT EXECUTE ON FUNCTION public.get_active_packages() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_package_reservations() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_package_reservation(UUID, TEXT, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_package_payment(UUID, NUMERIC, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 4️⃣ FORZAR RELOAD del schema cache (MÚLTIPLES MÉTODOS)
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- 5️⃣ Probar directamente las funciones (deben funcionar)
SELECT 'PRUEBA DIRECTA: get_active_packages' as test;
SELECT * FROM get_active_packages();

SELECT 'PRUEBA DIRECTA: get_package_reservations' as test;  
SELECT * FROM get_package_reservations();

-- ================================================================
-- Si ves los resultados arriba, las funciones FUNCIONAN en SQL
-- El problema es que PostgREST no las detecta aún
-- ================================================================
