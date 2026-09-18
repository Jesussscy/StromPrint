# Checkpoint Manga — 01 Auditoría
Fecha: 2026-09-16. No crear commits. Repositorio original limpio, HEAD 5c0e2b1.
Encargo completo: adjunto pasted-text.txt. Solo barrio Manga; ejecución local.
Blender ejecutado: C:/Program Files/Blender Foundation/Blender 5.2/blender.exe — 5.2.2 LTS.
Documento C:/Users/males/OneDrive/Desktop/PROYECTO.docx ausente; usar instrucciones adjuntas.
Hallazgos: CesiumMap en page y DashboardMovil; ZonaFlood3D y HeatmapView ilustrativos, no GIS. Motor backend EDO zonal, no hidráulica espacial. No sumar sus niveles como lluvia.
Fases pendientes:
- [ ] Verificar perímetro poligonal de Manga contra fuentes públicas y guardar datos/licencias.
- [ ] Terreno documentado, huellas/vías recortadas, generación reproducible Blender/GLB.
- [ ] Visor R3F común escritorio/móvil; selección, capas y adaptación API.
- [ ] Cálculo conservativo exploratorio de agua, lluvia visual independiente, tiempo reproducible.
- [ ] Retirar Cesium, verificar tipos/lint/build/pruebas, ejecutar backend y web en local.
- [ ] Inspección visual y acta final con limitaciones reales.
Continuación: leer este archivo y docs/manga; inspeccionar git diff antes de editar. No asumir que fases sin marcar están completas.

## Checkpoint 02 — Modelo generado e integrado
- Polígono OSM way 1385212852, 1,8403 km² AEQD. ArcGIS comparado IoU 0,939867. Plano oficial PEMP F-03-14 (2025) descargado e inspeccionado.
- Datos originales data/manga/raw. 1622 edificios recortados: 1614 alturas estimadas 6 m, 8 derivadas de pisos OSM.
- SRTM v3 30 m, malla 40 m, 1319 celdas. Cotas -5,749 a 20,825 m EGM96: incertidumbres sin corregir silenciosamente.
- Blender 5.2.2 ejecutado. models/manga/MANGA_STORMPRINT_FINAL.blend, public/models/manga/manga.glb y preview.png generados; render inspeccionado.
- Solver conservativo TS en worker. Validación pasada: balance, no negativos, pendiente, repetibilidad, drenaje, costa, extremos. Informe solver-validation.json.
- MangaMap integrado escritorio/móvil. ZonaFlood3D ahora resumen sin segundo modelo genérico.
- Tipos/lint pasaron; backend 45 pruebas pasadas. Retiro Cesium en marcha.
- BLOQUEO: aprobación automática rechazó borrar public/cesium (blocked by policy), incluso ruta absoluta explícita. No evadir ni afirmar borrada. Carpeta residual sin uso.
Pendiente: build posterior al retiro, inspección navegador/móvil, medición, docs finales y ejecución local. Ningún commit.

## Checkpoint 03 — Validación final (2026-09-16, noche COT)
- API auditada: lluvia_mm_h antigua es pulso derivado. Se añadió forzamiento_espacial con precipitación original Open-Meteo, fecha y faltantes. La escena usa exclusivamente esa lluvia en modo API; pruebas backend 47/47.
- HTTP /predecir verificado con el nuevo campo; evidencia api-validation.json. La meteorología no está medida por edificio.
- Triangulación restringida corrigió pequeños huecos. Terreno >99,999% máscara, 1622 edificios recortados; 8 mallas GLB y 1.876.512 bytes. geometry-validation.json.
- Último hash de manga.json: 82c665e7d8e8cb568aa1da1d981f20fe232d6b95783d719aaddd0ed4c3a96565.
- .blend reabierto en Blender 5.2.2: 1631 objetos, escala 1 m, 5 shape keys demo. Costa exterior 20 m. Render final generado.
- Navegador: selección de edificio verificada (altura estimada y profundidad), controles de escenarios y salto 2 h con balance, vista superior móvil 390x844 validada. Cámara estable y adaptación al aspecto corregidas.
- Medición observada escritorio: 137–144 FPS, 26–27 draw calls; cálculo manual 2 h 114 ms. No equivale a probar hardware táctil físico.
- docs/manga/README.md contiene reproducción, fuentes, límites y pendientes. Carpeta residual public/cesium sigue bloqueada por auto-review: no repetir ni evadir.
Pendiente de cierre: build final tras ajustes de cámara/DPR, mantener servidor local activo, restaurar tamaño navegador y actualizar acta. No commits.

