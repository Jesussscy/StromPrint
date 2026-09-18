<div align="center">

# 🌊 StormPrint

**«La huella que deja cada tormenta en el territorio»**

Simulación ciberfísica del riesgo de inundación en el barrio **Manga, Cartagena de Indias**.

[version_badge]: https://img.shields.io/badge/StormPrint_3.11.0-00E5FF?style=for-the-badge&logo=waves&logoColor=black
[status_badge]: https://img.shields.io/badge/Panel_en_vivo-ACTIVO-22c55e?style=for-the-badge&logo=activity&logoColor=white
[tests_badge]: https://img.shields.io/badge/tests-45_passed-22c55e?style=for-the-badge&logo=pytest&logoColor=white

![version][version_badge] ![status][status_badge] ![tests][tests_badge]

![vercel]: https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white
![next]: https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
![react]: https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black
![ts]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
![tailwind]: https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=black
![framer]: https://img.shields.io/badge/framer--motion-0055FF?style=for-the-badge&logo=framer&logoColor=white

![python]: https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white
![fastapi]: https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white
![pydantic]: https://img.shields.io/badge/Pydantic-EA5F57?style=for-the-badge&logo=pydantic&logoColor=white
![sqlalchemy]: https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white
![sqlite]: https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white
![scipy]: https://img.shields.io/badge/SciPy-8CAAE6?style=for-the-badge&logo=scipy&logoColor=black

![three]: https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white
![recharts]: https://img.shields.io/badge/Recharts-coral?style=for-the-badge&logo=recharts&logoColor=white
![pwa]: https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white

![vercel][vercel] ![next][next] ![react][react] ![ts][ts] ![tailwind][tailwind] ![framer][framer]
![python][python] ![fastapi][fastapi] ![pydantic][pydantic] ![sqlalchemy][sqlalchemy] ![sqlite][sqlite] ![scipy][scipy]
![three][three] ![recharts][recharts] ![pwa][pwa]

</div>

---

## ✨ ¿Qué es?

Un **sistema de alerta temprana de inundaciones** que combina un modelo físico
(de EDOs de segundo orden) con datos meteorológicos y de marea **reales** de
Open-Meteo, y lo visualiza en un **visor 3D** del barrio Manga.

- 🔴 **Predictivo** — resuelve el nivel de agua `H(t)` hora a hora (hasta 168 h de pronóstico).
- 🗺️ **Geoespacial** — 20 zonas críticas simuladas individualmente y mapeadas sobre Cartagena.
- 📡 **En vivo** — `polling` de `/api/v1/water-state` para animar el agua en tiempo real.
- 📱 **PWA** — instalable en el móvil, con layout «app-like» optimizado para el pulgar.
- 🔐 **Seguro** — API keys, rate limiting, validación estricta y cabeceras OWASP.

> 📚 **Stack completo, versiones y dónde vive cada tecnología:** [`TECNOLOGIAS.md`](TECNOLOGIAS.md).

---

## 🧱 Arquitectura

```
StormPrint/
├── api/                    FastAPI serverless (Python 3.12)
│   ├── index.py            Entrypoint, rutas, validación Pydantic V2
│   ├── database.py         Persistencia: SQLite async (default) o Postgres/Neon vía DATABASE_URL
│   ├── security.py         Auth por API key, rate limiting, headers, CORS
│   ├── physics_engine.py   EDO de 2do orden (SciPy solve_ivp, RK45) + marea real calibrada
│   ├── weather_service.py  Open-Meteo + cache resbaloso (vivo→histórico→promedio)
│   ├── tide_service.py     Marea Open-Meteo Marine con fallback analítico
│   ├── storage.py          Escritura JSON atómica (caches/notificaciones, serverless-safe)
│   └── notification_service.py  Alertas multi-canal + suscripciones por email
├── app/                    Next.js 14 App Router (React 18 + TS)
│   ├── layout.tsx          Metadatos + PWA (manifest, apple-touch-icon)
│   ├── page.tsx            Dashboard «Panel en vivo»
│   ├── alertas/page.tsx    Centro de Alertas + suscripción
│   ├── ciencia/page.tsx    Validación analítica vs numérica (RK4 en el navegador)
│   ├── middleware.ts       Bloqueo Edge de archivos sensibles (404)
│   ├── globals.css         Tema Cyber-Hydro Glassmorphism
│   ├── lib/api.ts          Cliente HTTP tipado (timeout, dedupe, polling)
│   └── components/         Navbar, Footer, MobileBottomNav, MangaMap (visor 3D local),
│                           MangaMap, DashboardMovil, WeatherStation,
│                           ZonaFlood3D, ForecastDayCard, SummaryDashboard, …
├── tests/                  Suite pytest (umbrales, motor, notificaciones, API)
├── vercel.json             Unifica build Next.js + función Python serverless
├── requirements.txt        Backend
├── package.json            Frontend
└── public/                 Assets, PWA icons, /models/manga (GLB y datos GIS)
```

---

## 🧪 Modelo físico

El nivel de acumulación de agua `H(t)` se modela como un **oscilador
amortiguado de segundo orden**:

```
m·H''(t) + c(t)·H'(t) + k(t)·H(t) = F_lluvia(t) + F_marea(t) + F_viento(t)
```

