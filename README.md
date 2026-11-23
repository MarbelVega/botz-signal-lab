# BOT Z Signal Lab · PoC educativo

> ⚠️ **Disclaimer.** Simulador educativo / Proof of Concept con fines **analíticos**. No ejecuta operaciones, no se conecta a ningún broker y **no es asesoría financiera** ni recomendación de inversión. Operar opciones binarias, Forex, cripto o mercados **OTC** conlleva **alto riesgo** de pérdida total del capital. Los esquemas de ciclos (Gale / martingala) aumentan la exposición y no cambian la ventaja estadística de una estrategia.

Dashboard web inspirado en la dinámica operativa de *"TRADING Z ACADEMY | El BOT Z"* (lista de señales por hora → filtro de indicadores sobre las 3 velas previas → gestión de ciclos), construido para **visualizar, filtrar y simular** sin dinero real.

| Módulo | Qué hace |
|---|---|
| 🕒 **Reloj operativo** | Selector de zona horaria (★ UTC-3 `America/Sao_Paulo` por defecto, `America/La_Paz`, `UTC`…), hora en vivo, countdown a cierre de vela M1/M5 y a la próxima señal. |
| 📋 **Gestor de señales (tuplas)** | `Hora · Activo · Mercado (REAL/OTC) · Expiración (M1/M5) · Dirección (CALL/PUT) · Estado`. Pegar lista en texto libre o añadir manual. Regla **no mezclar REAL y OTC**. |
| 🧮 **Motor 3 velas + Ley 1 / Ley 2** | Voto de `EMA 100`, `Fractals 6P`, `Bollinger 20,2`, `RSI 6 [80/20]`, `Stochastic K=6 [80/20]`; conteo CALL/PUT/Neutro, veredicto `APROBADA / REVISAR / DESCARTADA`, nivel de confluencia y límite de ciclos. Clic en el gráfico para cambiar la vela objetivo. |
| 💰 **Calculadora de ciclos** | Capital, monto base, multiplicador (2.2), payout (85 %), modo (`Copia: hasta G2` / `Filtro: máx. G1`). Tabla Base/G1/G2, exposición acumulada, break-even y valor esperado. **Sin Gale 3+**. |
| 📈 **Métricas de sesión** | Win rate, ganadas Base/G1/G2, pérdidas, señales filtradas (y cuántas habrían perdido), P&L, drawdown y curva de equity. |
| 💾 **Persistencia** | `localStorage` (por defecto, sin credenciales) + sincronización opcional con **Supabase Free Tier** (Auth anónima + RLS). Export JSON. |

---

## 1. Arranque rápido (local)

```bash
git clone https://github.com/<tu-usuario>/botz-signal-lab.git
cd botz-signal-lab
npm install
npm run dev          # http://localhost:5173
```

Requisitos: **Node.js ≥ 18.18** (recomendado 20 LTS o 22 LTS).

| Script | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo Vite con HMR |
| `npm run build` | Type-check (`tsc -b`) + build de producción en `dist/` |
| `npm run preview` | Sirve `dist/` localmente |
| `npm test` | Pruebas unitarias (Vitest) de indicadores, leyes, ciclos, parser y zonas horarias |

**Primer uso (2 minutos):**
1. En *Gestor de señales* pulsa **Ejemplo REAL** → **Cargar lista**.
2. Pulsa **▶ Simular pendientes** (las señales de horas ya pasadas se resuelven con el mercado simulado).
3. Pulsa **Analizar** en cualquier fila para ver el gráfico, las 3 velas evaluadas y el veredicto.
4. Cambia el **Modo operativo** en la calculadora y pulsa **↻ Re-simular todo** para comparar *copia sin filtro* vs *con filtro*.

> Sin `.env` la app funciona 100 % offline con datos mock deterministas.

---

## 2. Stack (Zero-Cost)

| Capa | Tecnología | Free tier |
|---|---|---|
| UI | React 18 + TypeScript + Vite 5 + Tailwind CSS 3 | — |
| Gráficos | `lightweight-charts` 4 (TradingView, Apache-2.0) | — |
| Indicadores | Cálculo propio en cliente (`src/lib/indicators.ts`), sin dependencias | — |
| Datos | Mock determinista (offline) · Binance público `data-api.binance.vision` (solo cripto, sin API key) | ✅ |
| Persistencia | `localStorage` · Supabase (Postgres + Auth anónima + RLS) opcional | ✅ Supabase Free |
| Hosting | Cloudflare Pages o Vercel Hobby (sitio estático) | ✅ |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | ✅ |

---

## 3. Estructura del proyecto

