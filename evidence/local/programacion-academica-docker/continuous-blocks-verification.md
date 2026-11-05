# E1: bloques continuos y ambientes de referencia

Fecha2026-10-29. Rama schedule-pt1. Principal: diagnóstico/plan/contrato/API/catálogo
y aceptación integrada. Workers blocks_core y blocks_ui: GPT-6 Luna High, archivos
disjuntos, sin subdelegación. CodeGraph no disponible; exclusiones revisadas, sin
instalación ni índice. Fuente: petición funcional y catálogo de ambientes del
usuario, referencia docentes/académica del seed explícitamente sintético autorizado.
No PDF/snapshots/datos-reales. Fuente testimonial/local-only, no norma institucional.

## Diagnóstico y cambio

Antes: búsqueda independiente por sesión, sin garantizar día único, continuidad ni
responsable único. Se reutilizaron dimensionamiento, validateAcademicSchedule,
coverage authority, retroceso determinista y límites. Ahora se decide por sección
continua y se recorren ambientes por componente de forma perezosa; split es explícito
y también conserva docente. La comprobación de cobertura no acepta una programación
fragmentada/reordenada/multidocente como completa por tener todas las sesiones.

Archivos principales:
- backend/src/programacion-academica/generator.types.ts, generator-input.ts,
  schedule-generator.ts, session-coverage.ts y nuevo section-delivery.ts.
- Nuevo reference-rooms.ts, adaptador de catálogo y demo-proposal.service.ts.
- shared/programacion-academica-api.mjs/.d.mts y pruebas del contrato.
- AcademicScheduling.tsx/css, AcademicResourceEditor.tsx y academicScheduling.ts/tests;
  scripts locales de navegador, tests de generador y nuevas pruebas API/ambientes.
- Plan docs/reverse-engineering/plans/programacion-academica-continuous-blocks.md;
  contrato y guía existentes actualizados. Sin cambios de Docker en esta etapa.

## Criterios y resultados observados

- pnpm --dir backend test programacion-academica:9archivos,231/231casos pasaron.
  Incluye bloques4h18-22 y6h08-14; orden/tipos conservados; responsable único;
  ambientes distintos por componente con capacidad verificada; split en días
  separados con docente único; retroceso, cobertura alterada rechazada y límites.
- Nuevos casos API confirman modo continuo predeterminado, nombres preservados,
  patrones existentes4/6h, split explícito cuando no hay bloque4h, revisión retenida
  inmutable y rechazo de sección46para laboratorio45.
- Catálogo:49IDs exactos, AP28/NP21,33aulas/16laboratorios; capacidad45 y sin afirmar
  disponibilidad de referencia. Copias independientes. Cuatro activos iniciales,
  máximo32 configurables por propuesta; roster49 completo consultable.
- Node --experimental-strip-types --test (tres suites puras):203/203pasaron
  (46dimensionamiento,67validador,90generador). Casos previos que comprobaban
  fragmentación parcial se adaptaron a split explícito; se añadieron10casos nuevos
  de generador, sin retirar las regresiones anteriores.
- Backend build/tsc --noEmit --incremental false: pasaron. Lint sin errores;
  cuatro advertencias previas unbound-method en local-profile-session.spec.ts
  líneas52,68,89,135. Cliente build/lint/test:data: pasaron,193/193casos.
- shared/programacion-academica-api.test.mjs:4/4pasaron (incluye modalidad inválida).
- Docker: compose.local.yaml, proyecto propio sum-academic-acceptance, puerto5280,
  --env-file NUL y fuentes exclusivamente sintéticas; imágenes compiladas,
  contenedores saludables. Configuración habitual5180 intacta; servidor existente
  no consultado ni reiniciado. No migraciones ni instalaciones de dependencias nuevas.
- verify-academic-compose.mjs navegador real: catálogo49/IDs/capacidades; selección
  de cursos de ciclos1/2; ambientes de referencia aula/laboratorio y disponibilidad
  editada; propuesta completa3secciones/6componentes, cada sección un día, adyacencia
  exacta y docente único; nombres visibles en tabla/calendario. Cambio explícito
  a split mantiene responsable y lectura original. Cambiar recursos/capacidad invalida
  vista previa y regenera. Oferta antes/después igual, matrícula sintética aceptada
  e idempotente, ocupación modificada solo por esa matrícula. Menú estudiantil intacto.
- verify-academic-scheduling.mjs: procesos dedicados propios3210/5176; pasó generación
  real, patrones, cero demanda, impossible, invalid-input, propuesta retenida,
  error de red simulado/recuperación y guard estudiantil. No respuestas simuladas del
  generador. Sin errores JS ni tráfico externo en ambos recorridos.
- Capturas escuela.png/escuela-calendario.png revisadas: resultado completo, tipos
  visibles y componentes contiguos. Aceptación visual local, sin comparación con SUM.

## Alcance de afirmaciones y límites

Las pruebas de4h/6h se ejecutaron con recursos configurados para esas franjas, no
con disponibilidad histórica inferida. Estado impossible significa dominio finito
declarado agotado; search-limit nunca se presenta como prueba matemática. Mensajes
específicos solo para condiciones necesarias comprobadas; otros señalan restricciones
observadas sin atribuir causa única. Tiempo cooperativo, no cancelación estricta.
Cuadrícula de inicio del bloque según startStepMinutes; componentes conservan sus
duraciones exactas. Un ambiente puede cambiar sin hueco entre componentes: no se
modeló tiempo de traslado/equipamiento ni se impuso laboratorio por tipoL.
Configuración/propuestas no persistentes, sin aprobación/publicación/E2/E3.
No se modificaron datos, reglas ni servicios/pantallas de matrícula. Sin commits/push.
