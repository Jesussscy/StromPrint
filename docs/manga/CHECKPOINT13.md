# Checkpoint13 — línea temporal y lluvia sincronizadas

18 de septiembre de 2026. Incluye el trabajo local del checkpoint12, ahora autorizado para commit por el usuario.

## Corrección

El modo de escenario manual podía permanecer activo después de mover la línea temporal externa. En ese estado el mapa usaba su reloj manual, no la hora del pronóstico. TimelineSlider ahora emite una señal explícita al tocar, usar teclas de navegación, cambiar el valor o reproducir. El mapa vuelve a API, detiene su reloj manual y activa la capa de gotas. También sigue cambios externos de currentHour. Se cubre pulsar nuevamente la misma hora; no sólo cambios de valor.

Se mantiene el valor original de precipitación de forzamiento_espacial: lluvia cero no dibuja gotas; datos ausentes no se presentan como precipitación. La máscara radial hipotética no se aplica al pronóstico. El indicador meteorológico externo basado en puntos del modelo legado puede diferir de esta serie original; el visor identifica explícitamente su lluvia API. No se modificó ese modelo legado.

## Materiales y controles

- Gotas con ancho mínimo de pantalla y longitud legible a distancia, además de una densidad mínima cuando llueve. Es una ayuda visual dependiente de resolución, no tamaño físico de gotas ni entrada de volumen al solver.
- Tejas con juntas y ondulación, filtradas mediante derivadas para reducir parpadeo lejano; variación sutil de acabado vertical en fachadas. Son shaders procedurales, no texturas medidas por inmueble.
- Control de perímetro cartográfico y recorrido orbital lento. El recorrido se desactiva si se solicita movimiento reducido.
- Paisajismo Blender del checkpoint12 incluido: suplemento GLB, instancias, datos de preparación, scripts y render de revisión. El .blend12 editable de 48,69 MB se conserva sólo localmente; puede regenerarse desde .blend08 y scripts versionados. No se agregan copias de seguridad ni cachés.

## Pruebas y despliegue

- Compilación de producción aprobada. Portada 291 kB de primera carga JS (informe redondeado).
- validate_local_rain.cjs, validate_mobile_rain.cjs, validate_timeline.cjs y validate.cjs aprobados.
- En navegador: modo manual, capa de lluvia desactivada → Home en línea temporal: volvió a API con 0,1 mm/h y lluvia activada; avance hasta +2 h: 0,0 mm/h, sin gotas, cálculo +2,00 h. Retorno al inicio y vista de parque verificados. Valores de la consulta vigente durante la prueba, no valores garantizados de futuros pronósticos.
- Controles de perímetro y recorrido accionados; inspección de consola sin errores. Captura visible en conversación. No se atribuye una mejora de FPS a estas modificaciones ni se afirma haber probado un teléfono físico.
- Producción local en http://127.0.0.1:3000, backend existente en 8000. El visor queda en pronóstico API, no en un escenario disfrazado de pronóstico.

## Límites

Persisten la malla hidráulica gruesa y no calibrada, fachadas aproximadas, falta de radar por calle y carga residente de todos los LOD. El paisajismo no equivale a reconstrucción fotorrealista del barrio. La ayuda visual de gotas puede exagerar su grosor en vistas aéreas sin alterar la lluvia numérica.
