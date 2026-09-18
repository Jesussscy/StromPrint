# Manga en StormPrint — entrega local

El apartado del mapa usa `MangaMap`: Three.js, React Three Fiber y un GLB local generado en **Blender 5.2.2 LTS**, versión realmente ejecutada. Se conserva el dashboard, su línea temporal, selección y paneles. No se creó ningún commit ni se publicó el proyecto.

## Archivos

- `models/manga/MANGA_STORMPRINT_FINAL.blend`: modelo editable con edificios individuales, metadatos, iluminación, cámara y demo de agua/lluvia.
- `public/models/manga/manga.glb`: checkpoint07, 27 mallas, 1.642.935 triángulos y 22.646.224 bytes. Draco y 15 texturas PNG se sirven localmente. Geometría decodificada para auditoría: 144.982.444 bytes; validación geográfica PASS.
- `public/models/manga/manga.json`: geometría GIS, IDs de edificios y malla de cálculo; no requiere servicios de mapas para abrir.
- `data/manga/raw`: respuestas originales OSM, comparación ArcGIS, SRTM y plano PEMP consultado.
- `data/manga/boundary.geojson`: máscara geográfica seleccionada.
- `data/manga/water-demo.json`: estados producidos con el mismo solver de la web para la demostración Blender.
- `scripts/manga`: descarga, preparación, generación Blender y verificaciones reproducibles.
- `CHECKPOINT.md`: continuidad del trabajo y pendientes. `geometry-validation.json` y `solver-validation.json`: evidencia ejecutada.

## Mejora visual y render local

El checkpoint07 incluye 2.109 objetos editables, 1.622 perfiles arquitectónicos, 378 frentes retranqueados, cubiertas inclinadas, persianas, galerías/barandas, 440 equipos de cubierta y 458 árboles inferidos. Los 265 árboles añadidos se sitúan en retiros libres próximos a calles; no representan un inventario real. Las calles y los andenes siguen los triángulos del terreno original. El visor permite buscar edificios, consultar procedencia de alturas y arquitectura, cambiar cuatro vistas, iluminación y capas.

Casa Román es una interpretación parcial de una fotografía histórica, no una réplica: faltan proporciones, orientación, ornamentos, jardín y estado actual verificados. Ver `architecture-references.md`. La simplificación de carpintería al 50% afecta solo la exportación web, no el modelo editable; no es un sistema LOD por distancia. Los contadores antiguos de ventanas/puertas en `realistic-build.json` describen la generación base sustituida: los resultados nuevos están en su sección `architecture`.

**No es una reconstrucción fotográfica.** La huella geográfica procede de OSM; ventanas, materiales, árboles y fachadas son aproximaciones. Las dos alturas visuales documentadas siguen siendo estimaciones por pisos. Para reconocer una casa como idéntica hacen falta fotos autorizadas, alturas y detalles verificados de esa casa. Ver `visual-sources.md`.

Reproducción, desde la raíz y usando Blender instalado localmente:

```powershell
python scripts/manga/prepare_visual_metadata.py
python scripts/manga/prepare_visual_geometry.py
python scripts/manga/prepare_architecture.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/manga/build_realistic.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/manga/compress_glb.py
python scripts/manga/externalize_textures.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/manga/decode_for_validation.py
python scripts/manga/validate_geometry.py
python scripts/manga/render_delivery.py
```

Las seis imágenes nuevas están en `models/manga/checkpoint07/stills`. La secuencia nueva reanudable está en `models/manga/checkpoint07/animation`; el video solo está terminado cuando existe el MP4 y el informe de codificación indica éxito. Para retomar una interrupción conservando las imágenes terminadas: `python scripts/manga/render_delivery.py --skip-stills`. No modificar el modelo ni el renderizador a mitad de secuencia: su manifiesto comprueba las huellas de ambos. La carpeta `renders` conserva material histórico, no la entrega actual.

La copia recuperable anterior es `models/manga/MANGA_CHECKPOINT06.blend`; también se conserva CHECKPOINT04. Ningún render requiere nube. El agua sigue siendo exploratoria y no una predicción individual validada. Reiniciar el servidor de producción después de generar nuevas texturas: Next inventaría los archivos públicos al arrancar y puede responder 404 a archivos creados después.

## Servidores locales

En una terminal PowerShell, desde la raíz del repositorio:

```powershell
$env:ENV='development'
python -m uvicorn api.index:app --host 127.0.0.1 --port 8000
```

En otra terminal:

