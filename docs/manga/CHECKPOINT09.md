# Checkpoint09 — móvil, lluvia y superficies de agua

Base: checkpoint08, commit 206fa95. Fecha local: 17 de septiembre de 2026.

## Cambios

- Eliminado el botón global de tormenta en escritorio y móvil, su estado y la capa global RainParticles. Se conservan escenarios hipotéticos separados dentro de las herramientas del mapa.
- Sensibilidad de cámara ajustada en pantallas pequeñas; un dedo gira y dos dedos permiten desplazar/zoom. Mayor área de marcadores táctiles, panel inferior y calidad Rendimiento inicial en dispositivos con puntero táctil. DPR reducido mientras se mueve la cámara.
- Las 20 zonas conservan su coordenada y pueden enfocar la cámara; selección desde la lista desplaza la página al visor. Los puntos 1, 2 y 5 están fuera del polígono de cobertura actual y se muestran con advertencia: no se inventaron coordenadas correctas.
- Pantalla completa móvil mediante portal al cuerpo del documento: evita que los contenedores transformados la restrinjan al panel. Botón reubicado para no tapar la lectura inferior.
- Gotas animadas en GPU, con presupuesto por calidad y movimiento. Velocidad de viento convertida km/h a m/s, dirección meteorológica de origen convertida a desplazamiento de escena. La cantidad visible es un recurso gráfico, no el conteo físico de gotas.
- Terreno enviado al worker una vez; reutilizado durante reproducción y retroceso. El solver rechaza huecos y solicitudes más allá del horizonte meteorológico, sin repetir la última hora.
- Agua visual reconstruida como planos horizontales por celda, recortados en intersecciones con los triángulos del terreno. No se ocultan celdas por densidad edificada. Las posiciones visuales no cambian la masa del solver.
- Ventanas procedurales suaves para volúmenes lejanos, sin añadir triángulos. Son fachadas inferidas, no identificación fotográfica de casas. Los LOD próximos conservan su geometría existente.

## Validación

- `npm run build`: aprobado tras regenerar la caché de compilación dañada; copia conservada en `.next/cache-before-mobile09`. Una segunda compilación comprueba la corrección de pantalla completa.
- `python -m pytest tests -q`: 47 pruebas aprobadas.
- `node scripts/manga/validate_mobile_rain.cjs`: lluvia acumulada 0/12/48 mm en tres horas, límites de horizonte, valores ausentes/negativos, secuencias discontinuas, recorte horizontal del agua, caché del worker y retroceso determinista aprobados.
- `node scripts/manga/validate.cjs`: conservación de masa, no negatividad, flujo descendente, simetría, escalas de malla, recesión y conexión costera aprobados. Informe en solver-validation.json.
- La API local respondió con la serie horaria Open-Meteo. Revisión con la habilidad computer-use a 390×844: selección de los 20 puntos comprobada en interfaz, advertencias en 1/2/5, enfoque visual de zonas 4 y 20, detalle de ventanas visible y ausencia del botón global de tormenta. La captura final confirma pantalla completa real y salida funcional. La línea temporal llegó a 18.00 horas calculadas mostrando 0.2 mm/h de la serie consultada, sin errores de consola registrados. No equivale a validación sobre un teléfono físico.

## Límites y siguientes prioridades

SRTM de aproximadamente 30 m y celdas de 40 m no resuelven badenes, bordillos ni patios individualmente. El recorte del agua por triángulos es visual y no una reconstrucción subcelda que conserve el volumen geométrico. La lluvia horaria se aplica uniformemente a Manga. El solver sigue siendo almacenamiento difusivo no calibrado, y sus parámetros de infiltración/drenaje requieren datos locales. Ninguna de estas pruebas certifica inundación por vivienda.

El modelo web y Blender siguen siendo checkpoint08; esta etapa mejora su presentación web, sin afirmar una reconstrucción nueva de todas las casas. Los niveles de detalle todavía se descargan juntos. No hay prueba en hardware de teléfono físico ni nueva cifra de FPS móvil. Priorizar descarga/carga de sectores, topografía local y referencias arquitectónicas verificadas. Prompt reutilizable: PROMPT_MANGA_MOVIL_LLUVIA.md.