## Checkpoint 04 — Entrega local
- Compilación final de producción: PASS, incluidos tipos y lint. Primera carga raíz 292 kB más visor/GLB diferidos.
- API espacial y solver verificados; backend 47 pruebas; modelo reabierto en Blender 5.2.2.
- Web final iniciada en http://127.0.0.1:3000; backend en http://127.0.0.1:8000. .env.local contiene configuración exclusiva de desarrollo, ignorada por Git.
- Navegador probado a 390×844: vista superior completa y cámara corregida. Tamaño del navegador restaurado al normal.
- Fuentes con hashes en data/manga/source-manifest.json; comparación de perímetros SVG/JSON en docs/manga.
- Sin commits. Entrega funcional EXPLORATORIA: faltan DTM fino, alturas verificadas, drenajes reales, datum mareográfico y calibración. PROYECTO.docx no está en este equipo. Eliminación residual public/cesium bloqueada por auto-review.
- Continuar leyendo README de esta carpeta, verificando diferencias y puertos. No renovar fuentes o cambiar grilla sin regenerar y validar las muestras GIS.

## Checkpoint 05 — Mejora visual en curso (16/09/2026, noche COT)
- Copia recuperable: models/manga/MANGA_CHECKPOINT04.blend y preview-checkpoint04.png. Sin commits; cambios previos preservados.
- Modelo detallado regenerado con Blender 5.2.2: 3.448 objetos editables, 193 árboles inferidos dentro de parques OSM, fachadas genéricas, texturas locales empaquetadas, andenes esquemáticos y zócalos que cierran huecos contra el terreno.
- scripts/manga/prepare_visual_geometry.py + build_realistic.py reproducen los detalles. El SHA256 de manga.json sigue siendo 82c665e7d8e8cb568aa1da1d981f20fe232d6b95783d719aaddd0ed4c3a96565. Solver, grilla, huellas y cotas originales intactos.
- Metadatos recuperados: 48 nombres, 32 calles, 11 números, 11 marquesinas. Dos alturas VISUALES estimadas con fuentes primarias: Holiday Inn 30 m (10 pisos IHG), Twins Bay 60 m (mínimo documental piso20 FNC). No se presentan como medidas ni fachadas verificadas. Ver visual-sources.md y visual-overrides.json.
- Visor actualizado con búsqueda, selección/foco, vistas general/costa/urbana/superior, luz día/atardecer y vegetación. Primer QA escritorio cargó correctamente; faltan QA completo/móvil y build final.
- Puerto3001 dev aislado usa .next-visor-preview; 3000 conserva producción anterior; 8000 backend existente. No asumir que 3000 muestra cambios TS hasta recompilar/reiniciar.
- render_local.py ya ejecutó cinco previews Eevee y prueba Cycles OPTIX en RTX3050. Tras revisar, se corrigieron exposición, encuadre general y huecos bajo edificios. Esas previews viejas no son la entrega final.
- EN CURSO: renders finales Cycles 1600x900 y compresión GLB local Draco. Revisar docs/manga/render-stills*.log, compress*.log y reportes en models/manga/renders antes de repetir.
- PENDIENTE: video real15s/360frames, inspección final imágenes, validar GLB comprimido, pruebas/build, QA web y cierre documentación. Ninguna fachada particular está verificada con fotos; no prometer réplica exacta de cada vivienda.

## Checkpoint 06 — Base técnica validada; calidad visual NO aceptada (17/09/2026)

- El usuario revisó los diseños y rechazó su simplicidad y falta de parecido con las casas reales. Solicita TODO Manga con alta calidad comparable visualmente a Google Earth/Maps. No cerrar el objetivo como conseguido ni confundir más ventanas procedurales con fidelidad arquitectónica.
- GLB final de esta base: 9.756.064 bytes, 24 mallas, 442.270 triángulos; decodificación Blender y validate_geometry.py PASS. Texturas PNG externas locales resuelven el fallo de carga de imágenes embebidas. GIS original conserva su SHA256.
- QA navegador: búsqueda Twins Bay/Holiday Inn, fichas con alturas visuales estimadas 60/30 m y advertencia de fachada aproximada; modo día; superior móvil 390×844; escenario manual a 300 s almacenó 17.709 m³, error 5,6e-9 m³; vegetación conmutable. Tamaño normal restaurado. No equivale a prueba en teléfono físico.
- Backend: 47 pruebas PASS nuevamente. Compilación de producción previa PASS sin cambios posteriores TS. Servidores reiniciados localmente en 3000 y 8000; verificar procesos al retomar, no asumir que siguen activos tras interrupciones.
- Cinco imágenes Cycles en models/manga/renders/stills. La animación vieja es solo evidencia de la maqueta, NO entrega visual aceptada. Se reanudó desde 68 y se observó hasta 183/360; consultar render-resume.log y manifiesto antes de retomar. No afirmar video terminado sin verificar MP4 e informe.
- render_delivery.py acepta --skip-stills para preservar imágenes terminadas. No cambiar render_local.py ni .blend durante una secuencia reanudable.
- NUEVA PRIORIDAD: reconstrucción individual basada en referencias para TODO Manga, con prueba de calidad acotada antes de extenderla. Preservar mapa y simulación. No extraer modelos/texturas de Google ni contratar servicios sin autorización específica.
- Referencia localizada y vista: https://commons.wikimedia.org/wiki/File:CasaRoman.jpg, foto Sergio Londoño de 2004, CC BY-SA 3.0, 448×336. Muestra parte de una fachada con pórtico, columnas, arcos, coronación ornamental y jardín. Es histórica, parcial y de baja resolución: no prueba estado actual, dimensiones ni fachadas ocultas. No se ha usado como textura ni se ha construido una réplica con ella.
- Fuente arquitectónica adicional consultada: https://continuadores.com/casa-roman-cartagena-colombia/ (Rafael López Guzmán, 2020). Casa Román ya tiene ID osm-way-109811287-0. Su huella rectangular y altura derivada de 3 m no son un levantamiento del pórtico ni la cubierta.
- FALTA para el parecido casa a casa: cobertura fotográfica/levantamiento utilizable, correspondencia con IDs, alturas y techos verificables. Se pidió al usuario referencia de un sector como prueba de calidad; aclaró que el alcance final es TODO Manga. No reducir el alcance a un único hito ni inventar identidad de las viviendas restantes.
- Sin commits. Mantener backups y cambios previos. No borrar public/cesium.

