# Plan incremental: una carpeta para todos los snapshots

- **ID:** `all-snapshots-2026-10-09`, revisión1. **Contrato fijo:** [SS-CONTRACT-1](../contracts/local-api/all-snapshots.md).
- **Estado:** listo para Luna High en ingestión/presentación **locales** delimitadas y foto propia; no implementado/verificado por este planner.
- **Planner real:** `sum-planner`, GPT-6.1 Sol High. Escribe este plan/contrato y nota documental de inventario; no implementa, delega, ejecuta pruebas/servidores ni lee privados directa/indirectamente.
- **Objetivo:** consumir los catorce nombres enumerados desde SUM_SNAPSHOT_DIR y permitir carpetas parciales sin fallback synthetic, reutilizando diez lecturas existentes; completar cuatro fuentes nuevas, representación JSON propia de opacos y hook/componente de foto.
- **Clasificación:** complejidad alta (configuraciones, frontend root, repositorios múltiples); incertidumbre alta para campos opacos, delimitada para asistencia/foto; impacto alto (identidad, privacidad, datos descartados y falsas reglas).
- **Reparaciones:** tareas nuevas0/1; conservar contadores previos. Tras un fallo persistente, diagnóstico y decisión concreta; no relajar schema/sustituir fixture para hacer pasar un snapshot.

## Reutilización e incertidumbre que requiere Sol

Conservar MC/MIC/PE y planes Matrícula/MiInfo/Plan implementados previamente; no repetir sus mappings/checks históricos. El contrato agregado fija exclusivamente prioridad de fuentes, missing parcial, cuatro ingestiones nuevas, viewer opaco, contexto root nullable y foto propia. Fuente de inventario es documental; no representa un listado de `datos-reales/` observado.

Asistencias tiene22campos tipados. Evaluaciones/Tutoría solo unknown[], Deudas tipo vacío y Ficha sin candidato: pueden importar/presentar JSON propio, pero carecen de mapping académico completo. La decisión Sol evita convertir DTO synthetic en aliases SUM y hace Formulario opcional como **contexto** cuando SUM habilita carpeta parcial. Es una dependencia arquitectónica real: el root loader actual bloquea rutas independientes si Formulario falta.

La petición expresa componente/hook de foto se añade como unidad independiente. El tipo solo declara foto:string; MIME/formatos admitidos son decisiones locales, sin inspección de imagen privada. Integración únicamente en avatar Profile, desde Formulario validado, sin acceso a urlFoto.

## Invariantes

1. Privados y procesos que los consumen quedan fuera del acceso de agentes; operador arranca y observa. No logs/raw/screenshots/exportes de valores o fotos.
2. SUM_SNAPSHOT_DIR opt-in; env legacy override por scope completo. SUM ausente conserva legacy. No fallback por archivo a otra carpeta/fixture.
3. Fuente aggregate admite faltantes incluso Formulario/Matrícula; missing503 por clave. Presente inválido/config inválida falla seguro; ningún downgrade a opaque tras error tipado.
4. Envelope/extras/orden/duplicados preservados; metadata externa; memoria readonly/copies/reinicio. No escrituras/apis SUM.
5. Typed UI exige schema disponible; opaque viewer presenta JSON sin inventar deuda/tutores/calificaciones/familiares. Tipos futuros requieren revisión explícita.
6. Root solo captura SnapshotMissingError validado de Formulario. Errores de red/parser/schema no equivalen a unavailable. No identidad DEMO/blancos fabricados.
7. Foto solo raster detectado, límite5MiB, URL propia con cleanup, fallback/alt y sin logging/storage/red.

## Ownership y orden

Implementadores **sum-executor o sum-implementer, GPT-6 Luna High**, skills/instrucciones de su carpeta. Máximo dos workers simultáneos, no subdelegación ni reversión de cambios ajenos. B posee backend + nuevos shared explícitamente. C posee todos los archivos cliente existentes necesarios. P posee solo tres archivos nuevos de foto: no toca Profile/Shell.

Orden eficiente: B y P pueden trabajar en paralelo; C empieza tras exports B1 y entrega P1, mientras B completa sus módulos. Ningún otro worker debe tocar transport/contracts/hooks/TableScreens/StudentForms/Profile concurrentemente. Root mantiene guía/workflow y aceptación; workers no cambian contratos/config global/evidencia.

### SS-B1 — Configuración y schemas nuevos

**Estado:** lista. **Dependencia:** SS-CONTRACT-1. **Propiedad B:** crear `backend/src/common/sum-snapshot-config.ts`, `backend/src/common/additional-snapshots.ts`, `shared/additional-snapshots-wire.mjs`, `shared/additional-snapshots-wire.d.mts`. Leer backend/AGENTS y sum-nestjs-implement; apoyos Nest/Oxlint según caso.

