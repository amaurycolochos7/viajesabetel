-- ================================================
-- ARREGLAR POLÍTICAS RLS - SOLUCIÓN AL PROBLEMA 404
-- ================================================
-- El problema: Las tablas existen pero la API REST devuelve 404
-- Causa: Las políticas RLS están bloqueando el acceso
-- Solución: Políticas temporales permisivas para desarrollo

-- Paso 1: Deshabilitar RLS temporalmente para pruebas
ALTER TABLE attraction_packages DISABLE ROW LEVEL SECURITY;
ALTER TABLE package_reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE package_payments DISABLE ROW LEVEL SECURITY;

-- AHORA PRUEBA LA APLICACIÓN - Debería funcionar

-- ================================================
-- DESPUÉS DE CONFIRMAR QUE FUNCIONA, 
-- ejecuta esto para reactivar seguridad:
-- ================================================
/*
ALTER TABLE attraction_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_payments ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (todos pueden leer y escribir)
DROP POLICY IF EXISTS "Public access" ON attraction_packages;
DROP POLICY IF EXISTS "Public access" ON package_reservations;
DROP POLICY IF EXISTS "Public access" ON package_payments;

CREATE POLICY "Public access" ON attraction_packages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON package_reservations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON package_payments FOR ALL USING (true) WITH CHECK (true);
*/
