-- ================================================
-- SISTEMA DE PAQUETES DE ATRACCIONES - VERSIÓN INDEPENDIENTE
-- Ejecutar en Supabase SQL Editor
-- ================================================

-- 1. Tabla de catálogo de paquetes
CREATE TABLE IF NOT EXISTS attraction_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_type TEXT NOT NULL UNIQUE CHECK (package_type IN ('museos', 'acuario_adultos', 'acuario_ninos')),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de reservaciones de paquetes (sin FK, se validará en código)
CREATE TABLE IF NOT EXISTS package_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID, -- Sin FK para evitar dependencia
  package_type TEXT NOT NULL,
  num_people INTEGER NOT NULL CHECK (num_people > 0),
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  amount_paid NUMERIC(10,2) DEFAULT 0 CHECK (amount_paid >= 0),
  payment_status TEXT DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente', 'parcial', 'pagado')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de pagos de paquetes
CREATE TABLE IF NOT EXISTS package_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_reservation_id UUID REFERENCES package_reservations(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  method TEXT DEFAULT 'efectivo' CHECK (method IN ('efectivo', 'transferencia', 'tarjeta')),
  reference TEXT,
  note TEXT
);

-- 4. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_package_reservations_reservation ON package_reservations(reservation_id);
CREATE INDEX IF NOT EXISTS idx_package_reservations_type ON package_reservations(package_type);
CREATE INDEX IF NOT EXISTS idx_package_reservations_status ON package_reservations(payment_status);
CREATE INDEX IF NOT EXISTS idx_package_payments_reservation ON package_payments(package_reservation_id);

-- 5. Habilitar RLS
ALTER TABLE attraction_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_payments ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS - Solo admins tienen acceso completo
-- Primero eliminar políticas si existen
DROP POLICY IF EXISTS "Admin paquetes" ON attraction_packages;
DROP POLICY IF EXISTS "Admin reservaciones paquetes" ON package_reservations;
DROP POLICY IF EXISTS "Admin pagos paquetes" ON package_payments;

-- Crear políticas nuevas
DO $$
BEGIN
  -- Verificar si existe la tabla admin_users
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_users') THEN
    -- Crear políticas con admin_users
    EXECUTE 'CREATE POLICY "Admin paquetes" ON attraction_packages FOR ALL USING (auth.email() IN (SELECT email FROM admin_users))';
    EXECUTE 'CREATE POLICY "Admin reservaciones paquetes" ON package_reservations FOR ALL USING (auth.email() IN (SELECT email FROM admin_users))';
    EXECUTE 'CREATE POLICY "Admin pagos paquetes" ON package_payments FOR ALL USING (auth.email() IN (SELECT email FROM admin_users))';
  ELSE
    -- Políticas temporales - permitir todo (ADVERTENCIA: solo para desarrollo)
    EXECUTE 'CREATE POLICY "Admin paquetes" ON attraction_packages FOR ALL USING (true)';
    EXECUTE 'CREATE POLICY "Admin reservaciones paquetes" ON package_reservations FOR ALL USING (true)';
    EXECUTE 'CREATE POLICY "Admin pagos paquetes" ON package_payments FOR ALL USING (true)';
  END IF;
END $$;

-- 7. Insertar los 3 paquetes del catálogo (solo si no existen)
INSERT INTO attraction_packages (package_type, name, description, price) VALUES
  ('museos', 'PAQUETE MUSEOS', 'Museo de Cera + Museo Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 175.00),
  ('acuario_adultos', 'ACUARIO + MUSEOS ADULTOS', 'Acuario + Museo de Cera + Museo de Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 345.00),
  ('acuario_ninos', 'ACUARIO + MUSEOS NIÑOS', 'Acuario + Museo de Cera + Museo de Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 285.00)
ON CONFLICT (package_type) DO NOTHING;

-- 8. Función para crear reservación de paquete
CREATE OR REPLACE FUNCTION create_package_reservation(
  p_reservation_id UUID,
  p_package_type TEXT,
  p_num_people INTEGER,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_package_reservation_id UUID;
  v_price NUMERIC(10,2);
  v_total NUMERIC(10,2);
BEGIN
  -- Obtener precio del paquete
  SELECT price INTO v_price
  FROM attraction_packages
  WHERE package_type = p_package_type AND active = true;
  
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Paquete no encontrado o inactivo';
  END IF;
  
  -- Calcular total
  v_total := v_price * p_num_people;
  
  -- Insertar reservación de paquete
  INSERT INTO package_reservations (
    reservation_id, package_type, num_people, total_amount, notes
  ) VALUES (
    p_reservation_id, p_package_type, p_num_people, v_total, p_notes
  ) RETURNING id INTO v_package_reservation_id;
  
  -- Retornar datos
  RETURN jsonb_build_object(
    'package_reservation_id', v_package_reservation_id,
    'total_amount', v_total,
    'price_per_person', v_price
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Función para registrar pago de paquete
CREATE OR REPLACE FUNCTION register_package_payment(
  p_package_reservation_id UUID,
  p_amount NUMERIC(10,2),
  p_method TEXT,
  p_reference TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_payment_id UUID;
  v_new_amount_paid NUMERIC(10,2);
  v_total_amount NUMERIC(10,2);
  v_new_status TEXT;
BEGIN
  -- Insertar pago
  INSERT INTO package_payments (
    package_reservation_id, amount, method, reference, note
  ) VALUES (
    p_package_reservation_id, p_amount, p_method, p_reference, p_note
  ) RETURNING id INTO v_payment_id;
  
  -- Calcular nuevo monto pagado
  SELECT 
    COALESCE(SUM(amount), 0),
    pr.total_amount
  INTO v_new_amount_paid, v_total_amount
  FROM package_payments pp
  RIGHT JOIN package_reservations pr ON pp.package_reservation_id = pr.id
  WHERE pr.id = p_package_reservation_id
  GROUP BY pr.total_amount;
  
  -- Determinar nuevo estado
  IF v_new_amount_paid >= v_total_amount THEN
    v_new_status := 'pagado';
  ELSIF v_new_amount_paid > 0 THEN
    v_new_status := 'parcial';
  ELSE
    v_new_status := 'pendiente';
  END IF;
  
  -- Actualizar reservación de paquete
  UPDATE package_reservations
  SET 
    amount_paid = v_new_amount_paid,
    payment_status = v_new_status
  WHERE id = p_package_reservation_id;
  
  -- Retornar datos
  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'amount_paid', v_new_amount_paid,
    'total_amount', v_total_amount,
    'payment_status', v_new_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ¡Listo! El sistema de paquetes está configurado.
