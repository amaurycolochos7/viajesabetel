-- ================================================================
-- DIAGNÓSTICO COMPLETO: Verificar estado real de las funciones
-- ================================================================

-- 1. Listar TODAS las funciones del schema public
SELECT 
  routine_name,
  routine_type,
  data_type,
  security_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 2. Buscar específicamente nuestras funciones
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname IN (
  'get_active_packages',
  'get_package_reservations',
  'create_package_reservation',
  'register_package_payment'
)
AND pronamespace = 'public'::regnamespace;

-- 3. Verificar permisos a nivel de sistema
SELECT 
  p.proname,
  p.proacl
FROM pg_proc p
WHERE p.proname IN (
  'get_active_packages',
  'get_package_reservations'
)
AND p.pronamespace = 'public'::regnamespace;

-- 4. Verificar si la tabla attraction_packages existe
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'attraction_packages'
) as attraction_packages_exists;

-- 5. Verificar si la tabla package_reservations existe  
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'package_reservations'
) as package_reservations_exists;

-- 6. Si las tablas existen, contar registros
SELECT 
  (SELECT COUNT(*) FROM attraction_packages) as total_packages,
  (SELECT COUNT(*) FROM package_reservations) as total_reservations;
