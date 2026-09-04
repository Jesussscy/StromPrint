# Changelog

Todas las versiones notables de StormPrint.

## [3.9.0] — Estabilidad de producción y pulido de interfaz

### Estabilidad crítica de producción (Vercel)
- **Fix de arranque del frontend (Cesium)**: `cesium` -> `@cesium/engine` -> `@spz-loader/core`
  traía la WASM de Gaussian splatting embebida como template literal con escapes octales
  (`\00`), lo que provocaba `SyntaxError: Octal escape sequences are not allowed in
  template strings` y rompía **todas** las páginas con mapa 3D (`/` y `/ciencia`). Se fuerza
  `@spz-loader/core` a `0.3.0` (embebe en base64, a prueba de codegen de SWC) vía
  `overrides` en `package.json`. Verificado: los 29 chunks de producción analizan sin error.
- `security.py`: la falta de `STORMPRINT_API_KEY` ya no tumba la API al importar; los
  endpoints protegidos responden 503 claro («API no configurada») y `/health`, `/predecir`
  y `/predicciones` siguen vivos.
- CORS robusto: `get_allowed_origins()` acepta automáticamente `VERCEL_URL` además de
  `STORMPRINT_ALLOWED_ORIGINS`, evitando que un dominio/alias distinto quede bloqueado.
- `database.py`: soporte opcional de `DATABASE_URL` (Postgres/Neon/Turso con `+asyncpg`)
  para historial y predicciones **persistentes**, con fallback a SQLite (efímero) si no se
  configura. Migraciones agnósticas de dialecto y timestamp UTC sin deprecation.
- Persistencia de caches y notificaciones **atómica** (`api/storage.py`: temp + rename) para
  evitar corrupción de JSON con invocaciones serverless concurrentes.
- `api.ts`: eliminada función muerta `riskIcon` (devolvía emojis).

### Robustez y UX de errores (frontend)
- `page.tsx`: la predicción inicial ya no queda en «Cargando…» para siempre — banner de error
  con botón «Reintentar» si el backend falla.
- `CesiumMap.tsx`: el `import("cesium")` está dentro del try/catch y el fallo muestra un estado
  de error con botón de reinicio automático (ya no se cuelga en «Cargando modelo 3D…»).
- `Footer.tsx`: el fallo del healthcheck marca el sistema como «Degradado» en lugar de
  «Verificando…» para siempre; año del copyright estable fijado en montaje.

### Correcciones de hidratación (SSR vs cliente)
- `FreshnessBadge.tsx` y `AlertDrawer.tsx`: `Date.now()` ya no se usa en el inicializador de
  estado (se inicializa en `useEffect`), eliminando errores de hidratación.
- `Footer.tsx`: `currentYear` calculado en montaje, no en render.

### Interacción móvil y navegación
- `Navbar` reescrito con `next/navigation` (`useRouter`/`usePathname`): enlaces a rutas
  completas (`/ciencia`, `/alertas`), anclas (`/#panel-vivo`) con desplazamiento suave y
  sincronización de pestaña activa por ruta.
- `MobileBottomNav` con `usePathname`/`useRouter`, sincronización activa por ruta y scroll
  de anclas entre páginas; feedback táctil (`active:scale-95`, `touch-manipulation`).
- `app/template.tsx`: transición de página (fade + slide) en todas las pestañas con framer-motion.
- Footer simplificado a 3 columnas (Marca, Navegación, Estado) sin pestañas legales/políticas.
- Objetivos táctiles de 44px (botones, checkboxes, slider) y estilos táctiles en todo el Dashboard.

### Apartado de alertas
- Hero con insignia «Monitoreo continuo 24/7» animada y patrón de puntos.
- Métricas con iconos (campana, actividad, mapa, reloj) por tarjeta.
- Historial: cabecera con escudo + botón «Exportar CSV» con icono de descarga, filtros con
  feedback de color táctil y búsqueda con lupa.
- Tarjetas de alerta con mejor jerarquía: badge de nivel, hora, barra de nivel de agua animada
  e indicadores email/webhook con iconos.

### Pronóstico meteorológico («mañana será lluvioso/soleado»)
- `WeatherStation` rediseñado: iconografía meteorológica grande, frase narrativa natural por día
  («mañana será lluvioso con máxima de 28°C y 85% de probabilidad de lluvia»), probabilidad de
  lluvia y acumulado en mm, barra de lluvia animada y aviso contextual de marea/pleamar.