**Produce:** `resolveSnapshotSource(scope,env)` discriminado disabled/configured legacy/aggregate, interfaces/schemas exports exactos del contrato. `loadAdditionalSnapshots(directory:string|undefined):AdditionalSnapshots|null`, catálogo readonly parcial de cuatro entradas `{envelope,representation}`; null exclusivamente SUM ausente. `readAdditionalSnapshot(catalog,key)` devuelve disabled/missing/snapshot con clone. Basenames de cuatro fuentes fijos.

- [ ] Resolver SUM/overrides/conflictos; comprobar path absoluto/directorio sin imprimirlo ni listar su contenido. Nuevas lecturas solo SUM.
- [ ] Validator shared de22campos Asistencias sin invariantes de seed; Evaluaciones/Tutoría array JSON; Deudas JSON libre; envelopes/extras/error-safe según contrato.
- [ ] Cargar cuatro nombres una vez, ENOENT missing y presente inválido error; sin defaults/cause/identificadores dinámicos en diagnósticos.
- [ ] Entregar exports y errores seguros a C; revisar que clases/firmas y aliases no contradigan MC/MIC/PE existentes.

**Aceptación:** SS-WIRE, SS-CONFIG, SS-PRIVACY, SS-PRESERVE. Sin dataset privado.

### SS-B2 — Fuentes agregadas para lo ya implementado

**Estado:** lista tras B1. **Propiedad B:** `backend/src/common/matricula-snapshots.ts`, `mi-informacion-snapshots.ts`, `plan-estudios-snapshots.ts`; `backend/src/reportes/reportes.repository.ts`, `reportes.service.ts`, `reportes.types.ts`; `backend/src/programacion/programacion.repository.ts`, `programacion.service.ts`; `backend/src/matricula-informacion/matricula-informacion.repository.ts`, `matricula-informacion.service.ts`; `backend/src/mi-informacion/mi-informacion.repository.ts`; `backend/src/plan-estudios/plan-estudios.repository.ts`. Tipos de esos módulos únicamente si necesita diferenciar partial/source/missing.

**Consume:** resolver B1; **produce:** fuente de cada scope seleccionada antes del loader, opciones allowMissing aggregate, fuente activa distinguida de disabled. ReportesRepository mantiene singleton y getters readonly; agregará `hasMatriculaSnapshotSource():boolean` para que null missing nunca habilite fixture. Esta semántica se propaga por getters/repos de Programación/InfoMat sin modificar sus schemas/mappings.

- [ ] Aplicar prioridad por scope sin path/archivo fallback; legacy explícito conserva requisitos anteriores. MI parse LOCAL_KEYS acepta directorio resuelto desde SUM.
- [ ] Aggregate Matrícula catálogo partial; optionalEN0ENT, getter source activo y servicio503; aggregate MI permite ausencia Formulario; Plan reutiliza missing existente.
- [ ] Snapshot activo no compone datos de fixtures; otros errores/schema vigentes no se relajan. No causa nativa en nuevos diagnósticos.
- [ ] Revisar estáticamente todas las rutas de missing de cinco Matrícula y cuatro MiInfo; impedir antiguo snapshot null→fixture.

**Aceptación:** SS-CONFIG, SS-MISSING, SS-LEGACY, SS-PRESERVE. No repetir implementación core más allá de esta orquestación.

### SS-B3 — Asistencias/Evaluaciones/Deudas/Tutoría HTTP

**Estado:** lista tras B1/B2. **Propiedad B:** repo/service/controller/types de `backend/src/asistencias/`; `backend/src/reportes/reportes.controller.ts` y archivos B2; repo/service/controller/types de `backend/src/tutoria/` más `tutoria.module.ts` para importar ReportesModule si necesita DI. No editar pipes/DTOs/endpoints/app/fixtures.

**Consume:** `ReportesRepository.readAdditionalSnapshot(key)` con unión disabled/missing/snapshot. **Produce:** services/controllers que seleccionan fuente/header/envelope según contrato; fixtures disabled anteriores, faltante503 y snapshot完整 no reconstruido. Tutoría usa ReportesModule existente sin segunda copia del provider.

- [ ] ReportesRepository carga catálogo adicional una vez; Asistencias/Tutoría leen la misma fuente por DI. Estado snapshot no calcula ni lee alumno del seed.
- [ ] Emitir header Additional en las cuatro consultas y conservar actions/routes/pipes; Eval/Deudas no castean opaco a DTO de fila own.
- [ ] Unificar missing seguro key/basename con contrato; mantener envelopes core originales y fixtures con local-v1.
- [ ] Ejecutar `pnpm --dir backend build` y `pnpm --dir backend lint`; registrar resultados/diff. Sin tests, start ni HTTP.

