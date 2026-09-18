# Checkpoint08 — optimización y entorno

Base: checkpoint07E. Copia de visor en models/manga/checkpoint08/MangaMap.before.tsx, GLB anterior en manga-before.glb; Blender anterior MANGA_CHECKPOINT07_VALIDATED.blend. No sobrescribir estas copias.

## Auditoría inicial

- Exportación monolítica por material: 1.642.935 triángulos, 27 mallas, 22.646.224 bytes; no LOD por distancia ni descarte de sectores. Las carpinterías marfil/oscuras suman 702.578 triángulos y persianas 119.768. Se procesan incluso cuando ocupan menos de un píxel.
- Raycasting recursivo sobre toda la escena al pulsar/soltar/clicar. Fiber filtra pointermove sin handlers de hover: no atribuirle el costo continuo del arrastre sin medirlo.
- Sombras de 2048 px cubren 3.600 m (≈1,76 m/texel), insuficientes para marcos de centímetros; posible acne/aliasing, requiere contraste con sombras apagadas. La pasada se invalida en cambios de capas/luz, no cada frame.
- DPR hasta1,5 y render continuo aun fuera de pantalla. FPS históricos 131–144 en reposo no prueban interacción fluida ni percentiles de latencia.
- Fachadas repetidas, calles vacías, poca transición suelo/jardín, arbolado facetado. No hay fotos ni alturas verificadas por vivienda. SRTM30m no resuelve bordillos/badenes; conservar elevaciones y diferenciar detalle visual inferido.

## Trabajo autorizado

Sectores con detalle cercano/medio/lejano, selección mediante volúmenes ligeros, calidad adaptativa, césped y tierra en áreas libres verificadas contra las huellas/vías, ornamentos y mobiliario inferidos, iluminación día/atardecer/noche. Comparar métricas y renders antes de dar esta fase por cerrada.

## Entregado y validado

- `district.glb` se dividió en 54 sectores y tres niveles: volumen lejano, base y detalle próximo. El navegador no hace raycast sobre la decoración; la selección conserva una malla BVH ligera por edificio.
- 52.529 m² de césped/jardines y un borde de tierra se generaron solo en suelo libre. Se validaron 4.899.839 vértices decodificados contra el límite de Manga; no se alteraron el GIS, IDs ni solver.
- Vegetación (458 árboles) y 100 luminarias son instancias reutilizadas. Durante movimiento se reducen DPR/sombras; el detalle y las sombras se restauran al detenerse. Hay controles Alta, Equilibrada y Rendimiento.
- Ensayo local de 10 s, escritorio 1440×900, calidad Equilibrada: vista general 143,9 FPS, p95 7,3 ms, 226.107 triángulos y 187 llamadas; vista urbana 143,9 FPS, p95 7,3 ms, 904.552 triángulos y 94 llamadas. Geometría residente estimada: 196,6 MiB. Es un límite pendiente: los LOD se ocultan pero todavía se descargan juntos.
- El GLB web pasó de 22.646.224 a 17.492.884 bytes (−22,8 %). `npm run build`, 47 pruebas Python y la validación del solver pasaron.

## Límites honestos

Las fachadas, jardines, toldos y mobiliario no medidos siguen siendo aproximaciones inferidas. SRTM (~30 m) no certifica bordillos, badenes ni pendientes de cada calle. Para que una vivienda sea reconocible hace falta foto autorizada o levantamiento, dirección/huella confirmada y, si se busca precisión, alturas y fachada verificadas. Los renders nocturnos son una iluminación de lectura, no un inventario de luminarias reales.
