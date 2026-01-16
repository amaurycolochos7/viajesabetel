-- ================================================================
-- CONFIGURACIÓN COMPLETA PARA BASE DE DATOS DE ATRACCIONES
-- Ejecutar en el nuevo proyecto de Supabase
-- ================================================================

-- ================== TABLA: attraction_packages ==================
-- Catálogo de paquetes disponibles
CREATE TABLE attraction_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_type TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Desactivar RLS (acceso público)
ALTER TABLE attraction_packages DISABLE ROW LEVEL SECURITY;

-- Permisos
GRANT ALL ON attraction_packages TO anon, authenticated;

-- Insertar paquetes predeterminados
INSERT INTO attraction_packages (package_type, name, description, price) VALUES
  ('museos', 'Museos', 'Museo de Cera + Museo Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 175.00),
  ('acuario_adultos', 'Acuario + Museos (Adultos)', 'Acuario + Museo de Cera + Museo de Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 345.00),
  ('acuario_ninos', 'Acuario + Museos (Niños)', 'Acuario + Museo de Cera + Museo de Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 285.00);


-- ================== TABLA: package_reservations ==================
-- Reservaciones de paquetes de atracciones
CREATE TABLE package_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_code TEXT,              -- Código de la reservación principal (de la otra BD)
  responsible_name TEXT,              -- Nombre del responsable
  package_type TEXT NOT NULL,         -- Tipo de paquete
  num_people INTEGER NOT NULL CHECK (num_people > 0),
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  amount_paid NUMERIC(10,2) DEFAULT 0 CHECK (amount_paid >= 0),
  payment_status TEXT DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente', 'parcial', 'pagado')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Desactivar RLS
ALTER TABLE package_reservations DISABLE ROW LEVEL SECURITY;

-- Permisos
GRANT ALL ON package_reservations TO anon, authenticated;


-- ================== TABLA: package_payments ==================
-- Historial de pagos
CREATE TABLE package_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_reservation_id UUID REFERENCES package_reservations(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT DEFAULT 'efectivo',
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Desactivar RLS
ALTER TABLE package_payments DISABLE ROW LEVEL SECURITY;

-- Permisos
GRANT ALL ON package_payments TO anon, authenticated;


-- ================== VERIFICACIÓN ==================
SELECT 'TABLAS CREADAS EXITOSAMENTE' as status;

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('attraction_packages', 'package_reservations', 'package_payments');

-- Verificar paquetes insertados
SELECT package_type, name, price FROM attraction_packages;
