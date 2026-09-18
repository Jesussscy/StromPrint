# Plan de calidad — todo Manga

## Fase 1: arquitectura y materiales, checkpoint 07

Auditoría: el modelo de 1.622 edificios repite vanos cada 3,6 m, cubiertas planas y pintura sin profundidad. El concreto usa una onda sinusoidal regular que produce un damero artificial. La altura mayoritaria de 6 m tampoco describe un levantamiento real.

Implementar perfiles visuales por huella, cubiertas inclinadas contenidas dentro de la huella, parapetos volumétricos, vanos con profundidad, persianas, balcones contenidos, cornisas y equipos. Selección de tipología por etiquetas OSM cuando existan; las asignaciones restantes son aproximaciones deterministas, no inventario patrimonial. Mantener todas las alturas GIS; las cubiertas caben dentro de su altura visual existente.

Casa Román: desarrollar una interpretación arquitectónica de los elementos observables en la foto de Sergio Londoño (2004), CC BY-SA 3.0, y descripción de Rafael López Guzmán (2020): pórtico, arcos, columnas, almenas, tonos ocre y molduras claras. Distribución completa, dimensiones y estado actual NO verificados. Conservar la huella OSM y documentar las proporciones inferidas. No reproducir la foto como textura.

Referencias de ámbito: Comisión Fílmica de Cartagena confirma la mezcla republicana/neomudéjar/moderna y los hitos; el sitio del Club Náutico describe la marina y terraza. Casa Niza/Pombo y los demás hitos requieren correspondencia de huella y fotos antes de modelado específico. No trasladar ornamentos de Casa Román a sus vecinos como si fueran reales.

## Fase 2: espacio público y costa

Enriquecer vegetación, aceras y mobiliario sobre superficies permitidas con control de colisiones. Fuentes por elemento e identidad individual cuando sea posible. Mejorar muelles y borde sin añadir barrios vecinos. Requerirá otro checkpoint y revisión visual.

## Fase 3: fidelidad por inmueble

Mantener inventario de cobertura de referencias para todo Manga. Vincular fotos autorizadas, alturas, techos y fachadas al ID OSM. Revisar desde cámaras equivalentes; registrar diferencias y partes ocultas. La geometría procedural permanece aproximada hasta esta revisión.

## Puertas de revisión

Backup 06 preservado; GIS SHA256 invariable. Cada fase: apertura Blender, validación geométrica/exportación, pruebas backend, tipos/lint/build, revisión escritorio y móvil, imágenes aéreas/costa/urbanas/atardecer/agua. El avance técnico no implica aprobación visual ni fidelidad fotogramétrica.
