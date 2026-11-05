# Prototipo local PA-DEMO-1: ejecución y aceptación

Fecha: 2026-10-29. Rama: schedule-pt1. Autor principal: contrato, registro mínimo
de rutas/módulo y aceptación integrada. Workers reales: academic_api y academic_ui,
gpt-6-luna/high, sin subdelegación, con archivos disjuntos. Contrato compartido:
../contracts/local-api/programacion-academica-demo.md. Decisiones local-only del
usuario, no comportamiento verificado de SUM. CodeGraph CLI no estaba disponible;
se revisó su configuración sin indexar ni instalar herramientas adicionales.

## Implementación

Backend nuevo demo-* y local-main.ts en backend/src/programacion-academica:
catálogo propio de dos cursos, un docente habilitado, aula de 30 plazas, lunes
09–13, una sesión de 60 minutos por sección. API recibe únicamente revisión y
demanda. Reutiliza generador/cobertura consolidados sin cambiar sus reglas.
Retiene entrada original clonada, autoridad y vista en memoria privada: 15 minutos,
20 propuestas; 429 al saturarse, limpieza de expiradas al consultar/crear.
Reinicio elimina propuestas. GET revalida contra el origen retenido del servidor.
No hay aprobación, publicación, autenticación institucional ni persistencia.

Frontend: AcademicScheduling.tsx/CSS y data/academicScheduling.ts. Formulario de
demanda, conteos devueltos por servidor (no recalcula secciones en React), cuatro
estados, diagnósticos, pendientes, tablas y WeeklySchedule reutilizado. Secciones
se presentan como 1/2, no como IDs internos serializados. Datos se validan runtime
mediante shared/programacion-academica-api. Modo local explícito y bloqueo en
VITE_SUM_SIMULATOR=1. Editar demanda invalida la vista anterior. No hay cambios
en menú, pantallas ni lógica estudiantil.

Originales modificados únicamente: backend/src/app.module.ts (import opt-in en
rama no pública), client/src/routes/__root.tsx (excepción exacta opt-in, shell
propio y sin bridge estudiantil en esa ruta) y routeTree.gen.ts (registro generado).
El resto de controles de sesión conserva sus condiciones originales.

## Diagnósticos y correcciones aisladas del principal

El backend worker entregó pruebas pasando con dos errores de tipos pendientes.
Se adaptaron días ya validados del wire al tipo Meeting y se acotó el parámetro
Express string|string[]. También se corrigió el prefijo duplicado /api: lo retira
el proxy Vite y no pertenece al arranque Nest dedicado. El filtro se aplica solo
al nuevo controlador, nunca globalmente a matrícula. GET revalida incluso vacío.

La raíz React produjo un ciclo de inferencia que propagaba errores a router y
StudentForms. Se aisló AcademicLocalShell en archivo propio con retorno explícito;
el build completo pasó sin editar esos archivos originales. Lint raíz también
quedó limpio. No se clasifican esos errores transitorios como defectos previos.

Una prueba nueva de metadatos del AppModule público agotó 5 s al importar módulos
mientras corrían builds paralelos. Se diagnosticó, se fijó límite de 15 s solo en
ese caso y se repitió: 200/200. No se aumentó el timeout global ni se inició PG.

## Verificaciones finales reales

| Comprobación | Resultado |
| --- | --- |
| pnpm --dir backend build | PASS |
| pnpm --dir backend exec tsc -p tsconfig.build.json --noEmit --incremental false | PASS |
| pnpm --dir backend lint | PASS, cuatro warnings preexistentes unbound-method; cero propios |
| pnpm --dir backend test con section-sizing, schedule, generator y demo .spec.ts | PASS, 200 casos: 193 regresiones + 7 API |
| Node --test con los tres .test.mjs consolidados | PASS, mismos 193 casos |
| pnpm --dir client build | PASS, incluye comprobación TypeScript |
| pnpm --dir client lint | PASS, sin warnings |
| pnpm --dir client test:data | PASS, 190 casos: incluye seis nuevos del adaptador |
| node client/scripts/verify-academic-scheduling.mjs | PASS, Chrome real 1440×1000 y Nest dedicado |

Prueba navegador sin datos privados: arranca procesos nuevos en puertos libres,
rechaza adjuntarse a servidores existentes, elimina variables snapshot de sus
procesos hijo y usa solo catálogo del módulo. React → proxy /api → Nest → generador
real, sin sustituir respuestas de generación. Éxito 31/20: 3 secciones/3 sesiones;
cero/cero: vacío completo; 120/20: impossible con pendientes; demanda 100000:
invalid-input. Regenera y comprueba que GET de la primera propuesta sigue idéntico.
Inyecta solo un aborto de red para comprobar error/reintento; la recuperación usa
otra vez servidor real. Comprueba redirección estudiantil a /local/login sin sesión.
Cero errores JS y cero solicitudes externas. Capturas/resultados en
evidence/local/programacion-academica-demo/. No se acredita paridad visual SUM.

search-limit está comprobado en HTTP con reloj sintético controlado y en el
adaptador de cliente; no se forzó ese estado con reloj real en navegador. El
catálogo pequeño puede agotar completamente su dominio antes del presupuesto.

Dependencias del cliente previamente declaradas instaladas con autorización del
usuario: install --frozen-lockfile --ignore-scripts. No se añadieron paquetes ni
se actualizaron manifests/lockfiles. Cachés y dist se conservan. Sin Docker,
migraciones, commits ni push. Los errores históricos de tipos de pruebas backend
globales no forman parte de la aceptación fuente/focalizada y no se repararon.
