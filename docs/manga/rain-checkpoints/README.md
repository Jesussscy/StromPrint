# Lluvia y zonas críticas — 2026-09-20

Checkpoint inicial: `baseline.txt`. Primera integración: `fcd76c7`.

## Implementación

- `MangaMap` vuelve a pasar los datos del dashboard al modelo v6.1. Antes descartaba todas sus props.
- La precipitación de la hora seleccionada controla las gotas; viento y dirección proceden del forzamiento horario cuando están disponibles. Una hora seca no genera lluvia por tener un nivel de inundación alto.
- Escenarios visuales artificiales: Normal 4, Alerta 18, Emergencia 45 y Crítico 90 mm/h; duración de 1–24 h. Estas intensidades son presets de demostración, no umbrales oficiales de riesgo. El deslizador temporal vuelve a la fuente del dashboard, incluida una predicción artificial generada por sus controles.
- Búsqueda sin distinción de tildes en las 20 zonas existentes y los cuatro lugares del modelo. Selección geográfica, ficha y enlace a la ubicación; se retiraron los números flotantes y las vistas Cementerio/Entrada. Vista desde arriba permanece centrada abajo.
- Agua sobre las calles alrededor de cada zona: extensión irregular, elevación visual, brillo y ondas. Se utiliza la columna de agua por zona del backend cuando existe. Los escenarios manuales usan un balance local exploratorio con precipitación, exposición y drenaje; avanzar/retroceder recalcula desde el inicio, sin acumulación por tiempo de render.

## Referencia de Blender

`rain_generator.blend` se abrió con `--disable-autoexec`; no se ejecutaron sus scripts. `inspect_rain_reference.py` deja el SHA-256 y los nodos/parámetros en `reference.json`. El perfil que utiliza el render está en `public/models/manga/rain-reference.json`.

Se adaptaron caída y reciclaje de gotas, relación longitud/radio y cuatro partículas de salpicadura con trayectoria parabólica. Los materiales de vidrio del original tienen IOR 1.33; el navegador aproxima sus brillos con shaders transparentes. **No es una reproducción idéntica del render de Blender ni una exportación de Geometry Nodes en ejecución**: sus simulaciones/materiales no se reproducen directamente al cargar un GLB en Three.js. El archivo fuente permanece intacto.

## Topografía y lugares

El modelo v6.1 tiene el suelo visual a cota cero. El dataset previo contiene SRTM de 30 m, datum EGM96, con alturas de −5.749 a 20.825 m: no permite certificar que cada calle está entre 1 y 9 m sobre el mar. Los parámetros relativos de las zonas son los ya existentes en la aplicación; no se han convertido en mediciones verificadas. El agua se presenta como estimación, pendiente de relieve y drenaje calibrados. No se suman cotas EGM96 y mareas MSL.

Fuentes consultadas:

- [Cartografía IGAC](https://www.igac.gov.co/node/5575): catálogo oficial de modelos de elevación. No se obtuvo en esta entrega un levantamiento de detalle de las 20 zonas.
- [Comisión Fílmica de Cartagena](https://cartagenacomisionfilmica.com/es/locaciones/manga-puente-roman): Casa Román, Club de Pesca y patrimonio de Manga.
- [Club de Pesca Marina](https://www.clubdepescamarina.com/es/cartagena): ubicación publicada en el Fuerte San Sebastián del Pastelillo, Manga.
- Se intentó consultar Google Maps; el lector web no pudo acceder a su ficha. Los enlaces a Maps de las zonas usan las coordenadas existentes, **sin afirmar que fueron verificadas individualmente en Google Maps**. Los cuatro lugares conservan la fuente OpenStreetMap de su geometría.

## Verificación

- `npm run check`: TypeScript y ESLint, sin errores.
- `node scripts/manga/validate_weather.cjs`: cuatro intensidades, datos inválidos/secos, fracciones de hora, drenaje y retroceso reproducible.
- `node scripts/manga/validate_timeline.cjs`: eventos del slider, cobertura de lluvia localizada y balance del solver anterior.
- `npm run build`: compilación de producción y siete páginas generadas.
- Navegador local: escenario Crítico 90 mm/h; búsqueda Dandy; 24.6 cm estimados después de dos horas artificiales; al pulsar ArrowRight en la línea temporal vuelve a Open-Meteo, +1 h y 6.8 mm/h. Revisados escritorio 1440×900 y visor estrecho de 634 px. Sin errores de shaders; advertencias existentes de Recharts sobre defaultProps.
- `critical-desktop.png`: checkpoint visual del escenario artificial.
