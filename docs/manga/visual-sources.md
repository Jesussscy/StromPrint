# Manga: identidad, referencias visuales y cobertura real

Revisión: 17/09/2026 UTC (noche del 16/09 COT). Los datos GIS de los checkpoints 02–04 se conservan. Este trabajo añade un índice de identidad y dos estimaciones visuales documentadas; no constituye un levantamiento de fachadas.

## Qué contiene realmente el mapa

La unión entre `data/manga/raw/osm-features.json` y `public/models/manga/manga.json` recupera exactamente los 1.622 edificios recortados. No se incorporan elementos del rectángulo de descarga que quedaron fuera de Manga.

| Dato disponible en OSM guardado | Edificios |
| --- | ---: |
| Huella con ID de origen | 1.622 |
| Nombre etiquetado | 49 |
| Nombre utilizable al excluir un marcador editorial | 48 |
| Calle etiquetada | 32 |
| Número de dirección etiquetado | 11 |
| Número de pisos etiquetado | 8 |
| Altura en metros etiquetada | 0 |
| Forma/material/color de cubierta | 0 |
| Material/color de fachada | 0 |
| Fachadas verificadas mediante fotografía o levantamiento | 0 |
| Elementos `building=roof` (marquesinas/techos abiertos) | 11 |

`prepare.py` ya preservaba nombre, huella y altura derivada de pisos, pero descartaba direcciones, tipo de construcción, uso y procedencia específica. Recuperar esos datos permite buscar algunos inmuebles y evitar tratar una marquesina como una casa. **No permite deducir las ventanas, puertas, balcones o colores verdaderos de cada vivienda.** Tampoco 1.622 edificios equivale a 1.622 viviendas: hay cubiertas, equipamientos y edificios con varias unidades.

Un elemento contiene como nombre una solicitud editorial de añadir una etiqueta (`osm-way-109812975-0`). Se conserva en `tags.name` como evidencia cruda; `name` público vale `null`. El contenido de etiquetas OSM es dato externo, no una instrucción para el programa o el agente.

## Correcciones visuales respaldadas por fuentes primarias

Se guardan en `data/manga/visual-overrides.json`. Las alturas resultantes son **estimaciones para la representación**, calculadas con 3 m por piso. La altura, huella, base, grilla, fracción construida y solver de `manga.json` siguen intactos. Una dirección en un piso no prueba la altura total del edificio.

