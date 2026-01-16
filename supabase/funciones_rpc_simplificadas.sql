-- =====================================================
-- FUNCIONES RPC SIMPLIFICADAS (SIN DEPENDENCIAS)
-- =====================================================

-- 1. Función para obtener paquetes activos (esta debería funcionar)
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

-- 2. Función SIMPLIFICADA para reservaciones (SIN JOIN)
CREATE OR REPLACE FUNCTION get_package_reservations()
RETURNS TABLE (
  id UUID,
  reservation_id UUID,
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
    pr.package_type,
    pr.num_people,
    pr.total_amount,
    pr.amount_paid,
    pr.payment_status,
    pr.notes,
    pr.created_at
  FROM package_reservations pr
  ORDER BY pr.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 3. PROBAR que funcionen
SELECT 'Probando get_active_packages...' as test;
SELECT * FROM get_active_packages();

SELECT 'Probando get_package_reservations...' as test;
SELECT * FROM get_package_reservations();

-- Si ves los 3 paquetes arriba, ¡FUNCIONA!
