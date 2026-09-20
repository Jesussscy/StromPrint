# Versión 6.1 — nuevo modelo de Manga, fase de render

19 de septiembre de 2026. Punto anterior: **v6.0 / ec8d3bc**. Esta entrega reemplaza el render anterior tanto en el dashboard como en `/manga-3d`.

## Fases completadas

1. **Respaldo:** commit y etiqueta `v6.0`, antes de tocar los mapas. Incluye los cambios pendientes de código y cartografía recibidos. Los renders auxiliares y archivos Blender no seguidos se conservaron en disco.
2. **Modelo nuevo:** el adjunto recibido fue `scene.glb`, no `SN.GLB`. Se conserva idéntico en `public/models/manga/v6.1/source.glb`. SHA256 `4ead2731e28460980180687b0181b2bf1f5bd12a2c44a2f115b930127ccd9cfd`.
3. **Arquitectura:** 235 casas pequeñas, 619 medianas, 388 grandes, 377 edificios pequeños y 3 torres. Se conservan las huellas del adjunto y se añaden colores, ventanas, puertas, cornisas y balcones simplificados. Las casas utilizan alturas visuales de 4,2 / 6,8 / 9,4 m; edificios pequeños de 13,2 m. La clasificación por dimensiones es una interpretación visual, no un inventario catastral.
4. **Cementerio:** perímetro de [OSM 49474750](https://www.openstreetmap.org/way/49474750), entrada orientada hacia el borde norte de Calle 29, tres arcos abiertos, rejas, cornisa y cuerpo superior. Interior con 306 tumbas elevadas, 30 mausoleos, cruces, placas, pasillos, muro y árboles. La posición del predio proviene de cartografía; el detalle interior, sus cantidades y el punto exacto de la puerta son aproximaciones, no un levantamiento.
5. **Render y navegación:** vistas general, superior, cementerio y entrada; día/atardecer; interruptores de edificios, vegetación, rótulos y sombras. Marcadores para cementerio, Casa Román, Iglesia Santa Cruz y Club de Pesca. Se pausa el render al salir de pantalla o esconder la pestaña.

## Referencias revisadas

Se extrajeron y revisaron 12 capturas del video `Download.mp4`, de 78,73 s, a intervalos de unos 7,15 s. Contacto visual en [video-contact-sheet.jpg](v6.1/video-contact-sheet.jpg).

- 0–7 s: mausoleo con columnas y remate clásico.
- 14 s: tumbas elevadas, cruces, calles interiores y vegetación.
- 28–43 s: nichos, lápidas y monumentos claros con distintos volúmenes.
- 50–78 s: desgaste de piedra, pasillos estrechos y sepulturas densas.
- Foto adjunta de Street View: acceso claro con tres arcos, rejas y cuerpo central elevado. Se usó como referencia visual; no como fuente de instrucciones ni de medidas.

Se simplificaron esculturas, flores, inscripciones y desgaste para mantener una geometría ligera. No se declara réplica fotogramétrica.

## Transformación y reparación

El GLB original contiene 1.954 volúmenes y 834 primitivas de líneas con atributos `_INSTANCESTART` incompatibles con su geometría base. Estas últimas provocaban un error de importación en Blender; se reconstruyeron únicamente las posiciones y caras de los volúmenes, recalculando normales. Las líneas no son edificios y se excluyen; calles y suelo se generan de nuevo desde la cartografía existente.

La transformación afín horizontal se ajustó con 1.605 coincidencias de huellas. Residuo mediano: 0,0029 m; percentil 95: 0,0112 m. Estos valores describen la coincidencia entre dos archivos, **no precisión geográfica real**. Ejes finales: X este, Y altura, Z sur. Coordenadas de trabajo AEQD del dataset existente. La transformación completa se guarda en `v6.1/build-input.json`.

Se excluyeron 332 volúmenes externos al límite de Manga, para evitar edificios flotando sobre el mar al carecer de terreno de barrios vecinos. El original conserva esos objetos. Quedan 1.622 construcciones en la isla. No se incorporó ninguna malla GLB anterior.

## Optimización y validación

- GLB final: **3.565.532 bytes**, **558.631 triángulos**, **331 mallas** agrupadas por material, categoría y sectores de 300 m.
- Compresión Draco con decodificador local; sin descargas externas para abrir el modelo.
- Fachadas detalladas visibles únicamente a menos de 500 m en modo normal y 1.000 m en calidad alta. Sombras opcionales; DPR máximo 1,5.
- `node scripts/manga/validate_v61.cjs`: PASS. Decodifica todas las primitivas del archivo final, comprueba coordenadas finitas, índices válidos, totales, hash original, presencia de tipologías y límites de peso/geometría. Informe: [validation.json](v6.1/validation.json).
- `npm run build`: TypeScript, lint y generación de páginas completados.
- Renders Cycles revisados: [vista general](v6.1/aerial.png), [cementerio](v6.1/cemetery.png), [entrada](v6.1/entrance.png).
- La prueba interactiva de navegador se registra en [browser-qa.md](v6.1/browser-qa.md). No se afirma rendimiento en teléfonos físicos.

## Alcance y siguiente fase

Esta es la fase de **render conceptual** solicitada. El suelo nuevo es plano. Los controles de agua, selección hidráulica de zonas y lluvia del visor anterior se retiraron de esta vista; los servicios meteorológicos y el resto del dashboard permanecen. Los datos hidráulicos anteriores no se muestran sobre esta geometría sin comprobar primero su correspondencia vertical.

Siguiente fase: validar con el usuario la entrada y distribución del cementerio; afinar fachadas emblemáticas y cubiertas; recuperar terreno y efectos meteorológicos con alturas compatibles; medir memoria y fluidez en móvil físico. Las esculturas y mausoleos singulares del video requieren más trabajo para una réplica detallada.

## Reproducir y recuperar

Desde la raíz del repositorio, con Python (numpy, scipy, pyproj, Pillow) y Blender 5.2:

```powershell
python scripts/manga/inspect_source.py
python scripts/manga/align_v61.py
python scripts/manga/prepare_v61.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python-exit-code 1 --python scripts/manga/build_v61.py
node scripts/manga/validate_v61.cjs
npm run build
npm run start -- --hostname 127.0.0.1 --port 3016
```

Abrir `http://127.0.0.1:3016/manga-3d`. La fuente Blender se genera en `models/manga/MANGA_V6.1.blend` y queda fuera de Git por ser reproducible. No se necesitan el video ni su ruta original para reconstruir el modelo.

Para consultar 6.0 sin sobrescribir cambios: `git worktree add ../StormPrint-v6.0 v6.0`. Los GLB antiguos se eliminaron de `public` en 6.1 y se recuperan con esa versión. Evitar `reset --hard` sobre trabajo posterior sin respaldo.
