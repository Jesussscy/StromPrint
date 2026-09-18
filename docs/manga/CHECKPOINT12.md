# Checkpoint12 — revisión local, sin commit

Nota posterior: este trabajo se incorpora al commit del checkpoint13, tras la autorización posterior del usuario. El texto siguiente describe el estado de la entrega local original.

Base: d31c91b. 18 de septiembre de 2026. El usuario pidió ver el resultado local antes de publicar: no se crea commit ni se hace push en esta etapa.

## Entregado

- Nuevo paisajismo generado con Blender 5.2.2 local: `models/manga/MANGA_CHECKPOINT12.blend`; suplemento web `public/models/manga/checkpoint12/landscape.glb` (329.584 bytes). Se conserva el distrito08 y sus edificios. Copas ramificadas, arbustos y jardines adicionales; especies y jardines privados son inferidos, no levantados.
- Césped visible por encima de las superficies previas, de 52.528,83 a 92.447,97 m². 458 → 522 árboles, 36 arbustos. Exclusión geométrica de vías, aceras y edificios; prueba de solapamiento y salida del perímetro: 0 m². El incremento es paisajismo interpretado, NO evidencia de más parques reales.
- Selector de visita a siete polígonos OSM etiquetados como parques (algunos nombres se repiten). Se conservan identificadores y procedencia en instances.json. No son siete parques nuevos ni se ha verificado la vigencia de cada etiqueta en campo.
- Auditoría del perímetro contra las fuentes congeladas: desviación máxima de redondeo frente al OSM original 0,000067 m; área 1.840.301,91 m². IoU con ArcGIS 0,939867; diferencia simétrica 113.461,22 m². Se mantiene OSM y se muestra el contorno; no se sustituye por otro polígono sin resolver diferencias. Una discrepancia entre fuentes no prueba cuál es más precisa.
- Máscara gráfica conservadora 512×512 para que gotas e impactos no continúen por fuera del área modelada cuando sopla viento. Su borde es rasterizado, no una nueva frontera GIS.
- Escenario de lluvia localizada explícitamente hipotético: centro en la zona seleccionada, radio configurable, intensidad completa hasta 65% del radio y atenuación suave a cero. La misma función radial alimenta la precipitación por celda y los efectos gráficos. Se permite escorrentía hacia fuera de la zona lluviosa; no se recorta el agua de manera arbitraria.
- Acabado mojado limitado a la zona de lluvia hipotética; coordenadas de material corregidas al espacio del mundo. La API puntual conserva lluvia uniforme y un aviso de falta de resolución por calle; se rechaza combinar su serie con una máscara inventada.

## Verificación

- Compilación de producción aprobada, JS inicial de portada 291 kB (redondeado).
- validate_local_rain.cjs aprobado: centro, borde, exterior, conservación, repetibilidad y separación de API.
- validate_mobile_rain.cjs aprobado: horizonte, ausencia, acumulados, volumen visual, worker y retroceso.
- Ensayo sobre las 1.319 celdas del distrito, radio hipotético 300 m centrado en (0,0), 120 mm/h durante 1 h, infiltración 2 y drenaje 3 mm/h: 146 celdas con al menos 1 cm; 1.134 por debajo de 1 mm; volumen 21.999,3269 m³; residuo de balance 6,38e-9 m³. No se inunda uniformemente todo el distrito.
- Render local Blender revisado: `models/manga/checkpoint12/preview/Jardin_Manga.png`, 960×540, Eevee, 6,736 s. Muestra copas nuevas y jardines; no es fotorrealismo.
- Navegador: escenario localizado en zona 4, radio 300 m, gotas activadas, reproducción y avance del agua comprobados; consola sin errores en la inspección. Capturas visibles en la conversación. Lectura puntual de escritorio ~143 FPS, geometría estimada 200,4 MiB. No es benchmark controlado ni prueba de teléfono.

## Límites y recuperación

No se cambiaron la topografía SRTM, las huellas ni las coordenadas de zonas; no hay levantamiento de drenajes, bordillos o fachadas nuevas. El solver sigue siendo exploratorio. Las cotas de césped incluyen 19 cm de desplazamiento gráfico para evitar superposición con parques previos; no son elevaciones físicas añadidas al solver. El contorno usa terreno cercano en diminutas franjas excluidas de la malla, sólo para dibujarlo.

La lluvia hipotética no es radar ni prueba de distribución real. La interpolación de intensidad es por centro de celda de 40 m. El GLB08 sigue residente y la vegetación suma geometría: la memoria medida creció aproximadamente 3,5 MiB frente a la lectura del checkpoint11; siguen pendientes descarga por sectores y prueba móvil real. Las fachadas siguen siendo aproximadas.

Scripts reproducibles: prepare_checkpoint12.py, build_checkpoint12.py, validate_local_rain.cjs. Fuentes: archivos originales OSM, ArcGIS y SRTM ya archivados; no se descargó nueva cartografía. Los cachés y archivos ajenos del usuario se preservan. No se ha publicado esta etapa en GitHub.