| Símbolo | Significado |
|---|---|
| `m` | Inercia de la masa hídrica |
| `c(t)` | Amortiguamiento = capacidad de drenaje, *saturado* por racha de días lluviosos |
| `k(t)` | Rigidez del terreno (absorción / humedad del suelo) |
| `F_lluvia(t)` | Pulso gaussiano de una tormenta convectiva tropical |
| `F_marea(t)` | Marea real horaria Open-Meteo Marine, calibrada (`TIDE_SERIES_SCALE`) |
| `F_viento(t)` | Empuje de la marea por viento del sur/oeste (mar de levante) |

- ✅ Se resuelve numéricamente con **`scipy.integrate.solve_ivp` (Runge-Kutta 45)** → `api/physics_engine.py`.
- 🎯 `H(0)` se **siembra** en el equilibrio de la marea actual: `records[0]` = nivel *ahora*.
- 🕒 Todo el pipeline corre en **America/Bogota** (tzdata); `/predecir` devuelve `hora_inicio_h`.
- 🗺️ **20 zonas críticas** resuelven su propia `H(t)` con 6 parámetros físicos cada una → `run_zones_simulation`.

**Umbrales de riesgo:** `< 30 cm` Normal · `30–59` Alerta · `60–99` Emergencia · `≥ 100` Crítico.

> 🧮 Validación cruzada: en `/ciencia`, la solución analítica (convolución de
> Duhamel) se contrasta con la numérica paso a paso (RK4) **100% en el navegador**.

---

## 🚀 Desarrollo local

```bash
# Backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install pytest                 # solo para correr los tests
cp .env.example .env               # completar STORMPRINT_API_KEY

npm run backend                    # uvicorn api.index:app --reload --port 8000
npm test                           # python -m pytest tests -q
npm run typecheck                  # tsc --noEmit
npm run lint                       # next lint

# Frontend (otra terminal)
npm install
npm run dev
```

> Durante el desarrollo, `next.config.js` reenvía `/api/v1/*` → `http://localhost:8000`.

---

## 🗺️ Panel en Vivo · Modelo 3D

El visor **MangaMap.tsx** usa Three.js / React Three Fiber y el modelo local creado en **Blender 5.2.2**. Representa solo Manga, recortado con un polígono OSM contrastado con cartografía pública.

- Modelo editable: `models/manga/MANGA_STORMPRINT_FINAL.blend`.
- Web: `public/models/manga/manga.glb` y datos GIS reproducibles.
- Agua exploratoria por celdas de terreno, lluvia horaria original de API y escenarios manuales independientes.
- Selección de edificios y zonas, capas, vista superior, controles táctiles y reproducción temporal.
- La antigua vista por zona es ahora un resumen; no crea otra ciudad genérica.
- [Fuentes, reproducción, pruebas y límites del modelo](docs/manga/README.md).
- [Checkpoints de esta implementación](docs/manga/CHECKPOINT.md).

No es una simulación hidráulica calibrada. La topografía SRTM y las alturas estimadas no resuelven bordillos ni cada charco.

---

## 🔌 API

```
POST /api/v1/predecir        Predicción pública 0–168h (Open-Meteo o manual)
POST /api/v1/predict         Simulación legacy manual (requiere API key)
GET  /api/v1/health          Healthcheck ampliado (DB, caches, uptime)
GET  /api/v1/weather         Clima en vivo (requiere API key)
GET  /api/v1/history         Historial de simulaciones (requiere API key)
GET  /api/v1/predicciones    Últimas predicciones guardadas
GET  /api/v1/notifications   Historial de alertas + métricas
POST /api/v1/notify/subscribe|unsubscribe   Suscripción por email
GET  /api/v1/notify/status   Estado del canal de alertas
```

Campos clave de `/predecir`: `hora_inicio_h`, `nivel_actual_cm`, `fuente_meteo`,
`proxima_pleamar` y los `factores_dominantes` (lluvia/marea/viento).

---

## 🔐 Seguridad (OWASP Top 10)

- **Auth** — header `X-StormPrint-Key`, comparación en tiempo constante (SHA-256 salado).
- **Rate limiting** — `slowapi`: 10/min `/predict`; 30/min públicos; 10/min suscripciones.
- **Validación** — Pydantic V2 con límites físicos estrictos en cada campo.
- **Errores sanitizados** — sin trazas internas en producción.
- **Headers** — CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **CORS** — lista blanca explícita (`STORMPRINT_ALLOWED_ORIGINS`).
- **Seguridad Edge** — `app/middleware.ts` responde `404` a `*.db`, `*.log`, `.env`, caches, suscripciones.
- **Credenciales admin** — PBKDF2-HMAC-SHA256 (100k iteraciones), salt por usuario.

---

## ☁️ Despliegue en Vercel

1. Configura las variables de `.env.example` (críticas: `STORMPRINT_API_KEY`,
   `NEXT_PUBLIC_STORMPRINT_API_KEY`, `STORMPRINT_KEY_SALT`, `STORMPRINT_ALLOWED_ORIGINS`).
2. `vercel --prod` — `vercel.json` unifica Next.js + la función Python (`@vercel/python`).
3. **Persistencia** — sin `DATABASE_URL` usa SQLite efímero en `/tmp` (la app se degrada
   **sin romperse**: caches/notificaciones usan escritura atómica). Para historial y
   alertas persistentes configura Postgres/Neon/Turso vía `DATABASE_URL`.

---

<div align="center">

**Hecho con 🌧️ para Cartagena de Indias** · [Tecnologías](TECNOLOGIAS.md) · [Cambios](CHANGELOG.md)

</div>