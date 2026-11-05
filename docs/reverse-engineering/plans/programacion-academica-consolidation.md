# Consolidación de programación académica

Fecha: 2026-10-29. Rama: schedule-pt1. Autor: principal. Fuente: autorización y
requisitos del usuario, decisiones local-only; no se acredita comportamiento SUM.
Se conservan los 23 archivos propios; pueden modificarse, pero no eliminarse.
No tocar originales/configuración, matrícula, pantallas, Docker ni cachés generadas.
Preservar fidelidad visual e interacción: ninguna pantalla tiene cambios autorizados.

## Contrato y migración propios

Cobertura V2: `createCoverageAuthority(originalInput)` deriva y captura requisitos,
secciones y catálogos desde una copia validada de GeneratorInput. Expone solo
`check(schedule)`. `checkSessionCoverage(schedule, originalInput)` es un atajo;
ya no acepta arrays de requisitos. Los consumidores anteriores eran únicamente
el generador y sus pruebas propios: se migran juntos. No afecta APIs existentes.
La entrada original debe ser la fuente confiable retenida por el futuro servidor,
no un documento de demanda reemplazable por el cliente durante una revisión.
Modificar el resultado o la entrada después de crear la autoridad no cambia
los requisitos capturados. Catálogos alterados no pueden relajar reglas.

Límites adicionales: IDs de entrada hasta 80 caracteres, hasta 32 disponibilidades
por recurso y 32 cursos por habilitación/grupo. Se mantienen 32 catálogos/ventanas,
128 secciones/sesiones y 100000 exploraciones. Se controla también el trabajo de
enumeración, incluyendo candidatos repetidos, con máximo 200000 visitas.

Tiempo: opción de ejecución interna maxElapsedMs (defecto 2000, rango 0–5000) y
reloj monotónico inyectable para pruebas. Comprobación entre pasos de enumeración;
se reporta search-limit con limitReason=time/work/explorations. No hay interrupción
de un validador en curso, garantía de tiempo total ni cancelación asíncrona real.
Los límites temporales pueden cambiar resultados según velocidad de la máquina;
la búsqueda sigue un orden estable y es reproducible si no vence ese límite.
La futura API necesita límite de cuerpo HTTP y aislamiento/worker si requiere
cancelación o plazos estrictos. Esta etapa no implementa ninguno de ellos.

## Tareas y aceptación

1. Compartir los 46 casos de etapa 1 entre wrappers Node/Vitest, sin duplicarlos.
2. Eliminar variable sin uso y tipar tablas de casos para corregir tres warnings.
3. Cobertura derivada y snapshot privado: probar omisión de una sección y todos
   sus requisitos, reducción de capacidad/catálogos y mutaciones posteriores.
4. Límites: probar rechazo de exceso/IDs/disponibilidad, fronteras exactas,
   presupuesto de enumeración y vencimiento temporal con reloj sintético.
5. Build, tipos fuente, lint, Vitest focalizado y Node deben pasar. Advertencias
   y errores preexistentes se reportan aparte; no repararlos en esta tarea.

Archivos exclusivos: nuevos del módulo bajo backend/src/programacion-academica,
backend/test/programacion-academica-* y este registro. No se delega: se usa la
configuración actual, sin declarar perfiles ausentes ni trabajadores ficticios.

## Aceptación ejecutada

- `pnpm --dir backend exec tsc -p tsconfig.build.json --noEmit --incremental false`:
  PASS, código 0.
- `pnpm --dir backend build`: PASS, código 0.
- `pnpm --dir backend lint`: PASS, código 0, cero advertencias del módulo.
  Persisten siete advertencias preexistentes (cuatro unbound-method y tres
  no-redundant-type-constituents), sin modificar sus archivos.
- `pnpm --dir backend test test/programacion-academica-section-sizing.spec.ts test/programacion-academica-schedule.spec.ts test/programacion-academica-generator.spec.ts`:
  PASS, tres archivos y 193 pruebas. Las 46 de cálculo ya forman parte de Vitest.
- `node --experimental-strip-types --test --test-reporter=tap backend/test/programacion-academica-generator.test.mjs backend/test/programacion-academica-schedule.test.mjs backend/test/programacion-academica-section-sizing.test.mjs`:
  PASS, 193 pruebas y cero omisiones/fallos. Son los mismos casos, no 386 distintos.

Se mantienen los 173 casos funcionales anteriores (los de cobertura migrados al
contrato V2) y se añaden 20 regresiones. Un primer caso esperaba CATALOG_MISMATCH
pero era rechazado antes por habilitación docente: se ajustó el escenario para
aislar la comparación de catálogos. Un único ciclo de reparación, sin alterar
reglas para satisfacer la prueba. Build/tipos/lint/Vitest/Node finales pasan.

No se instalaron paquetes ni se cambiaron configuraciones. La comprobación global
de tipos que incluye pruebas históricas conserva sus problemas previos; esta
etapa ejecuta la comprobación del código fuente solicitada, no declara reparados
esos errores. No hay nueva verificación HTTP, matrícula o fidelidad contra SUM.

Limitaciones: guardia temporal cooperativa de 2000 ms por defecto, hasta 5000;
maxCandidateVisits interno permite reducir el tope de 200000 para pruebas y
ejecuciones controladas. El tiempo de preparación, un validador en curso y la
cobertura final no son interrumpibles. No se promete plazo máximo total. La
autoridad captura una copia privada, pero la futura API debe retener la entrada
original confiable y nunca aceptar como autoridad un reemplazo enviado por el
cliente. Sin persistencia ni mecanismo de aprobación en esta consolidación.
