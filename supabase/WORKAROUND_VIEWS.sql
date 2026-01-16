-- ================================================================
-- WORKAROUND: Usar VIEWS en lugar de RPC functions
-- Esto bypasea el problema del schema cache de PostgREST
-- ================================================================

-- 1️⃣ Crear VIEW para paquetes activos
CREATE OR REPLACE VIEW active_packages_view AS
SELECT 
  id,
  package_type,
  name,
  description,
  price,
  active,
  created_at
FROM attraction_packages
WHERE active = true
ORDER BY price;

-- 2️⃣ Crear VIEW para reservaciones de paquetes
CREATE OR REPLACE VIEW package_reservations_view AS
SELECT 
  id,
  reservation_id,
  package_type,
  num_people,
  total_amount,
  amount_paid,
  payment_status,
  notes,
  created_at
FROM package_reservations
ORDER BY created_at DESC;

-- 3️⃣ Habilitar RLS en las views (para permitir acceso público de lectura)
ALTER VIEW active_packages_view OWNER TO postgres;
ALTER VIEW package_reservations_view OWNER TO postgres;

-- 4️⃣ Otorgar permisos de SELECT
GRANT SELECT ON active_packages_view TO anon, authenticated;
GRANT SELECT ON package_reservations_view TO anon, authenticated;

-- 5️⃣ Probar las views
SELECT 'TEST: active_packages_view' as test;
SELECT * FROM active_packages_view;

SELECT 'TEST: package_reservations_view' as test;
SELECT * FROM package_reservations_view;

-- ================================================================
-- NOTA: Después de ejecutar esto, actualizaremos el código TypeScript
-- para usar .from('active_packages_view') en lugar de .rpc()
-- ================================================================
