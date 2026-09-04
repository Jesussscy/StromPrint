# StormPrint

**La huella que deja cada tormenta en el territorio.**
Simulación ciberfísica del riesgo de inundación en el barrio Manga, Cartagena de Indias.

## Arquitectura

```
StormPrint/
├── api/                    FastAPI serverless (Python 3.12)
│   ├── index.py            Entrypoint, rutas, validación Pydantic V2
│   ├── database.py         SQLite async (SQLAlchemy 2 + aiosqlite)
│   ├── security.py         Auth por API key, rate limiting, headers, CORS
│   ├── physics_engine.py   EDO de 2do orden (SciPy solve_ivp, RK45)
│   ├── physics_engine_analytical.py  Solución analítica por tramos (Duhamel)
│   ├── weather_service.py  Open-Meteo + cache resbaloso (vivo→histórico→promedio)
│   ├── tide_service.py     Marea Open-Meteo Marine con fallback analítico
│   └── notification_service.py  Alertas multi-canal + suscripciones por email
├── app/                    Next.js 14 App Router (React 18 + TS)
│   ├── layout.tsx
│   ├── template.tsx        Transición de página entre pestañas (framer-motion)
│   ├── page.tsx            Dashboard
│   ├── alertas/page.tsx    Centro de Alertas + suscripción
│   ├── ciencia/page.tsx    Validación analítica vs numérica
│   ├── middleware.ts       Bloqueo Edge de archivos sensibles (404)
│   ├── globals.css         Tema Cyber-Hydro Glassmorphism
│   ├── lib/api.ts          Cliente HTTP tipado con timeout y dedupe
│   └── components/         Navbar, Footer, MobileBottomNav, Panel, CesiumMap
│                           (visor 3D), HeatmapView, WeatherStation, ForecastDayCard,
│                           SummaryDashboard, ZonasMangaPanel, Simulador3D, …
├── tests/                  Suite pytest (umbrales, motor, notificaciones, API)
├── vercel.json
├── requirements.txt
├── package.json
└── tailwind.config.js
```

## Modelo físico

El nivel de acumulación de agua $H(t)$ en el territorio se modela como un
oscilador amortiguado de segundo orden:

```
m·H''(t) + c·H'(t) + k·H(t) = F_lluvia(t) + F_marea(t)
```

- `m` — inercia de la masa hídrica
- `c` — coeficiente de amortiguamiento (capacidad de drenaje pluvial)
- `k` — rigidez del terreno (absorción natural / elevación)
- `F_lluvia(t)` — pulso gaussiano representando una tormenta convectiva tropical
- `F_marea(t)` — forzamiento semidiurno acoplado a la Bahía de Cartagena

Se resuelve numéricamente con `scipy.integrate.solve_ivp` (Runge-Kutta 45),
persistiendo cada paso de tiempo en SQLite (`FloodRecord`).

Umbrales de riesgo: `< 30cm` Normal · `30–59cm` Alerta · `60–99cm` Emergencia · `≥ 100cm` Crítico.

## Solución analítica (académica)

`physics_engine_analytical.py` resuelve la misma EDO de forma **analítica por tramos**
con fines educativos, sin sustituir a `solve_ivp` en producción:

- Divide el tiempo en tramos donde `c(t)` y `k(t)` son constantes.
- En cada tramo usa la ecuación característica `m·r² + c·r + k = 0` y la solución
  homogénea cerrada (sobreamortiguada / crítico / subamortiguado).
- El forzamiento se resuelve con la integral de convolución de **Duhamel**
  `H_p(t) = ∫₀ᵗ F(τ)·g(t−τ) dτ` (única parte numérica).
- Ajusta las constantes de la homogénea para satisfacer condiciones iniciales.

`POST /api/v1/comparacion` ejecuta ambos métodos y devuelve ambas curvas más las
métricas de error (promedio, máximo, RMSE) para contrastarlas en la UI de `/ciencia`.
Verificación: `python -m api.physics_engine_analytical`.

## Seguridad (OWASP Top 10)

- **Auth**: header `X-StormPrint-Key`, comparado en tiempo constante contra un
  hash SHA-256 salado. Cubre `/predict`, `/history`, `/weather` y `/comparacion`.
  `/predecir`, `/predicciones`, `/health`, `/notifications` y `/notify/*` son
  públicos y dependen de rate limiting + validación estricta.
- **Rate limiting**: `slowapi`, 10 peticiones/min por IP en `/api/v1/predict`;
  30/min en predecir, health y notificaciones; 10/min en suscripciones.
- **Validación**: Pydantic V2 con límites estrictos en cada campo numérico
  (ej. `storm_width` → `rain_duration_h`, clamps físicos 30/60/100).
