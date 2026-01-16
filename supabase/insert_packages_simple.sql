-- ================================================
-- INSERTAR PAQUETES - SCRIPT SIMPLIFICADO
-- Copia y pega SOLO este código en Supabase SQL Editor
-- ================================================

-- Primero, eliminar cualquier dato anterior
DELETE FROM package_payments;
DELETE FROM package_reservations;
DELETE FROM attraction_packages;

-- Ahora insertar los 3 paquetes EXACTAMENTE como están en la imagen:
INSERT INTO attraction_packages (id, package_type, name, description, price, active) VALUES
  (gen_random_uuid(), 'museos', 'PAQUETE MUSEOS', 'Museo de Cera + Museo Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 175.00, true),
  (gen_random_uuid(), 'acuario_adultos', 'ACUARIO + MUSEOS ADULTOS', 'Acuario + Museo de Cera + Museo de Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 345.00, true),
  (gen_random_uuid(), 'acuario_ninos', 'ACUARIO + MUSEOS NIÑOS', 'Acuario + Museo de Cera + Museo de Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 285.00, true);

-- Verificar que se insertaron correctamente:
SELECT package_type, name, price FROM attraction_packages ORDER BY price;
