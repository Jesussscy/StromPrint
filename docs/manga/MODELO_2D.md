# Motor 2D fraccionario experimental

El código de `api/manga2d_reference.py` proviene de la implementación de referencia entregada en `stormprint-modelo-2d.zip`. `api/manga2d_runner.py` agrega validación de entradas, compatibilidad de snapshots y separación entre actualización observada y pronóstico. Se ejecuta fuera de la API pública mediante `scripts/manga/run_fractional_2d.py`.

El modelo conserva agua por celda, transporta entre celdas mediante un esquema inercial de diferencias finitas y aplica memoria fraccionaria al transporte. `alpha=1` recupera el caso clásico. El pronóstico parte del estado observado, pero solo el estado observado queda guardado en `snapshot.npz`; así los datos futuros no se convierten en historia real.

## Prueba reproducible con terreno sintético

Desde la raíz del repositorio:

```powershell
python scripts/manga/generate_fractional_2d_example.py --salida tmp/manga2d-demo
python scripts/manga/run_fractional_2d.py --dem tmp/manga2d-demo/dem_sintetico.asc --mascara-mar tmp/manga2d-demo/mascara_mar.npy --forzamientos tmp/manga2d-demo/forzamientos.csv --puntos tmp/manga2d-demo/puntos.csv --sumideros tmp/manga2d-demo/sumideros.csv --salida tmp/manga2d-demo/primera --datum-dem synthetic --datum-marea synthetic --datum-verificado --avance-horas 3 --pronostico-horas 3
python scripts/manga/run_fractional_2d.py --dem tmp/manga2d-demo/dem_sintetico.asc --mascara-mar tmp/manga2d-demo/mascara_mar.npy --forzamientos tmp/manga2d-demo/forzamientos.csv --puntos tmp/manga2d-demo/puntos.csv --sumideros tmp/manga2d-demo/sumideros.csv --salida tmp/manga2d-demo/segunda --snapshot tmp/manga2d-demo/primera/snapshot.npz --datum-dem synthetic --datum-marea synthetic --datum-verificado --avance-horas 3 --pronostico-horas 3
```

Las salidas son `serie_global.csv`, `serie_puntos.csv`, `lamina_final.npy`, `resumen.json`, `snapshot.npz` y `snapshot.json`. El tiempo de `forzamientos.csv` está en horas desde el origen de la primera corrida y debe cubrir íntegramente el avance y el pronóstico, también al reanudar. La lluvia es el promedio del intervalo siguiente; marea y viento se interpolan. Las coordenadas de puntos y sumideros deben estar en el mismo sistema métrico que el DEM.

Para terreno real se exige una máscara de mar `.npy` binaria con igual forma que el DEM `.asc`, además de declarar el datum vertical común con la marea. La máscara evita interpretar toda calle bajo la cota cero como mar. Cambiar el DEM, la máscara, el datum o los parámetros invalida el snapshot. Se guardan hashes para detectarlo.

## Activación en la aplicación

El modelo no alimenta `/api/v1/predecir` ni el visor. Los archivos geográficos actuales usan SRTM EGM96 o cotas visuales hipotéticas; la marea disponible está referida a otro nivel y no hay inventario real de sumideros. Unirlos produciría profundidades sin respaldo físico. La función serverless de Vercel también está limitada a 10 segundos y 1024 MB; una ventana fraccionaria de 7 días sobre 17 000 celdas necesita alrededor de 550 MB solo para el buffer histórico.

Para activarlo hacen falta un DEM/DTM de Manga y máscara de mar en el mismo sistema métrico, transformación vertical comprobada frente a la marea, inventario de sumideros, puntos de lectura y observaciones de al menos un evento. Después se debe validar primero `alpha=1` y luego `alpha<1` contra eventos separados. La ejecución continua deberá correr en un worker persistente y guardar snapshots en almacenamiento duradero; la API consultará el último resultado validado.

El conjunto sintético y los números de sus pruebas verifican el algoritmo, no la exactitud de una predicción para Manga.
