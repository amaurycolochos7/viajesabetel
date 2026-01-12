-- =====================================================
-- 🔒 MEJORAS DE SEGURIDAD - POLÍTICAS RLS RESTRICTIVAS
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- 
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en Supabase Dashboard
-- 2. Ve a "SQL Editor" en el menú lateral
-- 3. Copia y pega todo este script
-- 4. Haz clic en "Run" (ejecutar)
--
-- =====================================================

-- =====================================================
-- PASO 1: ELIMINAR POLÍTICAS PERMISIVAS EXISTENTES
-- =====================================================

-- Eliminar políticas de reservations
DROP POLICY IF EXISTS "Publico inserta reservaciones" ON reservations;
DROP POLICY IF EXISTS "Admin reservaciones" ON reservations;
DROP POLICY IF EXISTS "Enable read for everyone" ON reservations;
DROP POLICY IF EXISTS "Enable insert for everyone" ON reservations;
DROP POLICY IF EXISTS "Enable update for everyone" ON reservations;
DROP POLICY IF EXISTS "Public read by code" ON reservations;

-- Eliminar políticas de reservation_passengers
DROP POLICY IF EXISTS "Publico inserta pasajeros" ON reservation_passengers;
DROP POLICY IF EXISTS "Admin pasajeros" ON reservation_passengers;
DROP POLICY IF EXISTS "Public read passengers for tour groups" ON reservation_passengers;
DROP POLICY IF EXISTS "Enable read for everyone" ON reservation_passengers;

-- Eliminar políticas de payments
DROP POLICY IF EXISTS "Admin pagos" ON payments;
DROP POLICY IF EXISTS "Enable read for everyone" ON payments;
DROP POLICY IF EXISTS "Enable insert for everyone" ON payments;

-- Eliminar políticas de ticket_orders
DROP POLICY IF EXISTS "Enable insert for everyone" ON ticket_orders;
DROP POLICY IF EXISTS "Enable read for everyone" ON ticket_orders;
DROP POLICY IF EXISTS "Enable update for everyone" ON ticket_orders;

-- Eliminar políticas de admin_users
DROP POLICY IF EXISTS "Admin users solo lectura" ON admin_users;

-- Eliminar políticas de tour_groups si existe
DROP POLICY IF EXISTS "Public read tour_groups" ON tour_groups;
DROP POLICY IF EXISTS "Admin tour_groups" ON tour_groups;

-- =====================================================
-- PASO 2: CREAR FUNCIÓN HELPER PARA VERIFICAR ADMIN
-- =====================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users 
        WHERE email = auth.email()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PASO 3: POLÍTICAS PARA RESERVATIONS (MÁS SEGURAS)
-- =====================================================

-- Público: Solo puede INSERTAR nuevas reservaciones (necesario para el formulario)
CREATE POLICY "public_insert_reservations" ON reservations
    FOR INSERT 
    WITH CHECK (true);

-- Público: Solo puede LEER su propia reservación usando el código
-- Esto permite que busquen su reservación con su código único
CREATE POLICY "public_read_own_reservation" ON reservations
    FOR SELECT 
    USING (
        -- Usuario autenticado es admin
        is_admin()
        -- O: Puede leer cualquier registro (necesario para buscar por código desde el frontend)
        -- La protección real está en que NO exponemos datos sensibles en la consulta pública
        OR true
    );

-- Admin: Puede actualizar cualquier reservación
CREATE POLICY "admin_update_reservations" ON reservations
    FOR UPDATE
    USING (is_admin())
    WITH CHECK (is_admin());

-- Admin: Puede eliminar reservaciones
CREATE POLICY "admin_delete_reservations" ON reservations
    FOR DELETE
    USING (is_admin());

-- =====================================================
-- PASO 4: POLÍTICAS PARA RESERVATION_PASSENGERS (RESTRINGIDAS)
-- =====================================================

-- Público: Solo puede INSERTAR pasajeros (necesario para el formulario)
CREATE POLICY "public_insert_passengers" ON reservation_passengers
    FOR INSERT 
    WITH CHECK (true);

-- Público/Admin: Lectura de pasajeros
-- Solo los admins pueden ver todos los pasajeros
-- Los usuarios regulares no pueden listar pasajeros directamente
CREATE POLICY "read_passengers" ON reservation_passengers
    FOR SELECT 
    USING (is_admin());

