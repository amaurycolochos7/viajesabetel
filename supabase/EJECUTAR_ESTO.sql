-- =========================================
-- SQL para Ticket Purchase System
-- Ejecutar en Supabase SQL Editor
-- =========================================

-- Este script crea/actualiza las tablas necesarias para el sistema
-- de compra de entradas a centros turísticos

-- 1. Asegurarse de que la tabla ticket_orders existe con todas las columnas
-- (Si ya fue ejecutado create_ticket_orders.sql, esto solo agregará las nuevas columnas)

ALTER TABLE public.ticket_orders 
ADD COLUMN IF NOT EXISTS payment_reference TEXT,
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- 2. Agregar índice para búsquedas por referencia de pago
CREATE INDEX IF NOT EXISTS idx_ticket_orders_payment_reference 
ON public.ticket_orders(payment_reference) 
WHERE payment_reference IS NOT NULL;

-- 3. Comentarios descriptivos
COMMENT ON COLUMN public.ticket_orders.payment_reference IS 'External payment reference (e.g., MercadoPago payment ID)';
COMMENT ON COLUMN public.ticket_orders.payment_notes IS 'Additional payment notes or details';

-- 4. Verificar que existen las políticas RLS (deberían estar creadas del script anterior)
-- Si no existen, descomentar y ejecutar:

/*
ALTER TABLE public.ticket_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Enable insert for everyone" 
ON public.ticket_orders FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable read for everyone" 
ON public.ticket_orders FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Enable update for everyone" 
ON public.ticket_orders FOR UPDATE USING (true);
*/

-- 5. Verificación: Consultar las órdenes existentes
-- Puedes ejecutar esto para verificar que todo funciona:

SELECT 
    o.id,
    r.reservation_code,
    r.responsible_name,
    o.total_amount,
    o.status,
    o.payment_method,
    o.created_at,
    jsonb_array_length(o.items) as num_tickets
FROM 
    ticket_orders o
    INNER JOIN reservations r ON o.reservation_id = r.id
ORDER BY 
    o.created_at DESC
LIMIT 20;

-- =========================================
-- Fin del script
-- =========================================

-- NOTAS:
-- - Este script es idempotente (se puede ejecutar múltiples veces sin problemas)
-- - Las políticas RLS permiten acceso público necesario para el flujo de compra
-- - En producción, considera restringir las políticas para mayor seguridad
x