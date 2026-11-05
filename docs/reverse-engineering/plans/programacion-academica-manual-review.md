# E1: revisión manual local — 2026-11-02

Autor del plan y contrato: principal. Fuente: solicitud explícita del usuario (local-only), código y contrato PA-DEMO-1 existentes. No se consultan documentos privados. Complejidad media, impacto medio e incertidumbre acotada. Conservar fidelidad visual/interacción SUM: solo cambia la pantalla administrativa local; matrícula y WeeklySchedule compartido permanecen intactos.

## Contrato incremental

POST `/local/programacion-academica/v1/propuestas/:proposalId/ajustes` (cliente mediante `/api`), con los mismos controles de acceso, origen y JSON de generación. Body exacto: `{expectedVersion,sectionId,sessionIds,teacherId,day,startMinute,roomIds}`. Versión entera >=0; listas no vacías y de igual longitud, IDs únicos de sesiones, día 1–7 y minuto 0–1439. Los sessionIds identifican un bloque completo ya asignado y contiguo, ordenado cronológicamente; roomIds corresponde a cada componente. Para modalidad continua debe incluir toda la sección completa; en split se mueve un bloque existente sin alterar los otros bloques, pero un cambio docente se aplica a toda la sección para conservar responsable único. No se crean sesiones pendientes mediante este endpoint.

Servidor conserva recursos originales (incluyendo nombres/kind), entrada/autoridad original y propuesta automática independiente. Solo acepta asignaciones verificadas contra autoridad original, ventanas generales, duraciones/continuidad y validador existente. Capacidad/disponibilidad se validan por componente. Compatibilidad local conservadora: conservar el kind del ambiente generado para cada componente, cuando esté declarado; no inferir requisitos oficiales por letra de sesión. No modificar ninguna otra sección. Cambios fallidos no mutan nada. Propuesta expirada:404; versión obsoleta:409; entrada inválida:400; restricciones:422. Envelope de error existente `{error:{code,message}}`, mensaje con códigos/recurso/motivo del validador. No se ejecuta nuevamente el generador.

Respuesta AcademicProposal extendida opcionalmente con `editVersion:number` y `manuallyAdjustedSectionIds:string[]` (sin duplicados, pertenecen a secciones). Al generar:0 y []; al aceptar cambio efectivo incrementa versión y marca sección. Preferencias se recalculan, permanecen blandas, sin prometer óptimo global. Estado/diagnósticos de terminación de búsqueda originales conservados; cobertura no se confunde con aprobación. Retención15min existente, sin persistencia nueva.

## Tareas y aceptación

1. Principal: contrato shared/runtime y este plan. Verificar rechazo de payloads malformados y metadatos incoherentes.
2. Worker backend Luna High: solo backend/src/programacion-academica y backend/test/programacion-academica-manual*.spec.ts. Servicio/controller atómicos, validación autorizada y pruebas ERP4 secciones, cambios válidos, cruces, carga, límites, ambientes, autoridad, versión, preferencias y continuidad4/6h. Auditar política actual con escenarios de preferencias; no imponer distribución diaria ni reescribir generador. Build/types/lint/pruebas focalizadas.
3. Worker frontend Luna High: solo client/src/screens/AcademicScheduling*, nuevo AcademicProposalEditor si necesario, client/src/data/academicScheduling*, client/scripts/verify-academic-manual.mjs. Reutilizar componentes/estilos. Quitar columnas solicitadas; distinguir automática/ajustada; panel compacto por bloque con docente habilitado, día, inicio y ambientes por componente; preservar estado anterior y mostrar error al rechazar. Evitar respuestas obsoletas mediante latestIntent/estado pendiente. Pruebas de datos/build/lint. No navegador concurrente.
4. Principal: aceptación integrada sintética en proyecto Docker aislado5280 sin inspeccionar servicio5180 de procedencia desconocida. ERP180/45 cuatro bloques, preferencias, cambio válido y rechazados, coherencia tabla/calendario y oferta matrícula intacta. Reportar resultados reales y límites; sin commits/push/dependencias.

Los workers leen AGENTS raíz/carpeta, skill propia; no delegan. Validar exclusiones codegraph.json antes de init si falta índice/configuración; nunca indexar datos-reales, snapshots privados ni symlinks ajenos. Si perfil TOML no está presente, usar fallback real disponible gpt-6-luna high y declararlo.

## Cierre

Las cuatro tareas quedaron verificadas localmente. Workers reales manual_backend y
manual_frontend, gpt-6-luna/high con fallback del harness por ausencia de TOML; el
principal verificó integración y corrigió expectativas de scripts, sin alterar el
generador. Evidencia, comandos, resultados, incidencias y límites en
`evidence/local/programacion-academica-manual/fullstack-verification.md`.
No se inicializó CodeGraph sin acreditación de exclusiones de symlinks/.pnpm-store.
