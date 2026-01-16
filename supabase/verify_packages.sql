-- ================================================
-- SCRIPT DE VERIFICACIÓN
-- Ejecuta esto en Supabase SQL Editor para verificar
-- ================================================

-- Verificar si existen los paquetes
SELECT * FROM attraction_packages;

-- Si la consulta anterior no muestra nada, ejecuta esto para insertar manualmente:
/*
INSERT INTO attraction_packages (package_type, name, description, price, active) VALUES
  ('museos', 'PAQUETE MUSEOS', 'Museo de Cera + Museo Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 175.00, true),
  ('acuario_adultos', 'ACUARIO + MUSEOS ADULTOS', 'Acuario + Museo de Cera + Museo de Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 345.00, true),
  ('acuario_ninos', 'ACUARIO + MUSEOS NIÑOS', 'Acuario + Museo de Cera + Museo de Ripley + Viaje Fantástico + Túnel Giratorio + Laberinto de Espejos', 285.00, true)
ON CONFLICT (package_type) DO UPDATE 
  SET name = EXCLUDED.name, 
      description = EXCLUDED.description, 
      price = EXCLUDED.price,
      active = EXCLUDED.active;
*/

-- Verificar políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'attraction_packages';
