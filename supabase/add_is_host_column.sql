-- Agregar columna is_host a la tabla reservations
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS is_host BOOLEAN DEFAULT FALSE;

-- Comentario para documentación
COMMENT ON COLUMN reservations.is_host IS 'Indica si la reservación pertenece a un anfitrión (no cuenta para ingresos)';
