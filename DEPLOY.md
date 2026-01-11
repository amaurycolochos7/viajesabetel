# Viaje a Betel 2026 - Guía de Despliegue

## Paso 1: Configurar la Base de Datos en Supabase

### 1.1 Ejecutar el Schema SQL

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard/project/ynqcixheqjfwclstxwek)
2. Click en **SQL Editor** en el menú lateral
3. Click en **New query**
4. Copia y pega todo el contenido del archivo `supabase/schema.sql`
5. Click en **Run** para ejecutar

Esto creará:
- Las tablas: `reservations`, `reservation_passengers`, `payments`, `admin_users`
- El ENUM `reservation_status`
- La función RPC `create_reservation`
- Las políticas RLS
- Los índices de rendimiento
- Tu usuario admin (ismerai.7618@gmail.com)

### 1.2 Crear Usuario Admin en Authentication

1. En Supabase Dashboard, ve a **Authentication** → **Users**
2. Click en **Add user** → **Create new user**
3. Ingresa:
   - **Email**: `ismerai.7618@gmail.com`
   - **Password**: `Gordillo94`
4. Marca **Auto Confirm User** si está disponible
5. Click en **Create user**

---

## Paso 2: Desplegar en Vercel

### 2.1 Subir a GitHub (si aún no lo has hecho)

```bash
cd viaje-betel
git init
git add .
git commit -m "Initial commit - Viaje a Betel 2026"
git remote add origin https://github.com/TU_USUARIO/viaje-betel.git
git push -u origin main
```

### 2.2 Conectar con Vercel

1. Ve a [Vercel](https://vercel.com) e inicia sesión
2. Click en **Add New** → **Project**
3. Importa el repositorio `viaje-betel`
4. En **Environment Variables**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://ynqcixheqjfwclstxwek.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlucWNpeGhlcWpmd2Nsc3R4d2VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwODQ2NTYsImV4cCI6MjA4MzY2MDY1Nn0.swriLD-wVSAZJo3ZMtbhyaNVxPj-rwCZePOxea63qvE`
5. Click en **Deploy**

---

## Paso 3: Probar el Sistema

### Flujo Público
1. Abre la URL de Vercel
2. Verifica que se muestre la landing page con el carrusel
3. Click en "Reservar lugar"
4. Completa el flujo de 4 pasos
5. Verifica que el botón de WhatsApp abra con el mensaje correcto

### Portal Admin
1. Ve a `/admin/login`
2. Ingresa: `ismerai.7618@gmail.com` / `Gordillo94`
3. Verifica el dashboard y las reservaciones

---

## Estructura del Proyecto

```
viaje-betel/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing
│   │   ├── reservar/page.tsx     # Flujo reservación
│   │   └── admin/                # Portal admin
│   ├── components/               # Componentes UI
│   ├── lib/                      # Supabase, WhatsApp
│   └── types/                    # TypeScript
├── public/
│   ├── betel-1.png              # Imagen Betel 1
│   └── betel-2.jpg              # Imagen Betel 2
├── supabase/
│   └── schema.sql               # Schema de BD
└── .env.local                   # Variables de entorno
```

---

## Notas Importantes

- **Anticipo mínimo**: 50% del total
- **Menores de 6 años**: No pagan
- **WhatsApp**: Los mensajes se envían al 9618720544
- **CLABE**: 722969010994673004 (Mercado Pago - Gady Hernández)
