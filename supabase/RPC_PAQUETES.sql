-- ================================================================
-- CREAR FUNCIÓN RPC PARA INSERTAR RESERVACIONES DE PAQUETES
-- Esta función bypasea el problema del schema cache de PostgREST
-- ================================================================

-- 1. Primero, asegurar que la tabla existe
CREATE TABLE IF NOT EXISTS package_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID,
  reservation_code TEXT,
  responsible_name TEXT,
  package_type TEXT NOT NULL,
  num_people INTEGER NOT NULL CHECK (num_people > 0),
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  amount_paid NUMERIC(10,2) DEFAULT 0 CHECK (amount_paid >= 0),
  payment_status TEXT DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente', 'parcial', 'pagado')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Desactivar RLS
ALTER TABLE package_reservations DISABLE ROW LEVEL SECURITY;

-- 3. Dar permisos
GRANT ALL ON package_reservations TO anon, authenticated;

-- 4. Crear función RPC para insertar
CREATE OR REPLACE FUNCTION insert_package_reservation(
  p_reservation_code TEXT DEFAULT NULL,
  p_responsible_name TEXT DEFAULT NULL,
  p_package_type TEXT DEFAULT NULL,
  p_num_people INTEGER DEFAULT 1,
  p_total_amount NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO package_reservations (
    reservation_code,
    responsible_name,
    package_type,
    num_people,
    total_amount,
    amount_paid,
    payment_status,
    notes
  ) VALUES (
    p_reservation_code,
    p_responsible_name,
    p_package_type,
    p_num_people,
    p_total_amount,
    0,
    'pendiente',
    p_notes
  )
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- 5. Crear función RPC para obtener reservaciones
CREATE OR REPLACE FUNCTION get_package_reservations_list()
RETURNS SETOF package_reservations
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM package_reservations ORDER BY created_at DESC;
$$;

-- 6. Crear función RPC para eliminar reservación
CREATE OR REPLACE FUNCTION delete_package_reservation(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM package_reservations WHERE id = p_id;
  RETURN FOUND;
END;
$$;

-- 7. Dar permisos a las funciones
GRANT EXECUTE ON FUNCTION insert_package_reservation TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_package_reservations_list TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_package_reservation TO anon, authenticated;

-- 8. Notificar a PostgREST para que recargue
NOTIFY pgrst, 'reload schema';

-- 9. Verificar
SELECT 'FUNCIONES CREADAS' as status;
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%package%';
