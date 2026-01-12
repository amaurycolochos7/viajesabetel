-- ================================================
-- UPDATE RESERVATION LOGIC AND PRICE
-- Run this in Supabase SQL Editor
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
  v_seats_total INTEGER := 0;
  v_seats_payable INTEGER := 0;
  v_total NUMERIC(10,2);
  v_deposit NUMERIC(10,2);
  v_passenger JSONB;
  v_age INTEGER;
  v_is_infant BOOLEAN;
BEGIN
  -- Generate unique code
  v_code := 'BETEL-2026-' || LPAD(nextval('reservation_seq')::TEXT, 6, '0');
  
  -- Calculate seats and payable based on explicit infant flag
  FOR v_passenger IN SELECT * FROM jsonb_array_elements(p_passengers)
  LOOP
    v_is_infant := COALESCE((v_passenger->>'is_infant')::BOOLEAN, FALSE);
    
    -- Infants do not occupy seat and do not pay
    -- Adults and Children (occupying seats) do pay
    IF NOT v_is_infant THEN
        v_seats_total := v_seats_total + 1;
        v_seats_payable := v_seats_payable + 1;
    END IF;
  END LOOP;
  
  -- Ensure at least 1 seat? (Frontend should handle this, but safe to allow 0 if logic changes)
  
  -- Calculate amounts with NEW PRICE $1,800.00
  v_total := v_seats_payable * 1800; 
  v_deposit := v_total * 0.5;
  
  -- Insert reservation
  INSERT INTO reservations (
    reservation_code, responsible_name, responsible_phone,
    responsible_congregation, seats_total, seats_payable,
    total_amount, deposit_required
  ) VALUES (
    v_code, p_responsible_name, p_responsible_phone,
    p_responsible_congregation, v_seats_total, v_seats_payable,
    v_total, v_deposit
  ) RETURNING id INTO v_reservation_id;
  
  -- Insert passengers
  INSERT INTO reservation_passengers (
    reservation_id, first_name, last_name, phone,
    congregation, age, is_free_under6, observations
  )
  SELECT
    v_reservation_id,
    p->>'first_name',
    p->>'last_name',
    p->>'phone',
    p->>'congregation',
    (p->>'age')::INTEGER,
    COALESCE((p->>'is_infant')::BOOLEAN, FALSE), -- Storing is_infant status in is_free_under6 column
    p->>'observations'
  FROM jsonb_array_elements(p_passengers) AS p;
  
  -- Return result
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
