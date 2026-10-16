# Mi Información: compatibilidad de snapshots

## Alcance y estado

- Solicitud: preparar frontend React y backend NestJS para consumir respuestas JSON exportadas manualmente de Mi Perfil, Historial Académico, Formulario de Datos y Ficha Socioeconómica.
- Fuente: instrucciones del operador, tipos sanitizados `raw-types/mi-perfil.ts`, `raw-types/matricula-formulario-datos.ts`, `raw-types/historial.ts`, contratos locales existentes y evidencia sanitizada `evidence/sum/mi-informacion/observations-2026-10-08.md`.
- No se accede a `datos-reales/`, ni a sus archivos a través de aplicaciones, APIs, logs o herramientas. El operador iniciará por su cuenta el backend que los consuma.
- No se realiza nueva inspección de SUM ni se ejecutan exportadores de producción. La exportación automática anterior fue abandonada por el operador a favor de exportación manual.
- Complejidad alta: importación, validación compartida, dependencia del alumno en el shell y cuatro pantallas. Incertidumbre alta: no hay contrato JSON SUM de Historial/Ficha ni asociación completa de claves del formulario con controles. Impacto medio: consultas locales de lectura.

## Orquestación

1. `sum-workflow`: inventario mediante CodeGraph y reutilización de evidencia; las cuatro vistas ya consultan la API local.
2. Planificación real: `/root/mi_info_snapshots_plan`, perfil `sum-planner`, GPT-6.1 Sol High. Propiedad: plan y contrato nuevos de compatibilidad.
3. Contrato `MIC-CONTRACT-1` y plan revisión 1 listos. Implementación real backend: `/root/mi_info_snapshots_backend`, perfil `sum-executor`, GPT-6 Luna High, con `backend/.agents/skills/sum-nestjs-implement/SKILL.md`. Incluye propiedad explícita de `shared/mi-informacion-wire.{mjs,d.mts}`; la raíz conserva documentación.
4. Backend entregó los exports MIC-B1 e informó build intermedio aprobado. Se habilitó MIC-C1/C2 al cliente `/root/mi_info_snapshots_client`, perfil `sum-executor`, GPT-6 Luna High, usando `client/.agents/skills/sum-react-implement/SKILL.md`. Los trabajadores tienen archivos disjuntos; solo backend modifica el validator compartido.
5. Revisión estática de la raíz identificó invariantes locales pendientes en MIC-B1 (fecha calendario, enteros seguros, IDs y familiares); se notificaron al propietario para completarlos antes de su entrega. No se ejecutaron pruebas funcionales.

Plan: `docs/reverse-engineering/plans/mi-informacion-compatibility.md`.
Contrato: `docs/reverse-engineering/contracts/local-api/mi-informacion-compatibility.md`.

## Límites de aceptación

El tipo candidate-v1 de Historial permite un mapping directo de campos; no prueba semántica académica ni paridad visual SUM. Ficha continúa sin adaptación candidata. Las estructuras opacas dan un diagnóstico explícito, sin sustitución silenciosa por fixtures sintéticos.

Compilación y lint son las comprobaciones previstas; el usuario no pidió ejecutar pruebas o verificación funcional en esta solicitud. No se certificará integración ni compatibilidad del 100 % desde comprobaciones estáticas.

## Resultado

MIC-CONTRACT-1 implementó la infraestructura base. Al confirmarse que `raw-types/historial.ts` ya estaba guardado, la revisión 2 completó el esquema candidato de Historial y su proyección en React. Build y lint de ambas capas pasaron. No se ejecutaron pruebas, navegador, servidores ni integración HTTP; no se abrió `datos-reales/`. El tipo local respalda el shape candidate-v1, pero no verifica una respuesta de producción ni ofrece compatibilidad del 100 %. Ficha continúa opaca porque aún no tiene tipo candidato.

### Revisión 2: Historial candidate-v1

