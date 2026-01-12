-- ================================================
-- AGREGAR COLUMNA is_infant A reservation_passengers
-- Ejecutar en Supabase SQL Editor
-- ================================================

-- Agregar columna is_infant si no existe
ALTER TABLE reservation_passengers 
ADD COLUMN IF NOT EXISTS is_infant BOOLEAN DEFAULT FALSE;

-- Opcional: Sincronizar is_infant con is_free_under6 para registros existentes
UPDATE reservation_passengers 
SET is_infant = is_free_under6 
WHERE is_infant IS NULL OR is_infant = FALSE;

-- ================================================
-- FIN DEL SCRIPT
-- ================================================
