-- SQL para corregir permisos públicos
-- Ejecutar en Supabase SQL Editor

-- Permitir lectura pública de pasajeros (necesario para página /mi-grupo)
CREATE POLICY "Public read passengers for tour groups" ON reservation_passengers
  FOR SELECT USING (true);
