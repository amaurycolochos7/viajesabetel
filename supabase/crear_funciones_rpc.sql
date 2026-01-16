-- =====================================================
-- SOLUCIÓN: Usar Funciones RPC en lugar de API REST
-- =====================================================
-- Como las tablas no están expuestas en la API REST,
-- vamos a crear funciones que SÍ funcionan

-- 1. Función para obtener todos los paquetes activos
CREATE OR REPLACE FUNCTION get_active_packages()
RETURNS TABLE (
  id UUID,
  package_type TEXT,
  name TEXT,
  description TEXT,
  price NUMERIC(10,2),
  active BOOLEAN,
  created_at TIMESTAMPTZ
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.id,
    ap.package_type,
    ap.name,
    ap.description,
    ap.price,
    ap.active,
    ap.created_at
  FROM attraction_packages ap
  WHERE ap.active = true
  ORDER BY ap.price;
END;
$$ LANGUAGE plpgsql;

-- 2. Función para obtener todas las reservaciones de paquetes
CREATE OR REPLACE FUNCTION get_package_reservations()
RETURNS TABLE (
  id UUID,
  reservation_id UUID,
  reservation_code TEXT,
  responsible_name TEXT,
  package_type TEXT,
  num_people INTEGER,
  total_amount NUMERIC(10,2),
  amount_paid NUMERIC(10,2),
  payment_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id,
    pr.reservation_id,
    r.reservation_code,
    r.responsible_name,
    pr.package_type,
    pr.num_people,
    pr.total_amount,
    pr.amount_paid,
    pr.payment_status,
    pr.notes,
    pr.created_at
  FROM package_reservations pr
  LEFT JOIN reservations r ON pr.reservation_id = r.id
  ORDER BY pr.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 3. Verificar que las funciones funcionan
SELECT * FROM get_active_packages();
-- Deberías ver los 3 paquetes

SELECT * FROM get_package_reservations();
-- Debería estar vacío por ahora
