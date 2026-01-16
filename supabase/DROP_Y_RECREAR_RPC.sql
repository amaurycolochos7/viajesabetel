-- ================================================================
-- PASO 1: ELIMINAR funciones existentes
-- ================================================================
DROP FUNCTION IF EXISTS public.get_active_packages() CASCADE;
DROP FUNCTION IF EXISTS public.get_package_reservations() CASCADE;
DROP FUNCTION IF EXISTS public.create_package_reservation(UUID, TEXT, INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.register_package_payment(UUID, NUMERIC, TEXT, TEXT, TEXT) CASCADE;

-- ================================================================
-- PASO 2: RECREAR funciones con firma correcta
-- ================================================================

-- 1️⃣ FUNCIÓN: get_active_packages
CREATE FUNCTION public.get_active_packages()
RETURNS TABLE (
  id UUID,
  package_type TEXT,
  name TEXT,
  description TEXT,
  price NUMERIC(10,2),
  active BOOLEAN,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
$$;

-- 2️⃣ FUNCIÓN: get_package_reservations (CON reservation_code y responsible_name)
CREATE FUNCTION public.get_package_reservations()
RETURNS TABLE (
  id UUID,
  reservation_id UUID,
  package_type TEXT,
  num_people INTEGER,
  total_amount NUMERIC(10,2),
  amount_paid NUMERIC(10,2),
  payment_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  reservation_code TEXT,
  responsible_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    pr.created_at,
    r.reservation_code,
    r.responsible_name
  FROM package_reservations pr
  LEFT JOIN reservations r ON pr.reservation_id = r.id
  ORDER BY pr.created_at DESC;
END;
$$;

-- 3️⃣ FUNCIÓN: create_package_reservation
CREATE FUNCTION public.create_package_reservation(
  p_reservation_id UUID,
  p_package_type TEXT,
  p_num_people INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_package_id UUID;
  v_price NUMERIC(10,2);
  v_total NUMERIC(10,2);
  v_new_id UUID;
BEGIN
  -- Obtener precio del paquete
  SELECT id, price INTO v_package_id, v_price
  FROM attraction_packages
  WHERE package_type = p_package_type AND active = true
  LIMIT 1;

  IF v_package_id IS NULL THEN
    RAISE EXCEPTION 'Paquete no encontrado o inactivo';
  END IF;

  v_total := v_price * p_num_people;

  -- Crear reservación de paquete
  INSERT INTO package_reservations (
    reservation_id,
    package_type,
    num_people,
    total_amount,
    amount_paid,
    payment_status,
    notes
  ) VALUES (
    p_reservation_id,
    p_package_type,
    p_num_people,
    v_total,
    0,
    'pendiente',
    p_notes
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- 4️⃣ FUNCIÓN: register_package_payment
CREATE FUNCTION public.register_package_payment(
  p_package_reservation_id UUID,
  p_amount NUMERIC(10,2),
  p_method TEXT,
  p_reference TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_paid NUMERIC(10,2);
  v_total_amount NUMERIC(10,2);
  v_new_paid NUMERIC(10,2);
  v_new_status TEXT;
BEGIN
  -- Obtener información actual
  SELECT amount_paid, total_amount 
  INTO v_current_paid, v_total_amount
  FROM package_reservations
  WHERE id = p_package_reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservación de paquete no encontrada';
  END IF;

  -- Calcular nuevo total pagado
  v_new_paid := v_current_paid + p_amount;

  -- Determinar nuevo estado
  IF v_new_paid >= v_total_amount THEN
    v_new_status := 'pagado';
  ELSIF v_new_paid > 0 THEN
    v_new_status := 'parcial';
  ELSE
    v_new_status := 'pendiente';
  END IF;

  -- Actualizar reservación de paquete
  UPDATE package_reservations
  SET 
    amount_paid = v_new_paid,
    payment_status = v_new_status
  WHERE id = p_package_reservation_id;
END;
$$;

-- ================================================================
-- PASO 3: OTORGAR PERMISOS
-- ================================================================
GRANT EXECUTE ON FUNCTION public.get_active_packages() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_package_reservations() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_package_reservation(UUID, TEXT, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_package_payment(UUID, NUMERIC, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ================================================================
-- PASO 4: RECARGAR SCHEMA
-- ================================================================
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- PASO 5: VERIFICAR
-- ================================================================
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'get_active_packages',
    'get_package_reservations',
    'create_package_reservation',
    'register_package_payment'
  )
ORDER BY routine_name;

-- ================================================================
-- PASO 6: PROBAR
-- ================================================================
SELECT 'TEST: get_active_packages' as test;
SELECT * FROM get_active_packages();

SELECT 'TEST: get_package_reservations' as test;
SELECT * FROM get_package_reservations();
