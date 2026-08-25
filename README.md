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
│   └── physics_engine.py   EDO de 2do orden (SciPy solve_ivp, RK45)
├── app/                    Next.js 14 App Router (React 18 + TS)
│   ├── layout.tsx
│   ├── page.tsx             Dashboard
│   ├── globals.css          Tema Cyber-Hydro Glassmorphism
│   ├── lib/api.ts           Cliente HTTP tipado hacia /api/v1/*
│   └── components/
│       ├── Canvas3D.tsx         Visor 3D (react-three-fiber + drei)
│       ├── TimelineSlider.tsx   Control temporal 0–168h (Framer Motion)
│       └── MetricsPanel.tsx     Tarjetas de riesgo + gráfico H(t)
├── public/models/manga_model.glb
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

Umbrales de riesgo: `< 15cm` bajo · `15–30cm` moderado · `30–45cm` alto · `≥ 45cm` crítico.

## Seguridad (OWASP Top 10)

- **Auth**: header `X-StormPrint-Key`, comparado en tiempo constante contra un
  hash SHA-256 salado. Nunca se registra ni se refleja el valor crudo.
- **Rate limiting**: `slowapi`, 10 peticiones/min por IP en `/api/v1/predict`.
- **Validación**: Pydantic V2 con límites estrictos en cada campo numérico.
- **Errores sanitizados**: en producción, cualquier excepción no controlada
  responde `500` genérico sin trazas internas.
- **Headers**: CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`.
- **CORS**: lista blanca explícita vía `STORMPRINT_ALLOWED_ORIGINS`.
- **Credenciales admin**: `generate_admin_credentials` / `verify_admin_credentials`
  en `security.py` usan PBKDF2-HMAC-SHA256 (100k iteraciones) con salt por usuario.

## Desarrollo local

```bash
# Backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # completar STORMPRINT_API_KEY

uvicorn api.index:app --reload --port 8000

# Frontend (en otra terminal)
npm install
npm run dev
```

Durante desarrollo local, agrega un rewrite en `next.config.js` (o usa un
proxy) apuntando `/api/v1/*` hacia `http://localhost:8000`, ya que en
`vercel dev`/producción esto lo resuelve `vercel.json` automáticamente.

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

`public/models/manga_model.glb` incluido es un placeholder mínimo pero válido
(dos planos: `Territory_Manga` y `WaterLevel_Animated`) generado con
`pygltflib`, para que el visor 3D funcione end-to-end sin depender de un
asset externo. Sustitúyelo por un modelo real (fotogrametría/GIS de Manga)
conservando el nombre de nodo `WaterLevel_Animated`, que es el que
`Canvas3D.tsx` anima en elevación y color según `H(t)`.