### Fix: mapa en blanco en Vercel
- La CSP de `vercel.json` no permitía los hosts de tiles de imagery (OpenStreetMap y Carto),
  por lo que el globo de Cesium quedaba en blanco (ni mapa normal ni capa de calor, que se
  dibuja sobre él). Se sincronizó la CSP con `next.config.js` añadiendo a `img-src` y
  `connect-src` los dominios de tiles y terreno. Detalle en «Modelo 3D» del README.

## [3.0.0] — Crisis Climática del Caribe

Se completó el plan de mejora «StormPrint 3.0» (10 lotes). Resumen por lote:

### Lote 1 · Rendimiento
- Fuentes self-hosted con `next/font` (Exo_2 / Inter / JetBrains_Mono), sin `@import` remoto.
- `dedupeFetch` para `/api/v1/predecir` (una sola petición en vuelo).
- `CesiumMap` y visor 3D bajo demanda (`LazyMount` + `dynamic` + `label`).
- `nivelColorCached`, `React.memo`, bail-outs de `prefers-reduced-motion`.

### Lote 2 · Accesibilidad
- `CommandCenter` como `role="dialog"` + `aria-modal`, cierre con ESC.
- Focus trap en el cajón de alertas, `aria-pressed` en controles de toggle.
- Skip links, `:focus-visible` global, `aria-label` en navegación.

### Lote 3 · Estados de carga / vacío / error
- Componentes `Skeleton` y `FreshnessBadge` (antigüedad de datos, origen real/simulado).
- WeatherStation, HistoryPanel y MetricsPanel con skeleton, estado vacío y
  reintento explícito; se eliminó la curva «histórico» fabricada del gráfico.

### Lote 4 · Integridad de datos
- `storm_width` ahora alimenta `rain_duration_h` en `/api/v1/predict` (antes se ignoraba).
- `run_simulation` respeta el argumento `mean_sea_level` (bug corregido).
- `ValidationChart` consume `/api/v1/comparacion` real (RMSE, error máx. y promedio).
- Eliminados claims de precisión sin respaldo («98.7%»).
- Paleta de riesgo corregida en backend y frontend; umbrales unificados 30/60/100.
- Fechas/horas en `America/Bogota` (`app/lib/datetime.ts`).

### Lote 5 · Nuevas funcionalidades
- `/alertas`: Centro de Alertas con métricas, filtros, export CSV y suscripción por email.
- `PeakAlert` (aviso proactivo de pico) y `ScenarioComparator` (3 escenarios hipotéticos).
- Favoritos de zonas en `localStorage`; botón «Imprimir» y export JSON en Historial.
- Endpoints `POST /api/v1/notify/subscribe|unsubscribe` y `GET /api/v1/notify/status`.

### Lote 6 · Monitoreo y confiabilidad
- `GET /api/v1/health` ampliado: estado de DB, antigüedad de caches, uptime, versión.
- Timeout + abort en el cliente HTTP (`app/lib/api.ts`, 25 s por defecto).
- Logging de requests lentos (>1500 ms).

### Lote 7 · Seguridad
- Auth por API key en `/weather` y `/comparacion` (se suma a `/predict` y `/history`).
- Middleware Edge: 404 para `notifications.json`, `subscriptions.json`, `*.db`, `*.log`, `.env`.
- `.gitignore` ampliado (suscripciones, caches, `*.tsbuildinfo`).

### Lote 8 · Infraestructura y despliegue
- Versión `3.0.0`; scripts `npm run backend|test|typecheck|check`.
- `vercel.json`: `cleanUrls`, `trailingSlash: false` y cache inmutable para
  `/_next/static` y `/cesium`.

### Lote 9 · Calidad
- Suite `pytest` (35 tests): umbrales de riesgo, motor físico, notificaciones y
  suscripciones, comparación analítica vs numérica, autenticación de la API.
- ESLint y `tsc --noEmit` sin errores.

### Lote 10 · Release
- CHANGELOG, README actualizado (arquitectura, API, seguridad, tests).

## [3.1.0] — Visor 3D Cyber-Hydro

Plan «1000 mejoras del visor» (8 tandas M1–M8) sobre el panel en vivo:

### M1 · Sanidad y base
- Eliminados `Canvas3D`, `CityModel` y `LeafletMap` (código muerto: ningún layout los
  montaba) y el `public/models/Map.glb` huérfano; desinstalado `leaflet`/`react-leaflet`.
