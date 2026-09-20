# Checkpoint 15 — accesos cartografiados y visor probado

18/09/2026, hora Colombia. Continúa el commit `61f817c` / checkpoint14. **Planimetría mejorada y QA web completado; topografía medida y arquitectura exacta siguen pendientes.**

## Cambios entregados

- Cuatro puentes construidos sobre los ejes OSM completos, con longitud y orientación cartografiadas; Bazurto conserva sus dos calzadas. Se reemplazaron los bloques de 60 m orientados arbitrariamente.
- Pastelillo usa su polígono `historic=fort` OSM con concavidades, plataforma y parapeto perimetral. Espesores, alturas y remates siguen siendo interpretaciones simples, no un levantamiento LOD2.
- Club Náutico se referencia por su nodo OSM y se representa únicamente un muelle cercano cartografiado. La relación de ese muelle con la marina se infiere por proximidad; **no se declara completa la marina**. El gran polígono `leisure=marina` corresponde a zona acuática/fondeo y no se extruyó como tierra.
- SPRC sustituye el almacén inventado por seis líneas cartografiadas de muelle/borde portuario. Son franjas visuales de 2 m, no superficies completas de atraque ni inventario del puerto.
- Las coordenadas originales del encargo permanecen en `metadata.landmarks[].requested`. La posición visible usa la cartografía y muestra la corrección horizontal; las cotas originales siguen como hipótesis separadas.
- Selector de hitos con enfoque de cámara, coordenadas y fuentes; encuadre adaptado al aspecto del canvas; contraste del selector corregido y enlace de salto al contenido funcional.
- Contadores de triángulos renderizados, llamadas de dibujo, FPS locales y H(t). Actualización cada segundo, sin cambiar el reloj ni balance del solver existente.

## Fuentes y correspondencia