```powershell
npm run dev -- --hostname 127.0.0.1
```

Abrir `http://127.0.0.1:3000/#panel-vivo`. Se dejó `.env.local` (ignorado por Git) con la clave **exclusiva de desarrollo** prevista por el backend. No usarla en producción. No requiere una clave de Cesium ni un servidor de tiles.

## Reproducir el modelo

Los datos descargados se reutilizan para que las corridas no dependan de cambios futuros de OSM. Python usa los paquetes de `scripts/manga/requirements.txt`; Blender usa su propio Python y no necesita esos paquetes.

```powershell
python scripts/manga/fetch_sources.py
python scripts/manga/prepare.py
node scripts/manga/validate.cjs
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python scripts/manga/build_blender.py -- --render-preview
python scripts/manga/validate_geometry.py
```

`--refresh` en la descarga consulta nuevamente OSM/ArcGIS. **No mezclar fuentes renovadas con muestras SRTM de otra grilla**: las consultas SRTM guardadas corresponden a este origen, límite y paso de 40 m. Para cambiar esos parámetros se requiere un directorio nuevo de caché y volver a verificar el modelo.

En Blender: abrir el `.blend`, vista de cámara con teclado numérico 0 y reproducir frames 1–240. Colecciones: Terreno, Edificios, Vias, Costa, Agua, Vegetacion, Iluminacion, Auxiliares. Cada edificio tiene su ID y método de altura. `CONTROLES_LEER_PROPIEDADES` documenta el escenario; cambiar esas propiedades no recalcula el agua automáticamente. Para recalcular, cambiar el escenario de `validate.cjs`, generar snapshots y volver a ejecutar el generador Blender. La lluvia es geometría animada decorativa y el agua usa shape keys; **no es Mantaflow ni se exporta la animación como simulación hidráulica glTF**. La web calcula y anima sus propias capas equivalentes.

## Geografía, perímetro y fuentes

**Solo Manga**, Cartagena de Indias, Colombia. Superficie del polígono en proyección local: 1.840.302 m². Incluye el sector portuario que el polígono del barrio contiene; no se añadieron barrios vecinos ni un globo. Los puentes, vías y edificios que cruzan el límite se intersectan con la máscara; no se continúa su geometría fuera de Manga. Se muestra únicamente una franja de condición de borde de hasta 20 m junto a costa cartografiada, sin batimetría.

