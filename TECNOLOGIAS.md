# 🧰 Tecnologías de StormPrint

![next]: https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
![react]: https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black
![ts]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
![tailwind]: https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=black
![python]: https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white
![fastapi]: https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white
![scipy]: https://img.shields.io/badge/SciPy-8CAAE6?style=for-the-badge&logo=scipy&logoColor=black
![cesium]: https://img.shields.io/badge/Cesium-0E5A8A?style=for-the-badge&logo=cesium&logoColor=white
![three]: https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white

![next][next] ![react][react] ![ts][ts] ![tailwind][tailwind] ![python][python]
![fastapi][fastapi] ![scipy][scipy] ![cesium][cesium] ![three][three]

> Guía técnica de cada librería, framework y servicio: qué es, qué hace en
> StormPrint y dónde vive en el código. Versiones tomadas de `package.json` y
> `requirements.txt`.

---

## 1. Frontend

### ⚛️ React 18.3.1 · `app/`
Biblioteca de UI por componentes. StormPrint es 100% **`"use client"`** (SPA con
estados locales + contexto). Componentes clave: `Navbar`, `DashboardMovil`,
`CesiumMap`, `HeatmapView`, `SummaryDashboard`.

### 🚀 Next.js 14.2.15 · `app/`, `next.config.js`
Framework de React con **App Router**. Usos:
- Rutas por carpetas: `/`, `/alertas`, `/ciencia`.
- `app/layout.tsx`: metadatos, tema, **PWA manifest** y apple-touch-icon.
- `app/template.tsx`: transición de página entre pestañas (framer-motion).
- `next.config.js`: reenvío en dev de `/api/v1/*` → `127.0.0.1:8000`, `CESIUM_BASE_URL=/cesium`
  y **Security Headers** (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy).
- `app/middleware.ts`: Edge middleware que responde `404` a archivos sensibles.

### 🟦 TypeScript 5.6.3 · todo `.tsx`
Tipado estático. El cliente HTTP (`app/lib/api.ts`) define contratos tipados para
cada endpoint (`PrediccionResponse`, `WaterStateResponse`, `FloodRecord`, …) con
deduplicación de peticiones y *race-condition guard* en el polling.

### 🎨 Tailwind CSS 3.4.13 · `app/globals.css`, `tailwind.config.js`
Framework de utilidades. Define el tema **Cyber-Hydro Glassmorphism**: gradientes,
vidrio (`backdrop-blur`), tokens de color y animaciones custom, sin CSS escrito a mano.

### 🎬 framer-motion 11.11.9
Animaciones declarativas: transiciones entre pestañas (`template.tsx`),
expansión del drawer de navegación y micro-interacciones del dashboard.

### 🖼️ lucide-react
Iconografía del sistema (ajustada por proyecto, sin dependencias de fuentes de iconos externas).

### 📊 recharts 2.12.7
Gráficos del panel: **Proyección del nivel de agua**, comparador de escenarios y
gráficos de historial (`app/components/` + `app/page.tsx`).

### 🔬 KaTeX + react-katex + react-syntax-highlighter · `app/ciencia/page.tsx`
Renderizado de la matemática del modelo (ecuaciones de Duhamel vs. RK4) y resaltado
de sintaxis para el laboratorio didáctico **100% en el navegador**.

---

## 2. Visualización 3D

### 🌍 Cesium ^1.144.0 · `app/components/CesiumMap.tsx`
GIS 3D basado en WebGL.
- Globo con **imagery ArcGIS World Imagery** y **elevación 3D** de ArcGIS.
- **20 zonas críticas** de Manga: pins con ~emblema, círculos de influencia y
  columnas territoriales animadas por `H(t)`.
- **Clustering** de marcadores (`CustomDataSource` + `clustering.pixelRange = 45`)
  para evitar saturar el mapa al alejar la cámara.
- Capa de **calor interpolada** y HUD de nivel; *failover* automático de tiles a
  OpenStreetMap si ArcGIS falla.
- Assets servidos desde `public/cesium` (`CESIUM_BASE_URL=/cesium`) incluyendo
  `Workers`, `Assets`, `ThirdParty` y `Widgets`.

### 🧊 Three.js 0.169.0 + @react-three/fiber 8.17.10 + drei 9.114.3 · `ZonaFlood3D.tsx`
Recreación 3D por zona con texturas procedurales: terreno, masa de agua animada y
perspectiva cercana al usuario para "sentir" la inundación.

---

## 3. Backend