- **Errores sanitizados**: en producción, cualquier excepción no controlada
  responde `500` genérico sin trazas internas.
- **Headers**: CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`.
- **CORS**: lista blanca explícita vía `STORMPRINT_ALLOWED_ORIGINS`.
- **Archivos sensibles**: el middleware Edge (`app/middleware.ts`) responde
  `404` para `notifications.json`, `subscriptions.json`, `*.db`, `*.log` y `.env`;
  los caches y suscripciones se gitignorean.
- **Credenciales admin**: `generate_admin_credentials` / `verify_admin_credentials`
  en `security.py` usan PBKDF2-HMAC-SHA256 (100k iteraciones) con salt por usuario.

## API

```
POST /api/v1/predecir       Predicción pública 0–168h (meteo Open-Meteo o manual)
POST /api/v1/predict        Simulación legacy manual (requiere API key)
GET  /api/v1/health         Healthcheck ampliado (DB, caches, uptime)
GET  /api/v1/weather        Clima en vivo (requiere API key)
GET  /api/v1/history        Historial de simulaciones (requiere API key)
GET  /api/v1/predicciones   Últimas predicciones guardadas
POST /api/v1/comparacion    Analítico vs numérico (requiere API key)
GET  /api/v1/notifications  Historial de alertas + métricas
POST /api/v1/notify/subscribe|unsubscribe   Suscripción por email
GET  /api/v1/notify/status  Estado del canal de alertas
```

La UI de `/alertas` consume notificaciones + estado del canal y permite
suscribirse por correo; `/ciencia` contrasta la solución analítica contra la
numérica con métricas reales (promedio, máximo, RMSE).

## Desarrollo local

```bash
# Backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install pytest        # solo para correr los tests
cp .env.example .env      # completar STORMPRINT_API_KEY

npm run backend           # uvicorn api.index:app --reload --port 8000
npm test                  # python -m pytest tests -q
npm run typecheck         # tsc --noEmit
npm run lint              # next lint

# Frontend (otra terminal)
npm install
npm run dev
```

Durante desarrollo local, `next.config.js` ya reenvía `/api/v1/*` hacia
`http://localhost:8000`; en `vercel dev`/producción lo resuelve `vercel.json`.

## Despliegue en Vercel

1. Configura las variables de entorno del `.env.example` en el dashboard de
   Vercel (Project Settings → Environment Variables).
2. `vercel --prod`. `vercel.json` unifica el build de Next.js con la función
   serverless Python (`api/index.py`, runtime `python3.12`).
3. En Vercel, SQLite se abre en `/tmp/stormprint.db` (única ruta escribible
   en funciones serverless) — `database.py` detecta `VERCEL=1` automáticamente.
   Para persistencia real entre invocaciones/deploys, migra a Postgres/Turso
   manteniendo el mismo modelo `FloodRecord`.

## Modelo 3D

El visor 3D principal es `CesiumMap.tsx` (Cesium, lazy-load en el Panel en vivo):
globo con imagery ArcGIS World Imagery + elevación ArcGIS, 20 zonas críticas de
Manga con pins y círculos de influencia, columnas territoriales animadas por
`H(t)`, capa de calor y HUD de nivel.

### Capas base y hosts permitidos (importante en Vercel)

El mapa usa tiles cargados en tiempo de ejecución (fetch/XHR), por lo que la
**CSP debe permitir los hosts de imagery y terreno**. Si se bloquean, el globo
queda en blanco (no se ve ni el mapa normal ni el de calor, que se dibuja sobre
él). La CSP se define **dos veces**: en `next.config.js` (desarrollo/`next start`)
y en `vercel.json` (producción en Vercel, que sobreescribe la de Next). Hay que
mantenerlas sincronizadas:

- `img-src`: `https://server.arcgisonline.com`, `https://*.tile.openstreetmap.org`,
  `https://tile.openstreetmap.org` (subdominio raíz, sin comodín), `https://*.cartocdn.com`.
- `connect-src` (tiles vía fetch): los mismos hosts de arriba + `https://elevation3d.arcgis.com`
  para el terreno 3D de ArcGIS y `https://api.open-meteo.com` para el clima.
- `worker-src`: `'self' blob:` (workers de Cesium servidos desde `/cesium/Workers`).

Los assets estáticos de Cesium se sirven desde `public/cesium` bajo `CESIUM_BASE_URL=/cesium`
(Assets, ThirdParty, Widgets y Workers). Si un proveedor de tiles falla repetidamente,
`CesiumMap` hace *failover* automático a OpenStreetMap para que el visor nunca quede en blanco.