```text
botz-signal-lab/
├─ .github/workflows/ci.yml      # test + build en cada push/PR
├─ docs/
│  ├─ ARQUITECTURA.md            # capas, flujo de datos, diagramas
│  ├─ INDICADORES_Y_LEYES.md     # fórmulas, reglas de voto, Ley 1 / Ley 2, ciclos
│  ├─ DESPLIEGUE.md              # Cloudflare Pages / Vercel paso a paso
│  └─ SUPABASE.md                # persistencia opcional en la nube
├─ public/                       # favicon, _headers (Cloudflare)
├─ supabase/schema.sql           # tablas + RLS
├─ src/
│  ├─ components/                # UI (React)
│  │  ├─ AnalysisSection.tsx     # motor 3 velas + Ley 1/2 (panel interactivo)
│  │  ├─ PriceCharts.tsx         # velas + EMA + BB + fractales | RSI + Stoch
│  │  ├─ SignalManager.tsx       # tabla/feed, parser, regla REAL vs OTC
│  │  ├─ RiskCalculator.tsx      # ciclos Base/G1/G2, break-even, EV
│  │  ├─ SessionMetrics.tsx      # KPIs + curva de equity
│  │  ├─ TimezoneClock.tsx       # zona horaria + countdowns
│  │  ├─ SettingsPanel.tsx       # parámetros de indicadores y reglas
│  │  ├─ Disclaimer.tsx · ui.tsx
│  ├─ hooks/                     # useNow, usePersistentState
│  ├─ lib/                       # lógica pura y testeable (sin React)
│  │  ├─ indicators.ts           # EMA, SMA, Bollinger, RSI (Wilder), Estocástico, Fractales
│  │  ├─ evaluation.ts           # votos por indicador + Ley 1 + Ley 2
│  │  ├─ simulate.ts             # contexto de velas, resultado de mercado, estado final
│  │  ├─ risk.ts                 # tabla de ciclos, break-even, EV, P&L
│  │  ├─ metrics.ts              # KPIs y equity
│  │  ├─ parser.ts               # texto → señales
│  │  ├─ marketData.ts           # mock determinista + Binance público
│  │  ├─ time.ts                 # zonas horarias sin librerías (Intl)
│  │  ├─ storage.ts · supabase.ts
│  │  └─ __tests__/core.test.ts
│  ├─ data/sampleSignals.ts
│  ├─ App.tsx · main.tsx · index.css
├─ index.html · vite.config.ts · tailwind.config.js · tsconfig*.json
├─ vercel.json · .env.example · LICENSE
```

---

## 4. Formato de la lista de señales

Una señal por línea; las horas se interpretan en la **zona horaria de la lista** (por defecto UTC-3). Líneas que empiezan con `#` o `//` se ignoran.

```text
M5;EUR/AUD;14:30;CALL
14:30 - EUR/GBP OTC - PUT - M1
EURUSD-OTC 09:15 CALL M5
2026-11-23 10:05 GBP/CHF PUT M1
```

- **Dirección:** `CALL|COMPRA|BUY|ARRIBA|🟢` · `PUT|VENTA|SELL|ABAJO|🔴`
- **Expiración:** `M1` (por defecto) o `M5`
- **Mercado:** si aparece `OTC` → OTC; si no → REAL
- **Fecha opcional:** `YYYY-MM-DD` o `DD/MM`; si no, se usa el día actual de la lista.

Si la regla **Bloquear mezcla REAL/OTC** está activa (por defecto), se rechazan las señales de un mercado distinto al de la sesión.

---

## 5. Despliegue gratuito (resumen)

| Plataforma | Build command | Output | Variables (opcionales) |
|---|---|---|---|
| Cloudflare Pages | `npm run build` | `dist` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `NODE_VERSION=20` |
| Vercel Hobby | `npm run build` (auto) | `dist` (auto) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

Guía detallada: [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).

---

## 6. Documentación

- [Arquitectura](docs/ARQUITECTURA.md)
- [Indicadores, Ley 1, Ley 2 y ciclos](docs/INDICADORES_Y_LEYES.md)
- [Despliegue](docs/DESPLIEGUE.md)
- [Supabase (opcional)](docs/SUPABASE.md)

## 7. Limitaciones conocidas del PoC

- Los datos **mock** son sintéticos (ruido coherente determinista): sirven para probar el flujo, **no** para validar una estrategia.
- Los precios **OTC** reales los genera cada broker y no son públicos; aquí se simulan con mayor volatilidad.
- Binance público solo cubre cripto (`BTC/USDT`, `ETH/USDT`…). Para Forex real se puede añadir un proveedor con API key gratuita (ver `docs/ARQUITECTURA.md` §6).
- Las reglas de voto son una **interpretación configurable**; ajústalas en *Configuración* o en `src/lib/evaluation.ts`.
- El resultado de cada vela se decide por `close` vs `open`; un doji cuenta como pérdida (criterio conservador).

## Licencia

MIT. Uso educativo. Sin garantía de ningún tipo.
