# Refactor del backend aplicando skills

Fecha: 2026-10-09. Alcance: código NestJS existente de Reportes y Mi Información. Las skills orientaron cambios de estructura y tipos; las respuestas, rutas, valores, errores y selección de fixtures del contrato local se conservaron.

## Reglas aplicadas y cambios concretos

| Regla | Problema localizado | Cambio |
| --- | --- | --- |
| `nestjs-best-practices`: `security-validate-all-input`, `arch-single-responsibility` | `ConsultaReportePipe` y `ConsultaMiInformacionPipe` duplicaban la misma validación de acción, query adicional y cuerpo. Dos copias podían divergir en el orden de error o en el manejo de cuerpos no parseados. | `src/common/readonly-query.ts` contiene ahora `validateReadonlyQuery`, que mantiene el orden `INVALID_ACTION` → `INVALID_QUERY` → `INVALID_BODY`, los mismos mensajes/envelopes y la detección previa de cuerpos con `content-length`/`transfer-encoding`. Los dos pipes conservan sus mapas de rutas/acciones y delegan esa validación. |
| `nestjs-best-practices`: `arch-feature-modules`, `arch-module-sharing`, `arch-avoid-circular-deps` | Reportes aún listaba `/informacion/formularioDatos` en su mapa aunque el único handler está en Mi Información. Mi Información consume la instancia singleton del `ReportesRepository` exportada por `ReportesModule` para compartir el mismo alumno. | `src/reportes/consulta-reporte.pipe.ts` ya solo reconoce las cinco rutas de Reportes. `src/mi-informacion/mi-informacion.module.ts` importa `ReportesModule`, que exporta una sola instancia; no se registra el repositorio en ambos módulos ni se crea un ciclo. Se conserva esta dependencia porque el contrato pide identidad común desde el repositorio real, no una copia. |
| `typescript-advanced-types`: genéricos y tipos indexados | Los repositorios retornaban `unknown` o una unión sin relación estática con la clave; ambos servicios exponían `Envelope<unknown>`. | `src/reportes/reportes.types.ts` define `ReportesDataMap`; `src/mi-informacion/mi-informacion.types.ts` define `MiInformacionDataMap`. Los métodos `read<K extends keyof Map>` y `consultar<K extends keyof Map>` relacionan cada clave con su tipo de datos. La firma de implementación usa la unión del mapa cuando el cuerpo ramifica por clave. Los controladores de Mi Información llaman el servicio con su clave literal. No se requieren aserciones de tipos. |
| `nestjs-best-practices`: `di-prefer-constructor-injection`, `di-scope-awareness` | Los repositorios y servicios dependen de estado de fixtures fijo por proceso; no necesitan estado por solicitud. | Se conservaron providers singleton sin scope mutable por request y dependencias explícitas en constructor, incluida la dependencia de Mi Información hacia el repositorio compartido. |
| `nestjs-best-practices`: `devops-graceful-shutdown` y documentación NestJS de lifecycle | El bootstrap no registraba señales de cierre de Nest. | `src/main.ts` llama `app.enableShutdownHooks()` antes de escuchar. Nest cierra el servidor HTTP y ejecuta sus hooks ante SIGINT/SIGTERM; no se agregaron listeners duplicados ni recursos externos que limpiar. |
| `nestjs-best-practices`: `devops-use-config-module`; `nodejs-best-practices`: configuración validada al límite de proceso | `REPORTES_FIXTURE` y `MI_INFORMACION_FIXTURE` se leen y validan una vez al crear sus repositorios; no existe `@nestjs/config` entre las dependencias instaladas. | Se conserva la validación de arranque existente para los dos valores (`populated`/`empty`) y el fallo ante otros valores. No se agregó módulo/dependencia de configuración, no se cambió el momento de lectura ni se convirtió la selección a parámetros HTTP. |
| `nestjs-best-practices`: `api-use-dto-serialization` | La recomendación general de serialización con DTO de clases no corresponde a estos objetos sintéticos ya definidos por contrato; transformar o filtrar campos podría romper el envelope y los campos heredados. | Se conserva el envelope tipado y las estructuras directas de datos. No hay entidades ORM ni campos internos que deban serializarse/ocultarse; el contrato completo continúa siendo la frontera de salida. |
| `nodejs-backend-patterns`: capas controller/servicio/repositorio; `oxlint` | Era necesario preservar la separación HTTP/datos y comprobar las reglas ya activas del repositorio. | Validación queda en pipes, servicios solo construyen el envelope y repositorios seleccionan/clonan fixtures. Se mantuvo el script configurado `oxlint --type-aware src/ test/`; no se añadieron dependencias ni se ejecutaron suites de Vitest. |

## Invariantes del contrato conservadas

- Solo consultas locales `POST`, rutas/acciones existentes y body ausente o `{}`; prioridad y respuestas 400 se mantienen.
- Formulario de datos sigue atendido una sola vez por Mi Información y conserva su contenido/flags heredados más las secciones existentes.
- `REPORTES_FIXTURE` y `MI_INFORMACION_FIXTURE` siguen siendo independientes y de solo lectura. Se devuelven copias; no se cambió la persistencia en memoria ni el alumno compartido.
- No se añadieron rutas, dependencias, autenticación, ORM, endpoints externos, efectos de escritura ni reglas académicas.

## Comprobaciones de este refactor

- `pnpm --dir backend build` — aprobado tras una reparación de tipos: TypeScript no estrechó el retorno `MiInformacionDataMap[K]` en ramas del repositorio genérico; se añadió la firma pública genérica con implementación de retorno unión, igual que el patrón de Reportes.
- `pnpm --dir backend lint` — aprobado, sin diagnósticos.
- No se ejecutaron suites ni consultas HTTP en esta asignación. La compatibilidad funcional se coteja desde la evidencia local ya existente y la comprobación integrada del orquestador; el proceso activo en el puerto 3000 no se reinició.