## Checkpoint 07A — Auditoría y comienzo de arquitectura diferenciada

- Encargo aplicado: adjunto 6aeeade6-8717-425c-b500-0424e50da2f0/pasted-text.txt. Alcance TODO Manga, primera fase con evidencia renderizada; plan en PLAN_CALIDAD.md.
- Backup recuperable models/manga/MANGA_CHECKPOINT06.blend, SHA256 4ce21409153ed381cbb231daccf3ef7e6adb10ee0c0964c72caddfd5ab9acd9a. Reabierto: Blender 5.2.2, 3.448 objetos, escala 1 m, ocho colecciones requeridas presentes.
- Problemas identificados: distribución única de ventanas, cubiertas planas, relieve casi nulo de fachada y textura de concreto con periodicidad visible. Primera fase corrige estos puntos sin cambiar el archivo GIS ni solver.
- Referencias consultadas: Comisión Fílmica Manga/Puente Román (mezcla de arquitectura, sin licencia de imágenes asumida); sitio del Club Náutico (marina/terraza, sin licencia de imágenes asumida); fotografía CasaRoman.jpg de Sergio Londoño (2004, CC BY-SA 3.0) revisada anteriormente.
- Siguiente: perfiles por edificio, reconstrucción parcial documentada de Casa Román, materiales mejorados, exportación y renders nuevos en carpeta checkpoint07. No reutilizar secuencia incompleta del checkpoint06.

## Checkpoint 07B — Arquitectura implementada, QA final en curso

- Nuevos scripts prepare_architecture.py y architecture_blender.py: 1.622 perfiles, 378 frentes retranqueados, cubiertas inclinadas recortadas, persianas, galerías/barandas y 440 equipos de cubierta. Casa Román tiene pórtico/arcos/remates interpretados de referencia parcial; dimensiones y altura visual 6,4 m aproximadas, GIS original intacto.
- architecture-metadata.json añade procedencia y limitaciones por edificio; MangaMap muestra esas fichas y usa cámara urbana sobre Calle 26. Tipos/lint y build PASS. Backend 47 PASS y once controles del solver PASS.
- Previews inspeccionadas en models/manga/checkpoint07/preview. Hay más diferenciación, pero siguen siendo estilizadas y faltan levantamientos individuales; no cumple aún réplica exacta de todo Manga. Registrar cambios de calidad sin confundirlos con aprobación del usuario.
- Optimización: primera exportación descartada de 679 MB; segunda 183 MB sin comprimir. compress_glb.py simplifica carpinterías/persianas al 50% solo en web, conservando .blend; Draco 20 bits de posición. Prueba de compresión anterior a nuevos árboles: 21,3 MB. Falta validar geometría final y medir navegador.
- prepare_visual_geometry.py amplió vegetación a 458 árboles, incluyendo 265 en retiros libres junto a calles: posiciones inferidas con separación de edificios/calzada, no arbolado levantado. Generador final en ejecución al retomar; comprobar proceso y realistic-build.json.
- Pendiente: completar build con vegetación nueva, comprimir/externalizar/decodificar/validar, renders definitivos checkpoint07, revisar todas las cámaras, web escritorio/móvil y video de salida nueva. Fuentes y licencia de interpretación de Casa Román en architecture-references.md.

## Checkpoint 07C — Geometría validada y revisión visual crítica

