# Checkpoint10 — agua API, volumen visible y zonas

Base: e1462d2 (checkpoint09). Fecha: 18 de septiembre de 2026.

## Implementado

- Corregida la correspondencia temporal de Open-Meteo: su precipitación con sello 11:00 es la acumulada durante 10:00–11:00. El intervalo simulado [10:00,11:00) usa ese valor. Se conservan timestamp inicial, final y de origen de la precipitación en la respuesta; el viento conserva el instante inicial. Fuente consultada: https://open-meteo.com/en/docs (precipitation, preceding hour sum).
- Datos meteorológicos ausentes se muestran como «— / sin dato» en lugar de cero. Se conserva cero cuando la fuente informa cero. El motor sigue rechazando horizontes sin datos.
- La cota visual del agua se obtiene integrando la profundidad sobre los triángulos del terreno y resolviendo el nivel que contiene el volumen almacenado por el solver. Se calcula en el worker y se envía con el resultado. Orillas recortadas y agua horizontal; pequeño desplazamiento gráfico de 8 mm para evitar interferencias de profundidad.
- Material de agua menos saturado, transparencia gradual en orillas y reflejo aproximado dependiente del ángulo de vista. Las flechas siguen la cota visual reconstruida.
- Cada una de las zonas cubiertas resume celdas cuyo centro cae dentro de su radio: profundidad media ponderada por área, máximo de las medias de celda, área total de celdas con al menos 1 cm y hora calculada. Marcadores coloreados por profundidad espacial; zonas sin cálculo grises. Las zonas solapadas comparten celdas y no deben sumarse como superficies independientes.
- La tarjeta distingue estos resultados del indicador zonal EDO del panel. Mientras se busca otra hora conserva y etiqueta el resultado anterior, mostrando el destino solicitado y «actualizando».

## Referencias visuales

Se consultó Google Maps mediante la habilidad computer-use y se tomaron dos capturas visibles en la conversación: vista satelital de Manga con panel y vista amplia con panel oculto. Se conservaron las atribuciones Google Maps / Airbus / CNES / Maxar. Referencia: https://www.google.com/maps/search/Manga+Cartagena/ . Consulta de condiciones: https://about.google/brand-resource-center/products-and-services/geo-guidelines/ . No se incorporaron imágenes a texturas o al repositorio ni se capturó Street View.

Observaciones: patios y arbolado intercalados entre viviendas; mezcla de cubiertas; borde occidental con muelles; canal y vegetación al oriente; puerto al sur. Las capturas no aportan elevaciones de calles ni permiten certificar coordenadas de las zonas 1, 2 y 5, que mantienen la advertencia de cobertura.

## Verificación

- Compilación de producción aprobada.
- 48 pruebas Python aprobadas, incluyendo conversión horaria, cambio de día, cero y ausencia de precipitación.
- validate_mobile_rain.cjs aprobado: acumulados horarios, horizonte, datos ausentes, volumen visual integrado, cotas horizontales, worker, retroceso y zonas de distinta profundidad sin extrapolación fuera de cobertura.
- validate.cjs aprobado: conservación de masa, profundidades no negativas, flujo descendente, simetría, recesión, conexión costera y extremos. El solver físico no se cambió en esta etapa.
- Ensayo de reconstrucción visual: lluvia hipotética 30 mm/h durante 2 h, infiltración 2 mm/h y drenaje 3 mm/h, sobre las 1.319 celdas reales. Volumen almacenado: 93.760,4245 m³. Suma de errores absolutos de volumen geométrico por celda: antes 407.391,2316 m³; después 0,0005981 m³. Reconstrucción de niveles: 8,653 ms en esta ejecución local. La integración excluye el desplazamiento gráfico de 8 mm. No es una medición de FPS ni una validación hidrológica de campo.
- Navegador local con API reiniciada: lectura de +18 h y tarjeta de zona 4, datos originales y advertencia de inicio seco visibles. La búsqueda de +167 h conservó y etiquetó el resultado de +18 h durante el cálculo, y terminó en 167.00 h sin errores de consola. Captura de zona 6: media/máximo 0.0 cm con el pronóstico y pérdidas vigentes; no se añade agua artificialmente para forzar una inundación.

## Pendientes conservados

El modelo hidráulico sigue siendo almacenamiento difusivo no calibrado. La reconstrucción geométrica conserva volumen dentro de cada celda, pero el flujo entre celdas sigue usando las cotas medias del solver; no es un modelo de patios, alcantarillas o badenes. SRTM ~30 m y malla ~40 m. Inicio seco en el origen del pronóstico, lluvia uniforme sobre Manga y parámetros de pérdidas hipotéticos. No se cambió ni sumó la marea MSL al terreno EGM96.

Por la petición final de cerrar con commit, esta etapa se entrega centrada en agua: no se generó un Blender/render nuevo, no se reconstruyeron fachadas adicionales ni se implementó descarga por sectores. Tampoco se midió un teléfono físico. El checkpoint09 y el modelo Blender08 se conservan.