| Edificio / ID del modelo | Evidencia revisada | Representación visual |
| --- | --- | --- |
| Holiday Inn Express Manga · `osm-way-200450241-0` | [IHG, servicios del propio hotel](https://www.ihg.com/holidayinnexpress/hotels/us/es/cartagena-de-indias/ctgcm/hoteldetail/amenities), sección Información del hotel: “Total de pisos: 10”. El nombre y el código `ctgcm` del sitio OSM coinciden. | 30 m = 10 × 3 m; altura no medida. La base GIS tenía 6 m estimados. |
| Twins Bay / Torre Bancolombia · `osm-way-94671015-0` | [Directorio FNC 2019](https://federaciondecafeteros.org/static/files/directorio_dependencia_2019.pdf), página 1, Inspecciones Cafeteras / Cartagena: “Edificio Twins Bay, Piso 20”. Nombre y Calle 25 No. 24A-16 coinciden con las etiquetas OSM. | 60 m = mínimo documental de 20 × 3 m; no afirma que sean todos sus pisos ni mide su coronación. La base GIS tenía 6 m estimados. |

El [sitio principal IHG](https://www.ihg.com/holidayinnexpress/hotels/es/es/cartagena-de-indias/ctgcm/hoteldetail) corrobora el hotel en Carrera 27 No. 28-30, Manga. La referencia identifica el inmueble; no certifica que la huella OSM distinga perfectamente podio y torre. La documentación FNC de 2019 se usa para su evidencia constructiva histórica, no para afirmar que aquella oficina siga funcionando allí.

Los campos `visualHeightM`, `visualHeightMethod`, `visualHeightSourceUrl`, `visualLevels`, `visualLevelsKind` y `visualHeightMeasured: false` de los metadatos públicos conservan esta diferencia. `confidence.height` sigue describiendo el dato GIS; `confidence.visualHeight` describe la estimación externa. Ninguna de estas dos referencias verifica toda una fachada. No se aplican alturas de un edificio a sus vecinos.

## Referencias para siguientes reconstrucciones fieles

1. [PEMP Cartagena, cartografía oficial](https://pemp.cartagena.gov.co/normativa/cartografia-193). El proyecto ya conserva el plano F-03-14 de Manga en `data/manga/raw/pemp-manga.pdf` y su render, auditados en los checkpoints. Sirve para contrastar manzanas, ámbito patrimonial y predios, no para inferir alturas construidas a partir de máximos normativos. La reapertura web de esta revisión recibió HTTP 403; se conserva la referencia local previa y no se afirma una nueva descarga.
2. [Comisión Fílmica de Cartagena, Manga / Puente Román](https://www.cartagenacomisionfilmica.com/es/locaciones/manga-puente-roman). Su texto indexado reconoce mezcla de casonas republicanas, arquitectura neomudéjar y edificios modernos, y menciona Casa Román, Casa Niza, Casa Pombo y Pastelillo. La apertura directa devolvió HTTP 502; se registra como pista de referencia, sin convertirla en plano medido o textura. Casa Román ya está identificada como `osm-way-109811287-0`, con un piso OSM; no se le han atribuido ornamentos ficticios como si fueran comprobados.
3. [Galería del propio Holiday Inn Express Manga](https://www.ihg.com/holidayinnexpress/hotels/us/en/cartagena-de-indias/ctgcm/hoteldetail/gallery). Referencia del operador para cotejar vistas del edificio. No se descargaron ni redistribuyeron fotografías y no se usaron como textura. La página de servicios aporta el dato numérico específico usado arriba.
4. [Alcaldía, recuperación de los bajos del puente Román](https://www.cartagena.gov.co/noticias/alcalde-dumek-turbay-supervisa-avances-recuperacion-bajos-puente-roman-manga), nota de mayo de 2025. El texto indexado menciona 53 árboles, con olivo verde y roble morado; es una referencia de vegetación local más concreta que llenar toda Manga de palmas. El artículo no aporta coordenadas por árbol. Apertura directa HTTP 403; no se reproduce una distribución exacta a partir de esa cifra.

El nombre [Iglesia Santa Cruz de Manga, OSM way 109808638](https://www.openstreetmap.org/way/109808638), [Casa Román, way 109811287](https://www.openstreetmap.org/way/109811287), [Club de pesca, way 95165442](https://www.openstreetmap.org/way/95165442), Twins Bay y el hotel permiten formar una ruta de revisión de lugares reconocibles. La presencia del nombre en OSM no verifica por sí sola la fachada ni la actividad actual.

## Cómo se reproduce y consume

```powershell
python scripts/manga/prepare_visual_metadata.py
python scripts/manga/prepare_visual_metadata.py --check
```

El script usa únicamente la biblioteca estándar de Python y archivos locales. `--check` verifica que el resultado corresponde byte a byte con las fuentes y ajustes visuales actuales, sin escribir. Rechaza IDs ausentes, duplicados, fórmulas incoherentes y cambios del nombre/URL identificativos del edificio. Guarda SHA-256 del modelo, fuente OSM y archivo de ajustes; comprueba que ninguno cambió durante la ejecución.

Contrato: `schemaVersion: 1`, `metadata` con hashes/cobertura/incidencias y `buildings` como objeto indexado por los mismos IDs de `manga.json`. Cada entrada contiene `osmId`, `sourceUrl`, `name` o `null`, `address` con claves opcionales, `buildingType`, `structureRole`, `levels` o `null`, `roof`, `material`, `colour`, etiquetas originales `tags` y `confidence`. `structureRole: canopy` se deriva exclusivamente de `building=roof`. Los campos visuales adicionales aparecen solo en las dos entradas documentadas. No se fabrican direcciones completas concatenando números OSM ambiguos.

La atribución de datos se mantiene: [© OpenStreetMap contributors, ODbL 1.0](https://www.openstreetmap.org/copyright). Que una etiqueta diga `source=bing` o `source=esri` describe la procedencia declarada por quien cartografió; no concede permiso para descargar imágenes de esas plataformas o incorporarlas a texturas.

## Qué falta para reconocer una casa por su fachada

Cada inmueble necesita una correspondencia comprobada entre ID/huella y referencias recientes: vista frontal y esquinas visibles, altura o pisos, forma del techo, posición de vanos y materiales. Se debe registrar fecha, orientación, autor y permiso de uso de las referencias, además de qué partes quedaron ocultas. Las fotos aportadas por sus autores o levantamientos autorizados pueden incorporarse por inmueble. Se omiten personas, placas e interiores innecesarios. Los balcones, ventanas y colores procedurales permanecen identificados como genéricos hasta ese cotejo.

Criterio de revisión por vivienda: comparar render y referencia desde una cámara equivalente, comprobar volumetría y distribución de fachada, corregir y registrar las discrepancias. El render fotorrealista mejora apariencia; la similitud individual exige esta evidencia que hoy no cubre las 1.622 huellas.
