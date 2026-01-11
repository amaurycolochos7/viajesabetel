-- ================================================
-- ACTUALIZACIÓN FINAL: Sistema de Abordaje y Código Corto
-- Ejecutar en Supabase SQL Editor
-- ================================================

-- 1. Agregar columna para el código de acceso corto (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'boarding_access_code') THEN
        ALTER TABLE reservations ADD COLUMN boarding_access_code TEXT;
    END IF;
END $$;

-- 2. Backfill para reservaciones existentes (opcional, por seguridad)
UPDATE reservations 
SET boarding_access_code = upper(substring(md5(random()::text) from 1 for 5))
WHERE boarding_access_code IS NULL;

-- 3. Actualizar función para generar AMBOS códigos (Largo y Corto)
CREATE OR REPLACE FUNCTION create_reservation(
  p_responsible_name TEXT,
  p_responsible_phone TEXT,
  p_responsible_congregation TEXT,
  p_passengers JSONB
) RETURNS JSONB AS $$
DECLARE
  v_reservation_id UUID;
  v_code TEXT;
  v_boarding_code TEXT;
  v_seats_total INTEGER;
  v_seats_payable INTEGER;
  v_total NUMERIC(10,2);
  v_deposit NUMERIC(10,2);
  v_passenger JSONB;
  v_age INTEGER;
BEGIN
  -- Generar código largo: BETEL-XXXX-YYYY
  v_code := 'BETEL-' || 
            upper(substring(md5(random()::text) from 1 for 4)) || '-' || 
            lpad(floor(random() * 10000)::text, 4, '0');
  
  -- Generar código CÓRTO para abordaje (5 caracteres hex)
  v_boarding_code := upper(substring(md5(random()::text) from 1 for 5));

  -- Verificar unicidad del código largo
  WHILE EXISTS (SELECT 1 FROM reservations WHERE reservation_code = v_code) LOOP
        v_code := 'BETEL-' || 
                upper(substring(md5(random()::text) from 1 for 4)) || '-' || 
                lpad(floor(random() * 10000)::text, 4, '0');
  END LOOP;
  
  -- Contar lugares totales
  v_seats_total := jsonb_array_length(p_passengers);
  
  -- Contar lugares pagables
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
    reservation_code, boarding_access_code, responsible_name, responsible_phone,
    responsible_congregation, seats_total, seats_payable,
    total_amount, deposit_required
  ) VALUES (
    v_code, v_boarding_code, p_responsible_name, p_responsible_phone,
    p_responsible_congregation, v_seats_total, v_seats_payable,
    v_total, v_deposit
  ) RETURNING id INTO v_reservation_id;
  
  -- Insertar pasajeros
  FOR v_passenger IN SELECT * FROM jsonb_array_elements(p_passengers)
  LOOP
    v_age := (v_passenger->>'age')::INTEGER;
    INSERT INTO reservation_passengers (
      reservation_id, first_name, last_name, phone,
      congregation, age, is_free_under6, observations, boarded
    ) VALUES (
      v_reservation_id,
      v_passenger->>'first_name',
      v_passenger->>'last_name',
      v_passenger->>'phone',
      v_passenger->>'congregation',
      v_age,
      COALESCE(v_age, 99) < 6,
      v_passenger->>'observations',
      FALSE
    );
  END LOOP;
  
  -- Retornar datos de la reservación
  RETURN jsonb_build_object(
    'reservation_code', v_code,
    'boarding_access_code', v_boarding_code,
    'reservation_id', v_reservation_id,
    'seats_total', v_seats_total,
    'seats_payable', v_seats_payable,
    'total_amount', v_total,
    'deposit_required', v_deposit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