**Aceptación:** SS-ADDITIONAL, SS-MISSING, SS-WIRE, SS-STATIC-B.

### SS-P1 — Hook y componente de foto

**Estado:** lista independiente B/C. **Propiedad exclusiva P:** crear `client/src/data/useStudentPhoto.ts`, `client/src/components/StudentPhoto.tsx`, `client/src/components/StudentPhoto.css`. No Profile/Shell/App.css ni otros archivos. Leer client/AGENTS y sum-react-implement; no delegar.

**Interfaces:** `StudentPhotoState = {status:'ready';src:string} | {status:'empty'|'invalid'}`; `useStudentPhoto(photo:string|null|undefined):StudentPhotoState`; `StudentPhoto({photo,alt,className?})` con photo nullable y alt requerido. Consume strings synthetic o tipo fuente, nunca foto privada. C integra después.

- [ ] Parser de base64/dataURI/MIME firmas exactas/tope5MiB del contrato; unknown MIME/malformed→invalid, sin guesses/URLs/SVG.
- [ ] BlobURL propia desde Effect, cleanup simétrico/change/unmount/StrictMode, evitar mostrar src anterior con input nuevo. React docs consultadas vía Context7 respaldan cleanup, no formatos SUM.
- [ ] Img con alt, icon fallback empty/invalid/onError; CSS mínimo object-fit; sin logging/storage/red/copy/export de foto.
- [ ] Ejecutar `pnpm --dir client build` y `pnpm --dir client lint` para los archivos añadidos; no tests/browser. Entregar interfaces a C sin editar integración.

**Aceptación:** SS-PHOTO. P no reclama que la foto privada renderiza ni que sus formatos fueron observados.

### SS-C1 — Metadatos, missing y contexto opcional

**Estado:** lista tras B1; mismo C llevará C2/C3. **Propiedad C:** `client/src/data/transport.ts`, `contracts.ts`, `additionalSnapshots.ts` nuevo, `snapshotErrors.ts` nuevo, `useStudent.ts`, `useShellStudent.ts`; `client/src/routes/__root.tsx`; `client/src/components/Common.tsx`, `Shell.tsx`; `client/src/screens/Home.tsx`, `Profile.tsx`, `StudentForms.tsx`, `TableScreens.tsx` solo guards/contexto/ramas asignadas. Leer client/AGENTS/skill local.

**Produce:** SnapshotMissingError con code/key; additional representation WeakMap; union ApiResponseMap y `StudentContextState` ready/formulario o unavailable del contrato. Hooks retornan null/contexto unavailable en ausencia; nunca formulario falsificado.

- [ ] Validar missing503 exacto para inventario completo; mantener args MI/Plan y agregar sixth optional additional si necesario. Header additional intercepta parsers seed antes de usar datos.
- [ ] Root captura solo SnapshotMissingError local/formulario; otros fallos siguen error. Metadata/mock anteriores se registran sobre formulario original, no wrapper.
- [ ] Adaptar hooks/consumers enumerados: Home accesos sin identidad, Common override o omisión, Shell disponibilidad, Profile puede mostrar propio snapshot sin nombre/contexto falso; guards de TableScreens y StudentForms sin seed fallback.
- [ ] Ruta `client/src/routes/alumnoWebSum.v2.informacion.formularioDatos.tsx` consulta endpoint cuando root contexto unavailable para su error específico. Ficha opaca se muestra independiente. No ignorar errores de esquema para habilitar contexto.

**Aceptación:** SS-CONTEXT, SS-MISSING, SS-LEGACY. Desbloquea carpeta parcial de forma real; nullable no se propaga sin guard.

### SS-C2 — Pantallas typed y JSON propio

**Estado:** lista tras C1/B1. **Propiedad C:** nuevo `client/src/components/ImportedJsonView.tsx`; data `asistencias.ts`, `reportes.ts`, `tutoria.ts`, `miInformacion.ts`, `adapters.ts`; `TableScreens.tsx`, `StudentForms.tsx` y rutas Asistencias/Evaluaciones/Deudas/Tutoría/Ficha solo para transportar unions/render, sin redefinir endpoint. No otros mappings core.