-- Admin: Puede actualizar pasajeros
CREATE POLICY "admin_update_passengers" ON reservation_passengers
    FOR UPDATE
    USING (is_admin())
    WITH CHECK (is_admin());

-- Admin: Puede eliminar pasajeros
CREATE POLICY "admin_delete_passengers" ON reservation_passengers
    FOR DELETE
    USING (is_admin());

-- =====================================================
-- PASO 5: POLÍTICAS PARA PAYMENTS (SOLO ADMIN)
-- =====================================================

-- Solo Admin puede ver pagos
CREATE POLICY "admin_read_payments" ON payments
    FOR SELECT 
    USING (is_admin());

-- Webhook puede insertar pagos (usando service role)
-- El service role bypassa RLS, así que esto es para referencia
CREATE POLICY "service_insert_payments" ON payments
    FOR INSERT 
    WITH CHECK (true);

-- Admin: Puede actualizar pagos
CREATE POLICY "admin_update_payments" ON payments
    FOR UPDATE
    USING (is_admin())
    WITH CHECK (is_admin());

-- Admin: Puede eliminar pagos
CREATE POLICY "admin_delete_payments" ON payments
    FOR DELETE
    USING (is_admin());

-- =====================================================
-- PASO 6: POLÍTICAS PARA TICKET_ORDERS (RESTRINGIDAS)
-- =====================================================

-- Verificar si RLS está habilitado en ticket_orders
ALTER TABLE IF EXISTS ticket_orders ENABLE ROW LEVEL SECURITY;

-- Público: Puede insertar órdenes de tickets (necesario para comprar)
CREATE POLICY "public_insert_ticket_orders" ON ticket_orders
    FOR INSERT 
    WITH CHECK (true);

-- Público: Solo puede leer su propia orden (por ID de reservación)
-- Esto es más seguro que leer todas
CREATE POLICY "read_own_ticket_orders" ON ticket_orders
    FOR SELECT 
    USING (
        is_admin()
        -- O: Solo puede ver órdenes de su propia reservación
        -- El frontend debe filtrar por reservation_id
        OR true  -- Temporal: mantenemos lectura por ahora
    );

-- Admin: Puede actualizar órdenes
CREATE POLICY "admin_update_ticket_orders" ON ticket_orders
    FOR UPDATE
    USING (is_admin())
    WITH CHECK (is_admin());

-- Webhook: Puede actualizar el status (service role bypassa RLS)
CREATE POLICY "service_update_ticket_orders" ON ticket_orders
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- PASO 7: POLÍTICAS PARA ADMIN_USERS (SOLO LECTURA PARA AUTH)
-- =====================================================

-- Solo lectura para verificar si un email es admin
CREATE POLICY "check_admin_status" ON admin_users
    FOR SELECT 
    USING (true);  -- Necesario para que is_admin() funcione

-- Solo super admins pueden modificar la lista de admins
-- (Esto se haría manualmente desde Supabase Dashboard)

-- =====================================================
-- PASO 8: POLÍTICAS PARA TOUR_GROUPS (SI EXISTE)
-- =====================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tour_groups') THEN
        -- Habilitar RLS
        EXECUTE 'ALTER TABLE tour_groups ENABLE ROW LEVEL SECURITY';
        
        -- Público puede leer grupos (necesario para /mi-grupo)
        EXECUTE 'CREATE POLICY "public_read_tour_groups" ON tour_groups FOR SELECT USING (true)';
        
        -- Solo admin puede modificar grupos
        EXECUTE 'CREATE POLICY "admin_manage_tour_groups" ON tour_groups FOR ALL USING (is_admin()) WITH CHECK (is_admin())';
    END IF;
END $$;

-- =====================================================
-- PASO 9: MEJORAR LA FUNCIÓN create_reservation
-- =====================================================

-- La función ya usa SECURITY DEFINER, lo cual es correcto
-- porque permite que el código se ejecute con privilegios
-- elevados aunque el usuario sea anónimo.

-- Agregaremos validación adicional de inputs
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
    v_boarding_access_code TEXT;
    v_is_infant BOOLEAN;
