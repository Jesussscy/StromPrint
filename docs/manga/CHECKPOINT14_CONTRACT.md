# Checkpoint 14 — contrato 3D ligero de Manga

**Histórico:** el [checkpoint15](CHECKPOINT15_GEOGRAPHY.md) reemplaza los proxies de posición,
actualiza GLB/visor y completa la prueba WebGL. Las cifras y pendientes siguientes describen el checkpoint14.

Fecha: 18/09/2026. **Implementación técnica terminada; reconstrucción exacta pendiente de datos.**

## Entrega

- Visor independiente `/manga-3d`, implementado en `app/components/MangaContract.tsx`.
- `public/models/manga/contract/manga-contract.glb`: 27.627 triángulos, 2.252.176 bytes, 10 mallas, dos materiales PBR, un PNG de 2048×2048 embebido. No necesita texturas remotas ni decodificador Draco.
- `public/models/manga/contract/metadata.json`: CRS, origen, procedencia, discrepancias y SHA256 del GIS original.
- `models/manga/MANGA_CONTRACT.blend`: fuente editable local, reproducible, excluida de Git junto con el intermedio de preparación.
- `models/manga/contract-preview.png`: vista Cycles generada y revisada.
- Scripts: `prepare_contract.py`, `build_contract.py`, `validate_contract.cjs` en `scripts/manga`.

Se conserva la versión detallada existente y su solver. El visor nuevo tiene su propia ruta porque usar su relieve hipotético con la grilla EGM96 original produciría resultados inconsistentes. No se transforma silenciosamente el SRTM en MSL ni se usa el plano animado como cálculo hidráulico.

## Checkpoints ejecutados

1. **14A / GIS:** reproyección del conjunto existente desde su AEQD declarado a EPSG:32618; resta del origen proyectado de lon −75.5325°, lat 10.4130°. Verificación inversa de los siete hitos <1e−8 grados. Terreno de 3.345 triángulos y 1.622 huellas OSM conservadas.
2. **14B / Blender:** generación y exportación con Blender 5.2.2 LTS realmente ejecutado; escala métrica, geometría en coordenadas locales, nodos con transformaciones identidad. Render revisado. El aviso de miniatura `.thumbnails` no impidió guardar el `.blend`, GLB ni PNG.
3. **14C / binario:** PASS en `contract-validation.json`: presupuesto, índices, normales unitarias, orientación superior del terreno/agua, atlas embebido único, jerarquía, alturas finitas, identidad de transformaciones, cobertura de terreno y conservación del hash del GIS original.
4. **14D / aplicación:** `npm run typecheck`, `npm run lint`, `npm run build`: PASS. Ruta y GLB: HTTP 200; cuerpo GLB 2.252.176 bytes. Advertencia de caché Webpack no bloqueante. Servidor iniciado en `http://127.0.0.1:3014/manga-3d`; comprobar proceso si se retoma más tarde.
5. **Pendiente QA navegador:** la herramienta de navegador no pudo iniciar: `apply deny-read ACLs / helper_unknown_error`. No se afirma revisión WebGL interactiva, prueba móvil ni 60 FPS medidos.

## Contrato de escena y ejes

```text
Manga_Terrain_Base       Mesh
WaterLevel_Animated      Mesh
Landmarks_LOD2           Group
  Fortin_Pastelillo      Mesh
  Club_Nautico_Marina    Mesh
  Puerto_SPRC           Mesh
  Puentes_Group         Group
    Puente_Roman        Mesh
    Puente_Las_Palmas    Mesh
    Puente_Jimenez       Mesh
    Puente_Bazurto       Mesh
Buildings_LOD1          Mesh, una primitiva
```

Blender `(E,N,H)` → glTF/Three `(E,H,−N)`. Una unidad es un metro de cuadrícula UTM. La distorsión UTM local sigue existiendo; no se presenta como distancia geodésica exacta. Origen vertical MSL **hipotético**, sin amarre a banco de nivel. El norte de cuadrícula corresponde a −Z en Three.

El terreno interpola por distancia inversa tres cotas medias del encargo: Lago 0,40 m, Curas 0,60 m y Calle Real 1,80 m. Es una superficie de demostración entre estos valores, no un DTM ni una afirmación de que toda la isla esté en 0–2,2 m. No utiliza las cotas de tableros como puntos del terreno. Los edificios se apoyan en la máxima cota de su huella; alturas de OSM/pisos o valor estimado existente. No se inventaron alturas de rascacielos para aparentar exactitud.

El atlas contiene la red vial disponible horneada en UV geográficas; los anchos son estimados en la fuente preparada. No se certifica que los nombres de todas las avenidas estén completos. La franja derecha contiene colores de edificios/hitos y una región de normales de ondas usada por el agua. El material de agua usa `alphaMode=BLEND`, roughness 0,24 y normal map. Ondas decorativas estáticas; H(t) mueve el plano sin aportar volumen al solver.

## Discrepancias que impiden declarar exactitud

