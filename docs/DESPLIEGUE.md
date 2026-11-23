# Despliegue gratuito

La app es un sitio estático (`dist/`). No necesita servidor ni base de datos para funcionar.

## 0. Subir a GitHub

```bash
cd botz-signal-lab
git init -b main
git add .
git commit -m "feat: BOT Z Signal Lab PoC"
git remote add origin https://github.com/<tu-usuario>/botz-signal-lab.git
git push -u origin main
```

El workflow `.github/workflows/ci.yml` ejecuta `npm test` y `npm run build` en cada push.

> Tip: después del primer `npm install`, haz commit del `package-lock.json` para builds reproducibles (`npm ci`).

---

## A. Cloudflare Pages

1. Entra a **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**.
2. Autoriza GitHub y elige el repo `botz-signal-lab`.
3. Configura el build:

   | Campo | Valor |
   |---|---|
   | Framework preset | `React (Vite)` (o *None*) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | *(vacío)* |

4. **Environment variables** (Production y Preview):
   - `NODE_VERSION` = `20`
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` *(solo si usarás Supabase)*
5. **Save and Deploy** → URL `https://botz-signal-lab.pages.dev`.
6. Cada push a `main` redepliega; cada PR genera un *preview deployment*.

**Alternativa CLI (Wrangler):**
```bash
npm run build
npx wrangler pages deploy dist --project-name botz-signal-lab
```

`public/_headers` se copia a `dist/` y Cloudflare aplica las cabeceras de seguridad automáticamente.

---

## B. Vercel Hobby

1. **vercel.com → Add New → Project → Import Git Repository** → `botz-signal-lab`.
2. Vercel detecta Vite (`vercel.json` ya define `buildCommand` y `outputDirectory`).
3. **Environment Variables** (opcional): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. **Deploy** → `https://botz-signal-lab.vercel.app`.

**CLI:**
```bash
npm i -g vercel
vercel          # preview
vercel --prod   # producción
```

---

## C. Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `VITE_SUPABASE_URL` | No | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | No | Clave pública *anon* (protegida por RLS) |

Las variables `VITE_*` se **incrustan en el bundle en tiempo de build**: si las cambias, vuelve a desplegar. Nunca pongas una `service_role` key ni API keys privadas con prefijo `VITE_`.

## D. Checklist post-deploy

- [ ] El banner de disclaimer se ve arriba y en el pie.
- [ ] El reloj muestra UTC-3 por defecto y el countdown avanza.
- [ ] *Ejemplo REAL → Cargar lista → Simular* produce estados y KPIs.
- [ ] *Analizar* muestra velas, EMA, Bollinger, fractales, RSI y Estocástico.
- [ ] (Opcional) *☁ Guardar / ☁ Cargar* funcionan con Supabase.
