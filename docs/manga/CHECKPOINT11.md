# Checkpoint11 — lluvia GPU y acabado mojado

Base recuperable: a758f8c (checkpoint10). Fecha: 18 de septiembre de 2026.

## Cambios entregados

- `app/components/MangaRain.tsx`: gotas instanciadas en GPU, con ancho, velocidad y longitud variables; transparencia suave, desvanecimiento junto al terreno y viento meteorológico FROM. Sin dirección disponible no se inventa viento norte. Semillas deterministas distribuyen las gotas sobre celdas del modelo.
- Presupuestos máximos: 16.000 gotas en alta, 8.000 equilibrada, 3.000 rendimiento. La densidad depende de mm/h; al moverse se dibuja el 65% del presupuesto. Los atributos se generan una vez por conjunto de datos, no en cada hora o gesto. Se respetan lluvia cero, ausencia de dato y movimiento reducido.
- Hasta 1.600 impactos circulares animados en centroides de triángulos de vías existentes. Una llamada de dibujo adicional; desactivados al moverse y en calidad rendimiento.
- `MangaScene.tsx`: acabado mojado instantáneo según lluvia seleccionada, oscurecimiento de superficies superiores y menor rugosidad. Grano mineral del asfalto con filtrado por distancia. Materiales compartidos, sin nuevas texturas ni nueva geometría de edificios.
- `MangaMap.tsx`: conexión con lluvia horaria existente, retirada del antiguo efecto de líneas; corrección de la leyenda de marcadores para describir el resumen espacial y no el riesgo EDO externo.

## Verificaciones

- Compilación de producción aprobada después de los cambios; primera carga JS de la portada: 291 kB, redondeo del informe de Next.
- `node scripts/manga/validate_mobile_rain.cjs`: aprobado tras retirar el efecto antiguo; datos ausentes, horizonte, acumulados, retroceso, protocolo del worker y volumen visual.
- `node scripts/manga/validate.cjs`: aprobado; conservación de masa, no negatividad, pendiente, simetría, retroceso, drenaje, costa y extremos. Informe actualizado en `solver-validation.json`. No se cambió el solver ni se recalibró.
- Navegador local: escenario explícitamente hipotético de 120 mm/h, vista urbana, calidad equilibrada; captura visible en la conversación con calles, cubiertas, arbolado y fachadas existentes. Consola sin errores en la inspección.
- Recorrido automático urbano: 10,01 s, giro 1,6 rad, 1.428 cuadros, 142,7 FPS, p95 7,6 ms, promedio 94 llamadas y 907.219 triángulos; geometría residente estimada 196,9 MiB, DPR 1. Medición de escritorio durante la revisión visual, antes de la última redistribución determinista de semillas y la corrección de leyenda. No hay recorrido anterior equivalente: no demuestra una mejora porcentual ni garantiza rendimiento móvil.

## Alcance y límites

Esta etapa mejora efectos y materiales web. No se generó una nueva escena Blender, no se añadieron fachadas medidas, no se alteraron cotas ni se reprodujeron todas las viviendas. Se conserva el modelo Blender y GLB del checkpoint08.

Las gotas son una representación visual de intensidad, no una cuenta física de gotas por metro cuadrado. La altura de cada columna procede de una celda de terreno gruesa; no hay colisión individual con tejados ni simulación de gotas salpicando. Los impactos son ilustrativos sobre vías; no prueban charcos medidos. La humedad del material cambia con la hora elegida, sin memoria física de secado. Los efectos no añaden volumen al solver. Los materiales no sustituyen referencias fotográficas verificadas.

El GLB sigue cargando juntos sus LOD (~197 MiB de geometría); la descarga por sectores sigue pendiente. No se midieron teléfono físico, memoria GPU completa ni tiempo hasta interacción en esta etapa. No se declara fotorrealismo de toda Manga ni predicción hidráulica por vivienda. La referencia de datos sigue siendo la documentada en checkpoint10; no se descargaron nuevas imágenes cartográficas.

Se excluyen del commit los cachés locales, archivos .blend1, diagnósticos pesados y archivos del usuario ajenos a estos cambios.