- [ ] Candidate Asistencias usa schema/mapping del contrato, valores originales y columnas estudiante/periodo propias; local-v1 mantiene tabla/invariantes seed. CSV local rotulado13columnas candidate, calendario disabled.
- [ ] Evaluaciones/Tutoría/Deudas seleccionan viewer por header; Ficha por MI opaque. Render JSON.stringify envelope completo React texto, aviso local; sin DTOs ficticios/CSV/pagos/action/raw logs.
- [ ] Mantener empty typed distinto de opaco/missing; no inferir semántica del array[] opaco. Campos extras continúan en DTO sin filtrado.
- [ ] Garantizar rutas independientes con Formulario null: Programación alumno propio, Historial/Plan mapping vigente, reportes sin semestre inventado. No añadir nueva inspección/fidelidad.

**Aceptación:** SS-ATTENDANCE, SS-OPAQUE, SS-PRESERVE, SS-CONTEXT. Mappings académicos de opacos siguen pendientes hasta tipos sanitizados.

### SS-C3 — Integración foto y checks cliente

**Estado:** lista después C1/C2 y entrega P1. **Propiedad C:** `client/src/screens/Profile.tsx` ya asignado a C; los archivos P solo se consumen, no modifican concurrentemente.

- [ ] Avatar Profile usa StudentPhoto con foto del formulario validado nullable/alt del contexto o genérico; no requerir Perfil para foto ni cargar urlFoto. Contexto unavailable/invalid→icono previo. No foto Shell.
- [ ] Ejecutar `pnpm --dir client build` y `pnpm --dir client lint` tras integración completa; registrar resultados/diff. Si P sigue trabajando, esperar su entrega; no checks concurrentes sobre cambios sin acabar.

**Aceptación:** SS-PHOTO, SS-STATIC-C, SS-PRIVACY. Sin prueba de payload privado.

### SS-R1 — Inventario, guía y cierre root

**Estado:** pendiente implementación. **Propiedad root:** `docs/reverse-engineering/private-snapshots.md`, workflow y actualización estados de este plan/contrato. Planner deja nota de guía que identifica estado planificado, nombres y contrato; root completa operación cuando código/checks existan.

- [ ] Inventario de14basenames/grupos/representaciones es documental, no listado privado. Documentar SUM como una carpeta y overrides completos/ausencia503/tipos/viewer pendientes.
- [ ] Recoger build/lint backend/P/cliente integración y revisar exports/headers/nombres/contexto/privacidad sin datos reales.
- [ ] Registrar que implementación estática no acredita integración/JSONs privados/producción. Operador ejecuta arranque privado; cualquier asistencia requiere tipo/diagnóstico sanitizado sin valores.

## Criterios y escenarios

| ID | Criterio concreto |
| --- | --- |
| SS-CONFIG | SUM opt-in/overrides completos/conflictos/nombres fijos; sin env vacía como ausente ni fallback por archivo |
| SS-WIRE |22campos asistencia por tipo, opacos arrays/JSON solo schema disponible, validators core reutilizados |
| SS-MISSING | Aggregate archivos opcionales503 todas claves, no null→seed; legacy requisitos conservados |
| SS-ADDITIONAL | Cuatro fuentes nuevas enlazadas a endpoints existentes/header/envelope original, DI singleton |
| SS-PRESERVE | Full envelope/extras/list order/duplicates/source immutable/copies; no cambios semánticos por viewer/CSV |
| SS-ATTENDANCE | Contadores/porcentajes recibidos, identidad/periodo por fila, sin fórmula/reglas seed para candidate |
| SS-OPAQUE | Cuatro vistas JSON propias completas, sin semántica/HTML/external links/actions inventadas |
| SS-CONTEXT | Solo missing tipado Formulario desbloquea root; null guards/mensaje/no identity synthetic; rutas independientes disponibles |
| SS-PHOTO | Parser/raster MIME detectado/dataURI match/5MiB, owned URL cleanup/alt/fallback, Profile integration sin logger/private input |
| SS-LEGACY | SUM ausente mantiene env legacy/fixtures/modos; overrides no usan fallback |
| SS-PRIVACY | Sin filesystem privado/proceso/API/browser indirecto ni valores/foto en logs/docs/evidencia |
| SS-STATIC-B/C | Comandos build/lint ejecutados y resultados nuevos registrados; sin test/start/verify |

Escenarios SS-ALL/PARTIAL/OVERRIDE/INVALID/OPAQUE/ATTEND/CONTEXT/REPEAT/LEGACY en contrato son futuros, definidos con actores/archivos sintéticos. Checks de planificación son revisión de cobertura/interfaces/ownership y whitespace de docs. No ejecutar aplicaciones/tests/servidores; no declarar integración ni que todos los archivos privados funcionan. Las restricciones bloquean esa inspección, no esta preparación implementable.