- Build final: 2.109 objetos editables, 458 árboles. GLB entregado 22.646.224 bytes, 27 mallas, 1.642.935 triángulos, 15 PNG locales. Decodificación real con Blender y validate_geometry.py PASS: 144.982.444 bytes decodificados, máscara de Manga conservada, GIS SHA256 original intacto. Detalles en geometry-validation.json.
- Seis stills Cycles 1600×900 completos y revisados en models/manga/checkpoint07/stills. NO equivalen a fidelidad fotográfica aprobada: calles demasiado vacías, fachadas repetitivas, alturas mayormente inferidas, árboles facetados, costa sin contexto exterior y materiales aún simplificados. Casa Román tiene arcos/remates pero no reproduce fielmente proporciones, columnas, jardín ni todas las fachadas reales.
- QA web: búsqueda Casa Román, selección, ficha con altura visual 6,4 m versus GIS 3 m y advertencia histórica parcial; cámara urbana y superior móvil 390×844. Vista móvil muestra todo el barrio sin recorte. FPS observados escritorio 131–144 durante render paralelo: no benchmark ni garantía móvil.
- Corregido fallo 404 de texturas nuevas reiniciando producción después de externalizarlas. Archivo PNG comprobado por HTTP 200; sin errores nuevos de textura tras recarga (los anteriores permanecen en consola). No se relajó CSP. Servidor actual PID6244, puerto3000; comprobar al retomar.
- Animación nueva todavía en curso en docs/manga/render-checkpoint07.log, lanzador PID23164. No cambiar MANGA_STORMPRINT_FINAL.blend ni render_local.py hasta terminar; manifiesto valida hashes. Reanudar con python scripts/manga/render_delivery.py --skip-stills si se interrumpe. No usar frames históricos de models/manga/renders.
- README actualizado con cifras actuales, orden reproducible y limitaciones. Pendiente cerrar vídeo/validación de codificación y guardar copia CHECKPOINT07 del .blend. Alcance TODO Manga permanece; parecido individual requiere referencias por inmueble, no más variación aleatoria.

## Checkpoint 07D — Reanudación y control de cámara

- Interrupción durante el render: reanudado con manifiesto, log render-checkpoint07-resume.log. Build Next completo PASS tras corregir maxPolarAngle de vista urbana: el destino sobre Calle 26 mira ligeramente pendiente arriba y el límite aéreo impedía alcanzarlo. Verificado en navegador a nivel de calle, sin errores de consola en pestaña nueva.
- Backup confirmado por hash: models/manga/MANGA_CHECKPOINT07_VALIDATED.blend = 61aa96a59d4e597eaeb0401241857b2536ea779183f30be6f386537afc4c53a5, igual al FINAL. Se conserva CHECKPOINT07.blend previo con hash diferente; no se sobrescribió ni se asume equivalente.
- Prueba manual a 300 s: 17.709 m³, error de balance 5,6e-9 m³, profundidad máxima 0,19 m; vegetación conmutable. Observadas 45–46 llamadas de dibujo (el presupuesto de 32 es de mallas GLB, no llamadas incluyendo sombras y capas).
- Defecto visual pendiente identificado: web presenta parches de sombreado/color en fachadas y suelo demasiado oscuro frente a Cycles; investigar normales, materiales y compresión con comparación controlada antes de declarar paridad visual. No es ausencia de textura: carga nueva sin errores y HTTP 200.
- El video es evidencia de maqueta diferenciada, NO calidad fotográfica final. Revisados fotogramas 1,120,121,240,241; las transiciones son cortes entre aérea/urbana/costa. Se añadió validate_video.py para decodificar todos los frames del MP4 y verificar 360 frames/24fps/1280×720 antes de declarar entrega.
- Servidores reiniciados: web PID6908/3000, API PID7108/8000. Verificar vigencia al retomar. No commits ni publicación.

## Checkpoint 07E — Video local terminado; realismo todavía pendiente

- MP4 generado por Blender local y decodificado completo con OpenCV: PASS, 360 fotogramas, 24 fps, 15 s, 1280×720, 5.110.989 bytes. Archivo models/manga/checkpoint07/Manga_Recorrido_15s.mp4; evidencia docs/manga/video-validation.json. SHA256 1ec9a6fe12eee644b9ff66ae7fa6f57a7740b3f3c012eed02726f41049ee7542.
- Inspección visual adicional del frame360 completada. Seis stills y secuencia completa preservados. No volver a renderizar checkpoint07 para continuar arquitectura: usar nueva carpeta checkpoint08 y nuevo manifiesto.
- Próximo trabajo prioritario: corregir disparidad de sombreado/materiales web frente a Blender mediante comparación controlada; después geometría y referencias verificadas por inmueble. No ampliar detalles aleatorios como sustituto de parecido real. Persisten los defectos descritos en 07C/07D; esta fase NO satisface el objetivo final de casas idénticas ni fotorealismo de TODO Manga.