### 🐍 Python 3.12/3.13 · `api/`
Lenguaje del backend científico. Estructura por módulos de responsabilidad única
(`physics_engine`, `weather_service`, `tide_service`, `security`, `storage`, …).

### ⚡ FastAPI 0.115.0 · `api/index.py`
Framework web ASGI. Define rutas, middlewares (CORS, rate limit, seguridad),
validación con Pydantic V2 y documentación OpenAPI automática en `/docs`.

### 🔁 Uvicorn 0.30.6
Servidor ASGI para desarrollo (`npm run backend` → `uvicorn api.index:app --reload --port 8000`).

### ✅ Pydantic 2.9.2
Validación estricta de requests/responses: límites físicos en cada campo numérico
(ej. clamps de riesgo 30/60/100 cm, rangos de duración de tormenta).

### 🗄️ SQLAlchemy 2.0.35 (+ aiosqlite 0.20.0, asyncpg 0.30.0) · `api/database.py`
**ORM asíncrono**. Persiste predicciones e historial en **SQLite** por defecto
(`aiosqlite`) o **PostgreSQL/Neon/Turso** (`asyncpg`) vía `DATABASE_URL`.

### 🔬 SciPy 1.14.1 + NumPy 2.1.1 · `api/physics_engine.py`
`scipy.integrate.solve_ivp` (Runge-Kutta 45) resuelve la EDO de 2⁰ orden:
`m·H'' + c(t)·H' + k(t)·H = F_lluvia + F_marea + F_viento` para las 20 zonas.

### 🚦 slowapi 0.1.9 · `api/security.py`
Rate limiting: 10/min `/predict`, 30/min endpoints públicos, 10/min suscripciones,
con respuestas `429 Too Many Requests`.

### 🌐 httpx 0.27.2 · `api/weather_service.py`, `api/tide_service.py`
Cliente HTTP asíncrono hacia **Open-Meteo** (GFS para clima + Marine para serie de
marea `sea_level_height_msl`), con cache resbaloso *vivo→histórico→promedio* y
fallback analítico de marea.

### 🕒 tzdata 2026.3
Base de datos de zonas horarias que permite correr todo el pipeline en
**America/Bogota** también en Windows/CI (t=0 = *ahora* en Cartagena).

### 🗄️ python-multipart 0.0.9
Soporte para formularios (suscripción/desuscripción por email en `/notify/*`).

---

## 4. Servicios externos

### ☁️ Open-Meteo
- **Weather API (GFS)**: temperatura, lluvia, viento, humedad por coordenada de Manga.
- **Marine API**: serie horaria de nivel del mar (`sea_level_height_msl`) para la marea real.
- Sin API key, gratuito, con caché del lado del servidor en `weather_service`.

### 🗺️ Providers de tiles (runtime, CSP permitido)
| Proveedor | Uso |
|---|---|
| `server.arcgisonline.com` | Imagery satelital + `elevation3d.arcgis.com` para terreno 3D |
| `*.tile.openstreetmap.org` | Fallback de imagery si ArcGIS falla |
| `*.cartocdn.com` | Capas base alternativas |

### ▲ Vercel · `vercel.json`
Despliegue unificado: build de Next.js + **función serverless Python**
(`@vercel/python`, 1024 MB, `maxDuration: 10`) con reescrituras `/api/v1/*` → `/api`,
cabeceras de seguridad globales y caché inmutable para `/_next/static` y `/cesium`.

### 📲 PWA
`app/manifest.json` + icónos en `public/`: nombre corto/largo, tema oscuro y
`display: standalone` para instalar StormPrint en el móvil.

---

## 5. Pruebas y calidad

### 🧪 pytest (45 tests) · `tests/`
- `test_api.py` — endpoints, rate limit, auth por API key, errores sanitizados.
- `test_physics_engine.py` — solución numérica, siembra de `H(0)`, umbrales 30/60/100.
- `test_riesgo.py`, `test_analytical.py` — clasificación de riesgo y validación analítica.
- `test_weather_tools.py`, `test_notification_service.py` — servicios externos y alertas.
- `test_web.py` / portal runner — flujo end-to-end del panel.

### 🚦 Verificación estática
- `npm run typecheck` → `tsc --noEmit` (TypeScript estricto).
- `npm run lint` → ESLint / `next lint`.
- `npm test` → suite pytest del backend.

### 🧩 Git
Repositorio versionado (historiedas en `CHANGELOG.md`), con `.gitignore` que excluye
caches, suscripciones, `*.db`, `*.log` y `.env`.

---

<div align="center">

[Volver al README](README.md) · [Historial de cambios](CHANGELOG.md)

</div>