1. **Límite elegido:** [OpenStreetMap way 1385212852](https://www.openstreetmap.org/way/1385212852), `place=neighbourhood`, nombre Manga, respuesta con IDs y versión en `osm-boundary.json`. Licencia [ODbL 1.0, © OpenStreetMap contributors](https://www.openstreetmap.org/copyright). También es la fuente de huellas, vías, parques y costa. Descargado 16/09/2026 COT / 17/09/2026 UTC. No se afirma cobertura catastral completa.
2. **Contraste vectorial:** [Barrios de Cartagena, ArcGIS](https://www.arcgis.com/home/item.html?id=b9c35e8a5a364634aacaae0fc4168030), capa `NOMBRE='MANGA'`, publicada por `dairotr`, actualización 2022. Coincidencia intersección/unión = **0,939867**. La capa no identifica procedencia oficial ni licencia específica, por lo que se usa como contraste, no como geometría redistribuida del modelo. Ambas capas tienen extensión y contorno general coincidentes; no son un mismo levantamiento ni resuelven igualmente muelles y bordes. El detalle costero de OSM se conserva como límite operativo reproducible. No se presenta esta elección como deslinde jurídico/catastral certificado.
3. **Referencia oficial visual:** [PEMP, cartografía de Cartagena](https://pemp.cartagena.gov.co/normativa/cartografia-193), plano **F-03-14 Barrio Manga Niveles de Intervención**, 09/09/2025, base IGAC 2017 y equipo PEMP 2024; escala de trabajo 1:3.000. Se descargó y renderizó para comprobar disposición urbana, costa y vecindades. Sus límites patrimoniales y coloreado de predios no son equivalentes al perímetro administrativo del barrio y no se usaron para ampliar/reducir arbitrariamente el modelo. Conservado como referencia, no convertido en una nueva licencia de redistribución.
4. **Relieve:** NASA/USGS SRTM v3, aproximadamente 30 m, levantamiento radar febrero de 2000, vía [Open Topo Data](https://www.opentopodata.org/datasets/srtm/). Consultas bilineales en nodos de una grilla de 40 m, guardadas completas. Datum vertical EGM96. SRTM registra superficie radar y puede incluir vegetación/edificios: **no es un DTM urbano de precisión**.

Se triangula con Delaunay restringida, conservando concavidades y huecos. Las pruebas verifican que los triángulos urbanos permanecen dentro del polígono (2 cm de tolerancia por redondeo). Cobertura de terreno >99,999 %; se omiten fragmentos de borde menores a 1 m².

### Alturas y transformaciones

- 1.622 huellas: **1.614 alturas estimadas a 6 m** porque falta el dato; **8 alturas derivadas de pisos OSM × 3 m**. Cero alturas medidas verificadas. No se inventaron fachadas reconocibles ni pisos medidos. Los materiales alternan tonos genéricos y no codifican una fachada real.
- Base de cada edificio: máxima cota interpolada en vértices de la huella, para no enterrarlo. No se han modelado cimentaciones reales.
- Anchos de calles estimados por clase OSM, explícitos en metadatos; no hay topografía de bordillos. La red de drenajes no está inventada.
- CRS de trabajo: AEQD elipsoidal WGS84, origen `lon=-75.5357, lat=10.41145`. PROJ completo en `metadata.json`. 1 unidad = 1 m. Blender `(E,N,H)`; glTF/Three `(E,H,-N)`. El norte se conserva.
- Los marcadores zonales antiguos usan aproximación métrica local, válida a esta escala para referencia, no para levantamiento. **Tres coordenadas del inventario existente quedan fuera de Manga**: se conservan en el panel pero no se dibujan ni se reubican ficticiamente. La interfaz avisa al enfocarlas.
- Cotas de celda del DEM: −5,749 a 20,825 m EGM96. Estos valores incluyen incertidumbre y posibles artefactos; no fueron achatados ni elevados silenciosamente. Se necesita topografía local para mejorar exactitud.

## Auditoría e integración de APIs

`api/physics_engine.py` resuelve una EDO agregada/zonal. Su `rain_intensity`, publicado como `lluvia_mm_h` por la respuesta antigua, proviene del pulso pluvial del motor y **no reproduce la serie horaria original**. Los niveles se mantienen como referencia independiente; nunca se suman como volumen, ni se convierten en profundidad de cada edificio.

Se agregó `forzamiento_espacial` a `/api/v1/predecir` con horas, fechas, lluvia original y viento mediante `api/spatial_forcing.py`. Proviene de `forecast.hourly.precipitation`, total horario en mm dividido por una hora. El inicio es la hora actual truncada en America/Bogota. Se conserva la diferencia entre cero y dato faltante mediante `precipitation_missing`; una serie incompleta bloquea el cálculo API del mapa y ofrece escenarios manuales. Una consulta de un punto de modelo meteorológico se aplica uniformemente sobre Manga; no representa observaciones por edificio. No se ha conectado una estación DAVIS en esta intervención.

Frecuencias existentes: forecast con caché 60 s; servicio meteorológico y mareas con caché 30 min; `water-state` con caché 60 s y consulta del dashboard cada 30 s. La fecha nueva es **fecha de consulta/ensamblado**, no hora de observación de una estación. El visor señala antigüedad. La precipitación de Open-Meteo es pronóstico/modelo, no una medición de cada charco. El modo manual interno no mezcla lluvia ni viento de API. Si se solicita una predicción manual al backend, no hay serie meteorológica original: el visor indica ausencia y permite su escenario propio.

Mareas: el backend utiliza Open-Meteo Marine y puede recurrir a una aproximación analítica. Su MSL no está alineado con EGM96: **el mapa no lo inyecta automáticamente**. La opción manual es una cota hipotética explícita EGM96 y solo intercambia agua con celdas cercanas a la costa OSM. El viento mueve lluvia visual; no hay dinámica atmosférica ni oleaje físico.

## Método del agua y límites

Modelo exploratorio conservativo de almacenamiento y difusión sobre **1.319 celdas recortadas de 40 m**. Estado `V_i` en m³, profundidad `h_i=V_i/A_i`, cota `z_i` y superficie hidráulica media `z_i+h_i`. Pasos fijos de 10 segundos en un Web Worker, independientes de los FPS. Los flujos por caras usan diferencia de superficie, ancho compartido, profundidad sobre el umbral del terreno y una conductancia de 3 m/s elegida para exploración. No resuelve momento, turbulencia ni ecuaciones completas de aguas someras.

En cada paso:

1. Lluvia `mm/h ÷ 3.600.000 × dt × área` se añade una sola vez.
2. Infiltración uniforme × fracción no edificada y drenaje uniforme retiran como máximo el agua disponible.
3. Si se habilita mar hipotético, intercambio con reservorio costero con escala temporal 600 s; el flujo entrante/saliente se contabiliza.
4. Flujos internos calculados simultáneamente; salidas totales limitadas al 45 % del volumen donante. Cada transferencia se resta y suma a las dos celdas, sin recortar después las profundidades.

Balance mostrado: `almacenado − (lluvia − pérdidas + intercambio_mar)`. La fracción edificada reduce la conducción y la infiltración: es una aproximación subcelda, **no paredes impermeables resueltas individualmente**. Toda la lluvia de cubiertas entra al balance como aporte de celda. Las vías son visibles pero no se les asignan canales ficticios. Acumulación y recesión siguen cotas, flujos y pérdidas de la grilla.

La capa visual representa **profundidad media por celda sobre su relieve**, no reconstruye la superficie libre subcelda ni cada bordillo. Gotas y ondulaciones son decorativas y no añaden volumen. Umbral visual de agua 3 mm (no modifica el estado calculado). Profundidades y edificios sin exageración vertical. El mar gráfico es una franja de contexto; no representa una cota marina medida.

Escenarios: lluvia intensa, suelo saturado, drenaje obstruido, marea hipotética y combinación extrema. Rangos de interfaz: lluvia 0–300 mm/h; duración 0–24 h; pérdidas 0–30 mm/h; cota marina −2 a 15 m; tiempo manual 0–24 h. El solver admite series API hasta 168 h. Valores fuera de rango producen error visible; no se recortan por razones estéticas. El avance usa segundos de reloj; el cálculo se cuantiza a 10 s. Al retroceder o cambiar parámetros se reinicia desde seco y recalcula; no se resta agua retrospectivamente.

## Validación y pendientes reales

- Compilación Next, TypeScript y lint ejecutados. Backend: 47 pruebas pasadas tras incorporar la serie espacial.
- Solver: sequedad, conservación, no negativos, dirección pendiente abajo, simetría, recesión, conexión marina, rangos y repetibilidad por saltos temporales. Ensayo extremo Manga de 24 h con 300 mm/h sin pérdidas. Se guardan resultados numéricos.
- Resolución: controles de lámina uniforme en grillas de 20/40/80 m, no un estudio de convergencia hidráulica calibrado de Manga. Falta topografía fina para hacerlo significativo.
- Blender 5.2.2 ejecutó generación, exportación y render. El checkpoint07 tiene 2.109 objetos y 27 mallas web; selección recupera el edificio original mediante su huella. Las cifras de ocho mallas corresponden al checkpoint04 histórico.
- Pruebas navegador en equipo i5-12500H, Intel Iris Xe / NVIDIA RTX 3050 Laptop disponibles. El navegador no identifica aquí cuál GPU seleccionó. Observaciones iniciales en vista escritorio: 137–144 FPS, 26–27 llamadas de dibujo, escenario 120 mm/h a 2 h calculado en 114 ms. Son mediciones locales, no garantía universal ni benchmark estadístico.
- Vista móvil comprobada a 390×844 y encuadre adaptado. Controles ≥44 px. No se afirma prueba sobre pantalla táctil física. DPR limitado a 1,5 y descenso a 1 tras rendimiento sostenido bajo; nunca cambia la grilla física. Se liberan worker, geometrías animadas y listeners del componente al desmontar.
- Precisión pendiente: levantamiento de terreno/DTM y datum vertical local, alturas verificadas, drenaje y calibración con eventos. El documento `C:/Users/males/OneDrive/Desktop/PROYECTO.docx` no existe en este equipo.
- Los contenidos explicativos heredados del sitio sobre sensores, cifras territoriales y modelo EDO no han sido una validación científica de esta entrega. No usar el resultado como certificación hidráulica ni ruta de evacuación validada.
- Cesium eliminado de dependencias, visor y configuración activa. **Carpeta `public/cesium` residual:** la revisión automática del entorno rechazó el borrado recursivo con “blocked by policy”; no se evadió. No hay importación ni petición del nuevo visor a esa carpeta.

Acta final: compilación de producción pasada; servidor local iniciado con `npm run start -- --hostname 127.0.0.1 --port 3000`. Para editar, detener ese servidor y usar `npm run dev`. El contraste de límites también está disponible en `boundary-comparison.svg` y `.json` (discrepancia máxima entre contornos: 158 m).
