# QA interactiva — versión 6.1

19/09/2026. Producción local en `http://127.0.0.1:3016`, navegador integrado de Codex.

- `/manga-3d`: carga completa del GLB comprimido y decodificador local. La consulta de logs del visor devolvió cero errores y cero advertencias.
- Vistas general, cementerio y entrada: comprobadas visualmente. Se corrigió el encuadre de entrada que inicialmente quedaba detrás de viviendas.
- Marcadores: cuatro lugares con nombre; Casa Román corregida a UTF-8. Se redujeron a pines numerados en la vista general para evitar rótulos superpuestos.
- Capas: vegetación desactivada y restaurada; calidad con sombras activada y desactivada. Día/atardecer comprobado en móvil.
- Muestra local de entrada en modo normal: 144 FPS, 99 llamadas de dibujo, 140.831 triángulos visibles. Muestra con más detalle y sin vegetación: 140 FPS, 121 llamadas, 267.449 triángulos. Son observaciones del contador, no un benchmark estadístico ni garantía de rendimiento en otro dispositivo.
- Viewport 390×844: documento de 390 px de ancho, sin desbordamiento horizontal. Botones de vistas, controles, cementerio y texto inferior visibles. Se restauró el viewport al terminar. No se probó un teléfono físico.
- Dashboard `/`: el mapa nuevo aparece en Panel de Monitoreo tras el montaje diferido al hacer scroll. En esta sesión el backend meteorológico no estaba disponible; sus errores de conexión no se consideran validados ni resueltos por este cambio visual.

Renders independientes de Blender: `aerial.png`, `cemetery.png`, `entrance.png`. La iluminación de Blender y la iluminación WebGL son distintas; los PNG no son capturas del visor.
