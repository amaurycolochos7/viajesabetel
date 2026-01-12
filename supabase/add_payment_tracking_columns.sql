-- ================================================
-- AGREGAR COLUMNAS DE TRACKING DE MÉTODO DE PAGO
-- Ejecutar en Supabase SQL Editor
-- ================================================

-- Agregar columna para método de pago elegido por el usuario
-- 'card' = MercadoPago/Tarjeta, 'transfer' = Transferencia bancaria
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Agregar columna para estado de pago de MercadoPago
-- 'pending' = Esperando pago, 'approved' = Pago aprobado, 'rejected' = Pago rechazado
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS mp_payment_status TEXT;

-- Comentario para documentación
COMMENT ON COLUMN reservations.payment_method IS 'Método de pago elegido: card (MercadoPago) o transfer (Transferencia)';
COMMENT ON COLUMN reservations.mp_payment_status IS 'Estado de pago MercadoPago: pending, approved, rejected';
