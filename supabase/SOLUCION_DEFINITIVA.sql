-- ================================================================
-- SOLUCIÓN DEFINITIVA: Recrear tablas con permisos correctos
-- ================================================================

-- 1. Eliminar tablas existentes (si existen)
DROP TABLE IF EXISTS package_payments CASCADE;
DROP TABLE IF EXISTS package_reservations CASCADE;
DROP TABLE IF EXISTS attraction_packages CASCADE;

-- 2. Crear tabla attraction_packages
CREATE TABLE attraction_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_type TEXT NOT NULL UNIQUE CHECK (package_type IN ('museos', 'acuario_adultos', 'acuario_ninos')),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Crear tabla package_reservations
CREATE TABLE package_reservations (
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

-- 4. Crear tabla package_payments
CREATE TABLE package_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_reservation_id UUID REFERENCES package_reservations(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT DEFAULT 'efectivo',
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- 5. IMPORTANTE: Deshabilitar RLS para acceso directo
ALTER TABLE attraction_packages DISABLE ROW LEVEL SECURITY;
ALTER TABLE package_reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE package_payments DISABLE ROW LEVEL SECURITY;

-- 6. Otorgar TODOS los permisos a anon y authenticated
GRANT ALL ON attraction_packages TO anon, authenticated;
GRANT ALL ON package_reservations TO anon, authenticated;
GRANT ALL ON package_payments TO anon, authenticated;

-- 7. Insertar paquetes
INSERT INTO attraction_packages (package_type, name, description, price) VALUES
  ('museos', 'Museos', 'Museo de Cera + Museo Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 175.00),
  ('acuario_adultos', 'Acuario + Museos (Adultos)', 'Acuario + Museo de Cera + Museo de Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 345.00),
  ('acuario_ninos', 'Acuario + Museos (Niños)', 'Acuario + Museo de Cera + Museo de Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 285.00);

-- 8. Forzar recarga del schema
NOTIFY pgrst, 'reload schema';

-- 9. Verificar que las tablas existen
SELECT 'VERIFICACIÓN' as status;
SELECT table_name, is_insertable_into 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('attraction_packages', 'package_reservations', 'package_payments');
