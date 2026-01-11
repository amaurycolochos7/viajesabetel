-- ================================================
-- ACTUALIZACIÓN: Columna de Abordaje
-- Ejecutar en Supabase SQL Editor
-- ================================================

-- Agregar columna para marcar si el pasajero ya abordó el autobús
ALTER TABLE reservation_passengers 
ADD COLUMN boarded BOOLEAN DEFAULT FALSE;

-- Actualizar política RLS para permitir al admin actualizar esta columna
-- (Las políticas existentes "Admin pasajeros" ya permiten ALL, así que debería funcionar sin cambios,
-- pero verificamos que no haya restricciones específicas de columnas).