- El límite disponible es el polígono OSM de barrio, **no un levantamiento de línea de costa ni deslinde certificado**. Área UTM: 1.838.986 m², incluye puerto. El cambio frente a los 1.840.302 m² AEQD previos resulta de la proyección. No se forzó el área a 1,35 km².
- 11.584 m² del polígono quedan fuera de la segunda caja solicitada. Se conserva la geometría entera; el plano de agua cubre la unión de ambas extensiones con margen de 100 m. La primera caja del encargo es todavía menor y no se usa para cortar la isla.
- Distancia de los puntos del encargo al borde GIS, en metros: Román 63,12 (interior), Las Palmas 171,68 (exterior), Jiménez 326,41 (exterior), Bazurto 329,97 (exterior), Pastelillo 54,51 (exterior), Club Náutico 126,93 (interior), SPRC 115,32 (interior). Estar fuera del polígono no prueba por sí solo que un puente o muelle sea incorrecto, pero obliga a verificar sus extremos y orientación. La vista muestra algunos proxies separados del terreno.
- Los hitos conservan literalmente los anclajes pedidos. Longitudes, orientaciones y formas son **proxies esquemáticos**, no arquitectura LOD2 levantada. `Landmarks_LOD2` es el nombre de integración exigido, no certificación de nivel de detalle. El fortín no reproduce aún su traza histórica.
- EPSG:3116 es MAGNA-SIRGAS / Colombia Bogotá zone, no Colombia West. Se eligió la alternativa solicitada EPSG:32618. Referencia: [IGAC, consulta de coordenadas](https://www.colombiaenmapas.gov.co/colombia-mapas/como-consultar-coordenadas-y-alturas).
- Las Palmas conecta Manga con Pie del Cerro según la [Alcaldía de Cartagena](https://www.cartagena.gov.co/noticias/asi-sera-el-nuevo-puente-palmas-para-mejorar-conexion-entre-manga-el-pie-cerro); no se usa la descripción de conexión al Arsenal como topología verificada. La [Comisión Fílmica de Cartagena](https://www.cartagenacomisionfilmica.com/es/locaciones/manga-puente-roman) identifica los cuatro accesos y sus calles. Estos textos no proporcionan coordenadas ni cotas de levantamiento.
- No se ha asignado Laguna del Cabrero como borde directo de esta malla: falta sustento vectorial para esa asociación. El plano continuo no distingue bahía/caños ni aporta batimetría.

## Reproducción

Desde la raíz, Python con pip y Blender instalado:

```powershell
python -m pip install -r scripts/manga/requirements-contract.txt
python scripts/manga/prepare_contract.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/manga/build_contract.py
node scripts/manga/validate_contract.cjs
npm run typecheck
npm run lint
npm run build
npm run start -- --hostname 127.0.0.1 --port 3014
```

En esta máquina se usó el Python del runtime de Codex y dependencias locales en `.runtime-manga` porque el Python del venv existente no era ejecutable en el sandbox. Esa carpeta no forma parte de la entrega ni es requisito para otros equipos. La preparación no descarga GIS: reutiliza datos versionados y comprueba el origen por hash. El archivo `contract-input.json` se regenera siempre antes de construir.

Para integrar en otro Canvas de React Three Fiber:

```tsx
<Suspense fallback={null}>
  <MangaContractModel heightAtTime={seconds => 0.5 + 0.25 * Math.sin(seconds / 4)} />
</Suspense>
```

La función recibe segundos del reloj de render y devuelve cota absoluta, no profundidad. El componente clona las transformaciones del GLB y asigna `WaterLevel_Animated.position.y`; los valores no finitos conservan la última posición válida. Un cálculo externo debe convertir primero sus unidades, referencia temporal y datum. Para series de un solver usar su tiempo físico, no inferir que los segundos de animación equivalen a horas de pronóstico. La caché GLTF conserva geometrías/materiales compartidos y el componente no los destruye al desmontar.

## Continuidad necesaria para una réplica exacta

1. Incorporar DTM/LiDAR o levantamiento de terreno con datum vertical documentado y amarre a MSL local; reemplazar la interpolación hipotética y validar con puntos independientes.
2. Resolver límite barrio/isla/puerto y discrepancia de área con cartografía autorizada; conservar procedencia y comparación geométrica.
3. Levantar extremos, tableros y orientación de puentes; verificar coordenadas y planos/fotografías utilizables de fortín y marinas. Sustituir proxies, no corregirlos por intuición.
4. Incorporar alturas verificadas y conservar presupuesto de 80.000 triángulos mediante simplificación con tolerancia documentada.
5. Reproyectar y recalcular también la grilla hidráulica antes de compartir geometría con el solver; calibrar drenajes/condiciones de borde con eventos observados.
6. Revisar WebGL en navegador y móvil real; medir FPS y draw calls. El límite de triángulos no garantiza 60 FPS por sí solo.

El avance se entrega en un commit acotado. Los cambios ajenos existentes en API, dashboard, dependencias, lluvia y archivos eliminados permanecen fuera de ese commit.
