-- ================================================
-- GRUPOS DE TOUR - EJECUTAR EN SUPABASE
-- ================================================

-- Tabla de grupos de tour
CREATE TABLE tour_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name TEXT NOT NULL,
  tour_datetime TIMESTAMPTZ,
  max_members INTEGER DEFAULT 12,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de asignación de pasajeros a grupos
CREATE TABLE tour_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES tour_groups(id) ON DELETE CASCADE,
  passenger_id UUID REFERENCES reservation_passengers(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(passenger_id)
);

-- Índices
CREATE INDEX idx_tour_group_members_group ON tour_group_members(group_id);
CREATE INDEX idx_tour_group_members_reservation ON tour_group_members(reservation_id);

-- RLS
ALTER TABLE tour_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_group_members ENABLE ROW LEVEL SECURITY;

-- Admin: Acceso completo a grupos
CREATE POLICY "Admin tour_groups" ON tour_groups
  FOR ALL USING (auth.email() IN (SELECT email FROM admin_users));

CREATE POLICY "Admin tour_group_members" ON tour_group_members
  FOR ALL USING (auth.email() IN (SELECT email FROM admin_users));

-- Público: Puede leer grupos (para consulta)
CREATE POLICY "Public read tour_groups" ON tour_groups
  FOR SELECT USING (true);

CREATE POLICY "Public read tour_group_members" ON tour_group_members
  FOR SELECT USING (true);
