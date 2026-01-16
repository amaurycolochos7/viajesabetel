-- ================================================================
-- CREAR TABLAS Y PAQUETES DE ATRACCIONES
-- ================================================================

-- 1️⃣ Crear tabla de paquetes
CREATE TABLE IF NOT EXISTS attraction_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_type TEXT NOT NULL UNIQUE CHECK (package_type IN ('museos', 'acuario_adultos', 'acuario_ninos')),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2️⃣ Crear tabla de reservaciones de paquetes
CREATE TABLE IF NOT EXISTS package_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID,
  package_type TEXT NOT NULL,
  num_people INTEGER NOT NULL CHECK (num_people > 0),
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  amount_paid NUMERIC(10,2) DEFAULT 0 CHECK (amount_paid >= 0),
  payment_status TEXT DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente', 'parcial', 'pagado')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3️⃣ Crear tabla de pagos de paquetes
CREATE TABLE IF NOT EXISTS package_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_reservation_id UUID REFERENCES package_reservations(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  method TEXT DEFAULT 'efectivo' CHECK (method IN ('efectivo', 'transferencia', 'tarjeta')),
  reference TEXT,
  note TEXT
);

-- 4️⃣ Habilitar RLS
ALTER TABLE attraction_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_payments ENABLE ROW LEVEL SECURITY;

-- 5️⃣ Eliminar políticas existentes
DROP POLICY IF EXISTS "Public can read active packages" ON attraction_packages;
DROP POLICY IF EXISTS "Authenticated can read package reservations" ON package_reservations;
DROP POLICY IF EXISTS "Authenticated can insert package reservations" ON package_reservations;
DROP POLICY IF EXISTS "Authenticated can update package reservations" ON package_reservations;

-- 6️⃣ Crear políticas RLS permisivas
CREATE POLICY "Public can read active packages"
ON attraction_packages
FOR SELECT
TO public
USING (active = true);

CREATE POLICY "Authenticated can read package reservations"
ON package_reservations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert package reservations"
ON package_reservations
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update package reservations"
ON package_reservations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 7️⃣ Insertar los 3 paquetes del catálogo
INSERT INTO attraction_packages (package_type, name, description, price) VALUES
  ('museos', 'Museos', 'Museo de Cera + Museo Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 60.00),
  ('acuario_adultos', 'Acuario + Museos (Adultos)', 'Acuario + Museo de Cera + Museo de Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 230.00),
  ('acuario_ninos', 'Acuario + Museos (Niños)', 'Acuario + Museo de Cera + Museo de Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 180.00)
ON CONFLICT (package_type) DO NOTHING;

-- 8️⃣ Verificar que todo se creó correctamente
SELECT 'Tablas creadas correctamente' as status;

SELECT 'Paquetes en el catálogo:' as info;
SELECT package_type, name, price, active FROM attraction_packages ORDER BY price;

SELECT 'Políticas RLS:' as info;
SELECT tablename, policyname FROM pg_policies 
WHERE tablename IN ('attraction_packages', 'package_reservations')
ORDER BY tablename, policyname;