- CSP actualizado para el visor: `server.arcgisonline.com`, `elevation3d.arcgis.com`
  y `*.cartocdn.com` en `vercel.json`, `api/security.py` y `next.config.js`.

### M2 · Rendimiento
- `requestRenderMode` + `maximumRenderTimeChange` + `useBrowserRecommendedResolution`.
- Reutilización de propiedades Cesium (`.setValue`) — sin alocar por frame; `resize`
  con `requestRender`; throttle a 1 Hz cuando la pestaña está oculta.
- Bug corregido: el toggle «Calor» no re-ejecutaba el animador.

### M3 · Agua estilo Cyber-Hydro
- Superficie de agua con textura procedural (ripples + caustics), tinte con lerp hacia
  el color de riesgo y «heat shimmer» según el nivel; HUD con «≈ X m de columna».

### M4 · Capa científica de calor
- Heatmap gaussiano interpolado de las 20 zonas (peso por riesgo × población), banda de
  colores con contornos, regeneración perezosa por bucket de 5 cm. Se difirieron
  «isócronas» (no hay fuente de tiempo-a-inundación, no se fabrican datos).

### M5 · Controles, cámara y HUD
- Base mapas ArcGIS con fallback OSM/CARTO; toggles de capas; atajos R/2/3/C/Z/A/L;
  brújula en vivo; calibrador de umbrales 30/60/100; contador de zonas en alerta.

### M6 · Zonas y accesibilidad
- Tooltip de hover en vivo, anillo de selección con pulso, navegación de zonas con flechas,
  `prefers-reduced-motion` en vuelos de cámara, `role="region"` + `aria-live`.

### M7 · Storytelling e integración
- Luz solar por hora real de Cartagena (UTC-5) con toggle «Sol» en capas.
- Tour cinematográfico de bienvenida, captura PNG del visor, overlay FPS (solo dev).
- El timeline controla el 3D; clic en el gráfico de pronóstico reproduce esa hora en el
  visor; URL compartible `?hora=NN` y `?zona=ID`; «Simular tormenta» acelera los ripples
  y oscurece el escenario.

### M8 · Pulido y cierre
- Paleta de riesgo ya unificada entre `zonasManga`/`riesgo`/`api` (verificado, sin cambios).
- QA manual + validación final: `tsc`, `next lint`, `next build` y `pytest` (35 tests).

### M9 · Datos y análisis en el visor
- HUD con reloj de Cartagena (America/Bogota) y chips de datos reales del escenario y del
  resumen meteorológico: marea, lluvia, viento y temperatura. Toda la información parte de
  los datos ya expuestos por el backend, sin fabricar valores intermedios.
- Regla de medición de distancias sobre el terreno (`M`): clics para definir vértices,
  doble clic/Escape para terminar, resultado en m/km; aviso temporal de estado en pantalla.
- Robustez: limpieza correcta del handler de hover (evita doble listener al remontar),
  animación de agua y anillo de selección totalmente estáticos con `prefers-reduced-motion`,
  tour de bienvenida cancelable con cualquier interacción del usuario.
- Card de zona seleccionada adaptada a móvil (ancho completo con scroll interno) y cierre
  sincronizado con el estado del Dashboard.

### M10 · Precisión meteorológica extrema
- Condiciones actuales con el bloque `current` de Open-Meteo (temperatura y lluvia del
  instante exacto) en lugar de escoger la hora más cercana del pronóstico horario.
- Estado meteorológico clasificado con `weather_code` WMO (distingue llovizna, chubasco,
  tormenta, niebla), con precedencia sobre la heurística de mm/h + nubosidad.
- Humedad del suelo real de Open-Meteo (`soil_moisture`) con fallback a la heurística.
- Racha de días lluviosos y humedad del suelo alimentados por lluvia real de los últimos
  7 días (`past_days`) en lugar de solo pronóstico futuro.
- Nuevas métricas expuestas en `/api/v1/weather` y en la estación meteorológica: sensación
  térmica, punto de rocío, presión a nivel del mar, ráfagas y probabilidad de lluvia por día.

## [2.7.0] — Predictor en español
- Predicción pública `/api/v1/predecir` con narrativa y recomendaciones en español.
- Panel en vivo con tendencia, factor dominante y fuente de datos respaldada en cache.

## [2.0.0] — Simulador ciberfísico
- Motor numérico de segundo orden (`solve_ivp`), historial en SQLite, visor 3D.