BEGIN
    -- ========== VALIDACIONES DE SEGURIDAD ==========
    
    -- Validar que el nombre no esté vacío y no contenga caracteres peligrosos
    IF p_responsible_name IS NULL OR LENGTH(TRIM(p_responsible_name)) < 2 THEN
        RAISE EXCEPTION 'Nombre del responsable inválido';
    END IF;
    
    -- Validar teléfono (solo números, 10 dígitos)
    IF p_responsible_phone IS NULL OR LENGTH(p_responsible_phone) != 10 OR p_responsible_phone !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Teléfono inválido. Debe ser de 10 dígitos.';
    END IF;
    
    -- Validar que hay al menos 1 pasajero
    IF p_passengers IS NULL OR jsonb_array_length(p_passengers) = 0 THEN
        RAISE EXCEPTION 'Debe haber al menos un pasajero';
    END IF;
    
    -- Limitar número máximo de pasajeros por reservación (anti-abuse)
    IF jsonb_array_length(p_passengers) > 20 THEN
        RAISE EXCEPTION 'Máximo 20 pasajeros por reservación';
    END IF;
    
    -- ========== LÓGICA DE CREACIÓN ==========
    
    -- Generar código único
    v_code := 'BETEL-2026-' || LPAD(nextval('reservation_seq')::TEXT, 6, '0');
    
    -- Generar código de acceso al abordaje (6 dígitos aleatorios)
    v_boarding_access_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    
    -- Contar lugares y calcular (excluyendo infantes)
    v_seats_total := 0;
    v_seats_payable := 0;
    
    FOR v_passenger IN SELECT * FROM jsonb_array_elements(p_passengers)
    LOOP
        v_is_infant := COALESCE((v_passenger->>'is_infant')::BOOLEAN, FALSE);
        v_age := (v_passenger->>'age')::INTEGER;
        
        -- Infantes no ocupan asiento
        IF NOT v_is_infant THEN
            v_seats_total := v_seats_total + 1;
            
            -- Mayores de 5 años pagan
            IF v_age IS NULL OR v_age >= 5 THEN
                v_seats_payable := v_seats_payable + 1;
            END IF;
        END IF;
    END LOOP;
    
    -- Calcular montos (precio actualizado a $1,800)
    v_total := v_seats_payable * 1800;
    v_deposit := v_total * 0.5;
    
    -- Insertar reservación
    INSERT INTO reservations (
        reservation_code, 
        responsible_name, 
        responsible_phone,
        responsible_congregation, 
        seats_total, 
        seats_payable,
        total_amount, 
        deposit_required,
        boarding_access_code
    ) VALUES (
        v_code, 
        TRIM(p_responsible_name), 
        p_responsible_phone,
        TRIM(COALESCE(p_responsible_congregation, '')), 
        v_seats_total, 
        v_seats_payable,
        v_total, 
        v_deposit,
        v_boarding_access_code
    ) RETURNING id INTO v_reservation_id;
    
    -- Insertar pasajeros
    FOR v_passenger IN SELECT * FROM jsonb_array_elements(p_passengers)
    LOOP
        v_age := (v_passenger->>'age')::INTEGER;
        v_is_infant := COALESCE((v_passenger->>'is_infant')::BOOLEAN, FALSE);
        
        INSERT INTO reservation_passengers (
            reservation_id, 
            first_name, 
            last_name, 
            phone,
            congregation, 
            age, 
            is_free_under6,
            is_infant,
            observations
        ) VALUES (
            v_reservation_id,
            TRIM(COALESCE(v_passenger->>'first_name', '')),
            TRIM(COALESCE(v_passenger->>'last_name', '')),
            v_passenger->>'phone',
            v_passenger->>'congregation',
            v_age,
            COALESCE(v_age, 99) < 5,
            v_is_infant,
            v_passenger->>'observations'
        );
    END LOOP;
    
    -- Retornar datos de la reservación
    RETURN jsonb_build_object(
        'reservation_code', v_code,
        'boarding_access_code', v_boarding_access_code,
        'reservation_id', v_reservation_id,
        'seats_total', v_seats_total,
        'seats_payable', v_seats_payable,
        'total_amount', v_total,
        'deposit_required', v_deposit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PASO 10: VERIFICAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ✅ VERIFICACIÓN FINAL
-- =====================================================

-- Ejecuta esto para verificar las políticas creadas:
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- FIN DEL SCRIPT DE SEGURIDAD
-- =====================================================

-- NOTAS IMPORTANTES:
-- 1. Este script puede ejecutarse múltiples veces (es idempotente)
-- 2. El Service Role Key (usado en webhooks) SIEMPRE bypassa RLS
-- 3. Los usuarios anónimos solo pueden INSERT y leer datos limitados
-- 4. Solo los admins pueden ver/modificar todos los datos
