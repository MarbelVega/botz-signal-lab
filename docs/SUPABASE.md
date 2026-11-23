# Persistencia opcional con Supabase (Free Tier)

Sin configuración, la app guarda todo en `localStorage`. Con Supabase obtienes respaldo en la nube y la misma sesión en varios navegadores.

## 1. Crear el proyecto

1. Crea una cuenta en supabase.com → **New project** (plan Free).
2. **SQL Editor → New query** → pega `supabase/schema.sql` → **Run**.
3. **Authentication → Sign In / Providers** → activa **Allow anonymous sign-ins**.
4. **Project Settings → API**: copia `Project URL` y la clave `anon` / `publishable`.

## 2. Configurar la app

```bash
cp .env.example .env.local
# edita:
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
npm run dev
```

En la cabecera aparecerán **☁ Guardar** y **☁ Cargar**.

## 3. Cómo funciona

- Al primer uso se crea una **sesión anónima** (`signInAnonymously`); su `user.id` es el `owner` de las filas.
- **Guardar**: reemplaza las señales del usuario, hace *upsert* de la configuración y de los últimos 50 eventos de la bitácora.
- **Cargar**: trae señales y configuración del usuario a `localStorage`.
- **RLS**: cada tabla tiene la política `owner = auth.uid()`, así que un usuario no puede leer ni escribir datos de otro, aunque la `anon key` sea pública.
- El SDK `@supabase/supabase-js` se carga con `import()` dinámico solo si hay credenciales.

## 4. Tablas

| Tabla | PK | Contenido |
|---|---|---|
| `signals` | `(owner, id)` | Señales con estado, veredicto y confluencia |
| `user_settings` | `owner` | JSON con zona horaria, riesgo e indicadores |
| `simulation_log` | `(owner, id)` | Bitácora de acciones |

## 5. Siguientes pasos (fuera del PoC)

- Cambiar la sesión anónima por magic link / OAuth para conservar datos entre dispositivos.
- Usar **Realtime** (`supabase.channel(...)`) para que un "alimentador" publique señales y el dashboard las reciba en vivo.
- Mover la simulación a una Edge Function si se integra un proveedor de datos con API key.