- Planificación real: `/root/mi_info_snapshots_plan`, perfil `sum-planner`, GPT-6.1 Sol High. Revisó el tipo local y fijó MIC-CONTRACT-2: archivo fijo `historial-academico.json`, candidate-v1 por defecto, local-v1 solo con allowlist explícita, campos requeridos, columnas y límites semánticos.
- Implementación backend real: `/root/historial_backend`, perfil `sum-executor`, GPT-6 Luna High, skill `backend/.agents/skills/sum-nestjs-implement/SKILL.md`. Valida los campos del tipo, selecciona candidate-v1 y conserva el envelope/datos; build y lint exit 0.
- Implementación client real: `/root/historial_client`, perfil `sum-executor`, GPT-6 Luna High, skill `client/.agents/skills/sum-react-implement/SKILL.md`. Proyecta filas de asignaturas y promedios y presenta año/códigos; build y lint exit 0.
- La revisión estática raíz confirmó que el mapping no calcula aprobados, créditos ni promedio global; tampoco interpreta `creditaje` o `criterioCalificacion`. No cambia el mapping `local-v1` existente.
- La fuente del esquema es `raw-types/historial.ts`, tipo sanitizado compartido por el operador. No se consultó el snapshot JSON ni el backend ejecutándose.

### Archivos y cambios

- Shared: `shared/mi-informacion-wire.{mjs,d.mts}`, validación de candidato/local/opaco y error seguro específico.
- Backend: `backend/src/common/mi-informacion-snapshots.ts` y tipos, repositorio, servicio y controller de `backend/src/mi-informacion/`. Lectura de nombres fijos, Formulario obligatorio, opcionales 503, clones y cabecera de representación.
- Client: `client/src/data/{miInformacion,contracts,transport,adapters,useStudent}.ts`, `client/src/screens/{Profile,StudentForms,TableScreens}.tsx` (rama Historial) y ruta Perfil. Las otras tres rutas ya tenían loaders adecuados en el workspace y se conservaron.
- Operación: `docs/reverse-engineering/private-snapshots.md`, nombres de archivos, variables y arranque por el operador. No se modificaron exportadores.

### Diagnósticos y correcciones de la raíz

Cada trabajador reportó un ciclo de reparación de compilación. Backend devolvió un diagnóstico pendiente concreto: import faltante de `MiInformacionDataMap` en repositorio e import sobrante en servicio. La raíz corrigió esos dos imports con las skills locales, sin repetir un despacho de reparación automática.

La revisión estática de la raíz también corrigió puntos aislados: Formulario candidato ignora el extra `secciones` para representación, Ficha local usa su propio alumno en el encabezado, el tipo de Perfil acepta el envelope conservado y el validator local mantiene strings vacíos válidos (incluido foto/urlFoto del fixture sintético) mientras conserva las restricciones de IDs, fecha y enteros. Se evitó una regresión detectable por comparación de código/fixtures; no se ejecutó el fixture ni se acreditó comportamiento runtime. Arrays dispersos ya no eluden la validación JSON.

### Comprobaciones

La raíz ejecutó después de corregir los imports:

| Comando | Resultado |
| --- | --- |
| `pnpm --dir backend build` | exit 0 |
| `pnpm --dir backend lint` | exit 0, sin diagnósticos |
| `pnpm --dir client build` | exit 0 |
| `pnpm --dir client lint` | exit 0 |
| `node --check shared/mi-informacion-wire.mjs` | exit 0 |
| `git diff --check` | exit 0 |

El build cliente se repitió tras el último ajuste del validator compartido: exit 0, Vite construyó 186 módulos. Para MIC-CONTRACT-2, ambos workers reportaron nuevamente build/lint exit 0. `git diff --check` se valida al cierre. No se añadieron ni ejecutaron tests; no se iniciaron servidores, no se inspeccionó el navegador y no se accedió a datos privados. Build/lint no demuestran integración client/server ni compatibilidad del 100 % con respuestas reales.