Se reutilizó `data/manga/raw/osm-features.json` para los puentes. La consulta nueva queda congelada en `data/manga/raw/osm-contract-landmarks.json`, con fecha OSM y SHA256 registrados en los metadatos. Todos los elementos OSM se atribuyen a sus contribuidores bajo [ODbL 1.0](https://www.openstreetmap.org/copyright).

| Objeto | Elementos OSM | Corrección respecto al punto pedido | Longitud del eje |
|---|---|---:|---:|
| Román | [404213692](https://www.openstreetmap.org/way/404213692), Calle 25 | 357,6 m | 165,9 m |
| Las Palmas | [173053758](https://www.openstreetmap.org/way/173053758), Puente de Manga | 367,8 m | 59,3 m |
| Jiménez | [90955541](https://www.openstreetmap.org/way/90955541), Carrera 22 | 495,2 m | 61,9 m |
| Bazurto | [25355014](https://www.openstreetmap.org/way/25355014), [49555739](https://www.openstreetmap.org/way/49555739) | 552,5 m | 186,1 / 181,4 m |
| Pastelillo | [54977866](https://www.openstreetmap.org/way/54977866) | 422,1 m | — |
| Club Náutico | [nodo 4246811137](https://www.openstreetmap.org/node/4246811137), [muelle 109814461](https://www.openstreetmap.org/way/109814461) | 385,9 m | — |
| Puerto SPRC | vías 166292802–166292807 | 203,7 m | — |

La corrección compara el punto pedido con el centroide de la geometría elegida; para la marina compara nodos. **No es error de un levantamiento ni medida de precisión de OSM.** Para puerto, un centroide de muelles no equivale a un punto de control de la terminal.

La identidad de Román y Las Palmas combina OSM con el inventario de accesos de la [Comisión Fílmica de Cartagena](https://www.cartagenacomisionfilmica.com/es/locaciones/manga-puente-roman). OSM llama al segundo «Puente de Manga»; sus extremos comparten nodos con las vías 49589847 y 173053848, ambas Carrera 17. Jiménez y Bazurto tienen nombre de puente en sus etiquetas OSM. El [sitio del Club Náutico](https://www.clubnauticocartagena.com/) se consultó como referencia de identidad, sin copiar sus fotografías ni inferir cotas desde ellas.

Los puentes llegan a la isla: al menos un extremo de cada eje está dentro de la máscara GIS. Los extremos opuestos están fuera porque el modelo sigue limitado a Manga; no se inventó terreno de Getsemaní ni de los otros barrios. Alturas de tableros, anchos por carriles, barandas, parapetos y espesores se detallan como supuestos en `dimensionsProvenance`.

## Validación ejecutada

- GLB: **27.915 triángulos, 2.289.176 bytes, 10 mallas**, atlas PNG único embebido 2048×2048 y dos materiales PBR. Se mantiene +Y arriba, unidades métricas, identidad de transformaciones y jerarquía exigida.
- `node scripts/manga/validate_contract.cjs`: PASS. Además de los controles anteriores, verifica hashes de fuentes, cobertura del agua sobre todos los vértices, correspondencia de anclajes y **35 muestras de ejes OSM sobre caras superiores de tableros a la cota indicada**. Informe en `contract-validation.json`.
- Blender 5.2.2 LTS: exportación y render Cycles ejecutados. Vista aérea revisada. Fuente local regenerada en `models/manga/MANGA_CONTRACT.blend`; PNG en `models/manga/contract-preview.png`.
- Build final Next con TypeScript y lint: PASS. Advertencias de caché Webpack no bloqueantes.
- Navegador real de Codex: carga, calles texturizadas, enfoque Pastelillo/Román/Jiménez, cota fija 3 m y demostración senoidal comprobados. Sesión limpia final: cero mensajes de error/advertencia capturados. Ya no queda pendiente la apertura WebGL del checkpoint14.
- Observación local: 144 FPS en muestras del contador de 1 s; vista general 11 llamadas de dibujo y 27.917 triángulos renderizados. Los dos adicionales se deben al render del material transparente de doble cara, no a geometría extra en el archivo. La selección/culling modifica las cifras visibles. **No es benchmark estadístico ni garantía para teléfonos.**
- Vista 390×844: ancho de documento 385 px, sin desbordamiento horizontal; un canvas de 548,6 px de altura, isla encuadrada, selector legible. Se restauró el tamaño de navegador después. No se probó hardware móvil físico.

### Fallo del atlas encontrado y corregido

La primera carga en navegador mostró `GLTFLoader: Couldn't load texture blob:...` pese a que el PNG y la geometría pasaban la validación binaria. La política existente permite imágenes `blob:` en `img-src`, pero la vía `ImageBitmapLoader` usa `fetch` bajo `connect-src`. Se configuró `TextureLoader` mediante un plugin del cargador GLTF para usar imágenes HTML. La política de seguridad no se modificó y el GLB sigue siendo autocontenido.

El componente comprueba que terreno y agua tengan mapa de color/normal; si no cargan, muestra error en lugar de entregar silenciosamente un modelo sin texturas. El shader de agua sigue siendo decorativo: el único movimiento hidráulico de esta vista es la cota H(t), sin cálculo de caudal.

## Reproducción y acceso

```powershell
python -m pip install -r scripts/manga/requirements-contract.txt
python scripts/manga/fetch_contract_landmarks.py
python scripts/manga/prepare_contract.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/manga/build_contract.py
node scripts/manga/validate_contract.cjs
npm run build
npm run start -- --hostname 127.0.0.1 --port 3015
```

Abrir `http://127.0.0.1:3015/manga-3d`. El puerto 3014 tenía una instancia anterior: para esta entrega se inició producción nueva en 3015. Verificar procesos al retomar. El script de descarga reutiliza su caché y rechaza respuestas Overpass incompletas; no renueva otras fuentes. Para incorporar fuentes distintas, usar un nuevo snapshot y revisar discrepancias antes de exportar.

## Pendientes reales

1. DTM urbano con datum vertical y amarre a MSL; el relieve sigue interpolado de tres cotas supuestas.
2. Levantamiento de tableros y secciones de puentes, fachadas/alturas del fortín y cobertura completa de marina/puerto.
3. Definir y validar límite de isla/barrio/puerto con cartografía autorizada; no se fuerza el área a 1,35 km².
4. Recalcular y calibrar grilla hidráulica antes de conectar esta geometría a la simulación. El dashboard y la grilla EGM96 existente se conservan.
5. Medir rendimiento en dispositivos móviles reales y validar eventos de inundación con observaciones.

No se declara réplica exacta ni certificación hidráulica. El avance se registra en un commit limitado a estos archivos y artefactos, preservando los cambios previos ajenos.
