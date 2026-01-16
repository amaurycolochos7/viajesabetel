-- ================================================
-- HACER ANTICIPO OPCIONAL
-- Ejecutar en Supabase SQL Editor
-- ================================================

-- 1. Actualizar función create_reservation para aceptar parámetro de anticipo opcional
CREATE OR REPLACE FUNCTION create_reservation(
  p_responsible_name TEXT,
  p_responsible_phone TEXT,
  p_responsible_congregation TEXT,
  p_passengers JSONB,
  p_requires_deposit BOOLEAN DEFAULT true
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
  
  -- Si requiere anticipo, calcular 50%, sino 0
  IF p_requires_deposit THEN
    v_deposit := v_total * 0.5;
  ELSE
    v_deposit := 0;
  END IF;
  
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
