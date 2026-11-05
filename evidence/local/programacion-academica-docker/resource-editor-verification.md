# E1: configuración administrativa de recursos

Fecha: 2026-10-29. Rama schedule-pt1. Fuente: solicitud explícita del usuario y
seed scenario-reference.seed.ts declarado sintético y autorizado. PDF privado no
abierto. Afirmaciones de esta aceptación: observed/local-only, sin verificación de
reglas SUM institucionales ni equivalencia visual con producción.

## Diseño y archivos

Principal revisó compatibilidad y escribió plan/contrato compartido. Workers
resources_backend/resources_frontend GPT-6 Luna High, archivos disjuntos, sin
subdelegación. CodeGraph no disponible: exclusiones revisadas, sin instalación/init.

- shared/programacion-academica-api.mjs y .d.mts: resources opcional al crear,
  identidades/capacidades/disponibilidades/carga validadas, referenceTeachers y
  teacherName históricos opcionales. Cambios aditivos PA-DEMO-1, sin contratos paralelos.
- backend/src/programacion-academica/synthetic-catalog-adapter.ts: conserva56cursos,
 165secciones y sesiones; IDs locales compartidos para mismo código docente conocido,
  nombres solo cuando fuente sustenta relación nombre/código. Placeholders aislados,
  hasta8 docentes iniciales con nombres de referencia y parámetros sintéticos.
- demo-proposal.service.ts: valida configuración y cursos conocidos, filtra
  habilitaciones a la selección, reutiliza generador/validador y retiene copia
  autorizada por el servidor. Nombres del resultado pertenecen a sus recursos
  configurados; otras ediciones/peticiones no reemplazan una propuesta retenida.
- client/src/screens/AcademicScheduling.tsx/css y AcademicResourceEditor.tsx:
  filtro ciclos, selección conservada aunque oculta, referencia por curso/sección,
  editor docente multicurso/carga/disponibilidad, aulas/laboratorios, pasos1..4,
  invalidación de resultados al editar. Nombres autorizados en tabla/calendario;
  referencia y asignación futura propuesta claramente diferenciadas.
- Nuevas pruebas backend/test/programacion-academica-resources.spec.ts;
  pruebas catálogo/API/shared/cliente y dos scripts de navegador actualizados.
- Plan: docs/reverse-engineering/plans/programacion-academica-resource-editor.md.
  Contrato y guía existentes actualizados. Algoritmo, rutas y Docker intactos.

## Criterio → comprobación → resultado

- Configuración válida y conflictos: pnpm --dir backend test programacion-academica,
  7archivos/216casos aprobados. Incluye193anteriores, recursos compartidos entre dos
  cursos sin cruces, carga0, disponibilidad vacía, capacidad insuficiente, recursos
  vacíos explícitos, IDs duplicados/cursos desconocidos rechazados y propuesta/oferta
  originales conservadas. No se simularon respuestas del generador.
- Comprobación Node de tres suites puras anteriores:193/193 aprobadas.
- Contrato: node --test shared/programacion-academica-api.test.mjs,4/4 aprobadas.
- backend build y tsc -p tsconfig.build.json --noEmit --incremental false: pasaron.
- backend lint: pasó, cuatro advertencias previas unbound-method en
  test/local-profile-session.spec.ts:52,68,89,135; ningún error nuevo.
- client build/lint/test:data: pasaron;193/193 casos de datos cliente.
- Docker propio sum-academic-acceptance en5280, compose.local.yaml --env-file NUL:
  imágenes construidas y contenedores saludables. Puerto/configuración habitual5180
  conservados, sin consultar/interrumpir ese servidor. Sin migraciones/volúmenes privados.
- Navegador real verify-academic-compose.mjs: filtrar ciclos1/2 y preservar selección,
  configurar un docente de referencia para ambos cursos, editar identificación,
  carga/disponibilidad, configurar aula/laboratorio, generar tres secciones/seis
  sesiones completas sin cruces de docente. Nombre de referencia preservado en
  petición/resultado/tabla/calendario. Editar recursos invalida vista; generar otra
  propuesta mantiene lectura original. Cambiar capacidad reduce secciones3→2.
  Oferta antes/después idéntica; matrícula sintética aceptada e idempotente.
- verify-academic-scheduling.mjs con procesos propios3210/5176: pasó selección32,
  filtros, nombres, recursos compartidos, patrones, cobertura, cero demanda,
  impossible, invalid-input, fallo de red simulado/recuperación y guard estudiantil.
  Solo se abortó una petición para la prueba de error; generador real en demás casos.
- Capturas revisadas escuela-cursos.png y escuela-calendario.png; UI local coherente,
  ninguna comparación con SUM oficial. Sin errores JS ni peticiones externas.

Primer intento Docker devolvió correctamente search-limit: la prueba configuraba
9horas disponibles para10horas de sesiones. Principal corrigió únicamente el
escenario de prueba para declarar disponibilidad08:00-18:00 y una carga suficiente;
no cambió algoritmo, presupuesto ni validaciones para forzar éxito. También corrigió
expectativa DOM del filtro: selección oculta se conserva en estado, no en sus filas
renderizadas. La repetición final pasó. No se certifica toda la suite global.

## Límites y siguiente decisión

Solo configuración de demo local sin persistencia; recargar reinicia recursos.
Los nombres del seed autorizado no equivalen a confirmación docente futura.
No infiere disponibilidad ni demanda desde historial/matriculados. Hasta32 cursos,
32docentes y32aulas configurables,32intervalos por recurso; límites de búsqueda
cooperativos previos conservados. Recursos insuficientes pueden terminar en
search-limit, que no demuestra imposibilidad. Tipo laboratorio descriptivo, sin
equipamiento por sesión ni continuidad pedagógica nueva. Franjas generales acotan
la disponibilidad editable. Sin E2/E3, aprobación, publicación ni cambios de matrícula.
Sin nuevas dependencias, cambios de manifests/lockfiles, commits ni push.
