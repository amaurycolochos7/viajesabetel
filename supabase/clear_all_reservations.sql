-- ================================================
-- LIMPIEZA TOTAL DE DATOS
-- ¡ADVERTENCIA! Esto eliminará TODAS las reservaciones, pasajeros y pagos.
-- Ejecutar en Supabase SQL Editor
-- ================================================

-- Limpiar tablas (el orden importa por las llaves foráneas, o usar CASCADE)
TRUNCATE TABLE payments, reservation_passengers, reservations CASCADE;

-- Reiniciar la secuencia de códigos de reservación para empezar desde 1
ALTER SEQUENCE reservation_seq RESTART WITH 1;
