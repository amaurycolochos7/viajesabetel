-- ================================================================
-- DIAGNÓSTICO: Por qué las tablas devuelven 404
-- ================================================================

-- 1️⃣ Verificar que las tablas existen en el schema correcto
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name IN ('attraction_packages', 'package_reservations')
ORDER BY table_name;

-- 2️⃣ Verificar el owner de las tablas
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE tablename IN ('attraction_packages', 'package_reservations');

-- 3️⃣ Verificar que las tablas tienen columnas
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('attraction_packages', 'package_reservations')
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 4️⃣ Verificar estado de RLS
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('attraction_packages', 'package_reservations');

-- 5️⃣ Listar políticas RLS actuales
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('attraction_packages', 'package_reservations')
ORDER BY tablename, policyname;

-- 6️⃣ Verificar grants a nivel de tabla
SELECT 
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('attraction_packages', 'package_reservations')
  AND table_schema = 'public'
ORDER BY table_name, grantee;
