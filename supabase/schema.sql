-- ================================================
-- VIAJE A BETEL - ESQUEMA DE BASE DE DATOS
-- Ejecutar en Supabase SQL Editor
-- ================================================

-- 1. Crear ENUM para estatus
CREATE TYPE reservation_status AS ENUM (
  'pendiente', 'anticipo_pagado', 'pagado_completo', 'cancelado'
);

-- 2. Crear secuencia para códigos de reservación
CREATE SEQUENCE reservation_seq START 1;

-- 3. Tabla de reservaciones
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_code TEXT UNIQUE NOT NULL,
  responsible_name TEXT NOT NULL,
  responsible_phone TEXT NOT NULL,
  responsible_congregation TEXT,
  seats_total INTEGER NOT NULL CHECK (seats_total >= 1),
  seats_payable INTEGER NOT NULL CHECK (seats_payable >= 0),
  unit_price NUMERIC(10,2) DEFAULT 1700 CHECK (unit_price >= 0),
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  deposit_required NUMERIC(10,2) NOT NULL CHECK (deposit_required >= 0),
  amount_paid NUMERIC(10,2) DEFAULT 0 CHECK (amount_paid >= 0),
  status reservation_status DEFAULT 'pendiente',
  seat_order INTEGER,
  pay_by_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_seats CHECK (seats_payable <= seats_total)
);

-- 4. Tabla de pasajeros
CREATE TABLE reservation_passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  congregation TEXT,
  age INTEGER,
  is_free_under6 BOOLEAN DEFAULT FALSE,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de pagos
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  method TEXT DEFAULT 'transferencia',
  reference TEXT,
  note TEXT
);

-- 6. Tabla de usuarios admin
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Índices para rendimiento
CREATE INDEX idx_reservations_created ON reservations(created_at);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_payments_reservation ON payments(reservation_id);
CREATE INDEX idx_passengers_reservation ON reservation_passengers(reservation_id);

-- ================================================
-- RPC: CREAR RESERVACIÓN (Atómica)
-- ================================================

CREATE OR REPLACE FUNCTION create_reservation(
  p_responsible_name TEXT,
  p_responsible_phone TEXT,
  p_responsible_congregation TEXT,
  p_passengers JSONB
) RETURNS JSONB AS $$
DECLARE
  v_reservation_id UUID;
  v_code TEXT;
  v_seats_total INTEGER;
  v_seats_payable INTEGER;
  v_total NUMERIC(10,2);
  v_deposit NUMERIC(10,2);
  v_passenger JSONB;
  v_age INTEGER;
BEGIN
  -- Generar código único
  v_code := 'BETEL-2026-' || LPAD(nextval('reservation_seq')::TEXT, 6, '0');
  
  -- Contar lugares totales
  v_seats_total := jsonb_array_length(p_passengers);
  
  -- Contar lugares pagables (edad >= 6 o edad no especificada)
  v_seats_payable := 0;
  FOR v_passenger IN SELECT * FROM jsonb_array_elements(p_passengers)
  LOOP
    v_age := (v_passenger->>'age')::INTEGER;
    IF v_age IS NULL OR v_age >= 6 THEN
      v_seats_payable := v_seats_payable + 1;
    END IF;
  END LOOP;
  
  -- Calcular montos
  v_total := v_seats_payable * 1700;
  v_deposit := v_total * 0.5;
  
  -- Insertar reservación
  INSERT INTO reservations (
    reservation_code, responsible_name, responsible_phone,
    responsible_congregation, seats_total, seats_payable,
    total_amount, deposit_required
  ) VALUES (
    v_code, p_responsible_name, p_responsible_phone,
    p_responsible_congregation, v_seats_total, v_seats_payable,
    v_total, v_deposit
  ) RETURNING id INTO v_reservation_id;
  
  -- Insertar pasajeros
  FOR v_passenger IN SELECT * FROM jsonb_array_elements(p_passengers)
  LOOP
    v_age := (v_passenger->>'age')::INTEGER;
    INSERT INTO reservation_passengers (
      reservation_id, first_name, last_name, phone,
      congregation, age, is_free_under6, observations
    ) VALUES (
      v_reservation_id,
      v_passenger->>'first_name',
      v_passenger->>'last_name',
      v_passenger->>'phone',
      v_passenger->>'congregation',
      v_age,
      COALESCE(v_age, 99) < 6,
      v_passenger->>'observations'
    );
  END LOOP;
  
  -- Retornar datos de la reservación
  RETURN jsonb_build_object(
    'reservation_code', v_code,
    'reservation_id', v_reservation_id,
    'seats_total', v_seats_total,
    'seats_payable', v_seats_payable,
    'total_amount', v_total,
    'deposit_required', v_deposit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- POLÍTICAS RLS (Row Level Security)
-- ================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Público: Puede insertar reservaciones (sin seat_order)
CREATE POLICY "Publico inserta reservaciones" ON reservations
  FOR INSERT WITH CHECK (seat_order IS NULL);

-- Público: Puede insertar pasajeros
CREATE POLICY "Publico inserta pasajeros" ON reservation_passengers
  FOR INSERT WITH CHECK (true);

-- Admin: Acceso completo a reservaciones
CREATE POLICY "Admin reservaciones" ON reservations
  FOR ALL USING (auth.email() IN (SELECT email FROM admin_users));

-- Admin: Acceso completo a pasajeros
CREATE POLICY "Admin pasajeros" ON reservation_passengers
  FOR ALL USING (auth.email() IN (SELECT email FROM admin_users));

-- Admin: Acceso completo a pagos
CREATE POLICY "Admin pagos" ON payments
  FOR ALL USING (auth.email() IN (SELECT email FROM admin_users));

-- admin_users: Solo lectura para verificación de auth
CREATE POLICY "Admin users solo lectura" ON admin_users
  FOR SELECT USING (true);

-- ================================================
-- INSERTAR USUARIO ADMIN INICIAL
-- ================================================

INSERT INTO admin_users (email) VALUES ('ismerai.7618@gmail.com');

-- ================================================
-- FIN DEL SCRIPT
-- ================================================
