# SIM-PUBLIC-1: extensión de despliegue público del simulador

Fecha: 2026-10-19. Estado: implementado y verificado en simulador Docker sintético; publicación externa pendiente. Autor: principal. Resultados y límites en [aceptación integrada](../../../../evidence/local/simulador-produccion/fullstack-verification.md).

Extiende [matrícula regular](matricula-regular.md) y [dashboard](local-profile-dashboard.md); reutiliza sus DTO, validadores y causas. El modo local conserva íntegros sus contratos. Ver [plan y aceptación A1–A12](../../plans/simulador-postgresql-concurrencia.md).

## Identidad y sesión de acceso

Rutas de la API propia bajo `/simulator/auth/v1` (el proxy agrega `/api`):

| Método / ruta | Entrada | Salida |
| --- | --- | --- |
| POST `/login` | JSON exacto `{credential:string}` | 200 `{data:{actorId,campaignId,runId,expiresAt}}` y cookie de sesión |
| GET `/session` | Sin query/body; cookie | 200 misma estructura; 401 si ausente/vencida/revocada |
| POST `/logout` | Sin query/body; cookie | 204, revoca sesión y elimina cookie; idempotente |

`credential`: token aleatorio preemitido, base64url de 32 bytes (43 caracteres), sin espacios ni normalización; nunca incorporarlo en URLs/logs. Persistir hash, no token. Errores de acceso: `{error:{code,fields}}`; 400 `INVALID_REQUEST`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 429 `RATE_LIMITED` con Retry-After. Mensaje 401 genérico para credencial desconocida o inválida. Límites por IP y credencial configurables antes del despliegue, documentados en la corrida k6; no desactivar protección global para pruebas.

`actorId` satisface ID de matrícula regular, `campaignId` y `runId` UUID, `expiresAt` ISO UTC. No devuelve catálogo de otros alumnos. Cookie propuesta `__Host-simulator-session`, Path=/, Secure, HttpOnly, SameSite=Lax, sin Domain, max-age 900; validar origen permitido en operaciones mutantes, incluido login. CORS no permite credenciales de orígenes arbitrarios. TTL de acceso 15 minutos sin renovación por actividad; nuevo login vuelve al mismo actor/campaña. `GET /session` no amplía TTL. Sesiones persistidas/revocables y compartidas por todas las réplicas.

La sesión de acceso autoriza al principal; la sesión académica existente sigue siendo un identificador de operación asociado al actor. Su duración/renovación respeta el contrato de matrícula. Reautenticación permite recuperar resultados aunque la sesión académica haya vencido, sin autorizar un nuevo commit con esa sesión vencida.

## Matrícula y consultas existentes

Conservar rutas `/local/matricula-regular/v1` y sus payloads; el nombre de la ruta no define la seguridad del despliegue. En público todas pasan por autenticación y vinculación al principal. `actorId`, `runId` y `sessionId` enviados se validan, nunca se toman como prueba de identidad. Auth se evalúa antes de buscar/reproducir solicitudes o reportes.

- POST sesiones: solo el actor autenticado en la campaña; no crea alumnos.
- GET contexto, resultado y reporte: solo recursos del principal. Acceso cruzado devuelve 403 para identidad declarada incompatible; un reporte ajeno se oculta como 404 REPORT_NOT_FOUND.
- POST solicitudes: Submission vigente, sin añadir campaignId al DTO; campaña derivada del principal. Nuevos intentos exigen campaña abierta y sesión académica vigente; replay de resultado propio sigue disponible tras cierre.
- GET consultas de dashboard: mismas claves y representaciones, derivadas de PostgreSQL y restringidas al principal. Los validadores que enumeran cuatro actores locales se amplían para IDs sintéticos válidos en público conservando el catálogo local.
- Catálogo libre de perfiles y controles de escenarios/reset no se registran públicamente. La UI pública recibe solo identidad actual, sin ofrecer cambio libre de actor.
- Rutas heredadas de módulos secundarios publicadas reciben el mismo guard y filtros de pertenencia. Inventario y mapeo completo es salida de P1; ninguna ruta queda pública por omisión.

Outcome y HTTP actuales se mantienen: accepted/rejected/configuration-pending retornan 200; SECTION_FULL y ALREADY_ENROLLED son causas de rejected. `REQUEST_CONFLICT` es 409. Error adicional del despliegue: 503 `{runId,error:{code:'STORAGE_UNAVAILABLE',fields:[]}}` para fallo de persistencia/reintentos agotados. Autenticación usa el envelope de acceso descrito arriba; transporte frontend debe distinguirlo antes del validador de matrícula. Ningún 5xx establece por sí mismo que no hubo commit.

## Invariantes y lifetime

`runId` es estable por campaña y no cambia por reiniciar servidor, renovar sesión o escalar réplicas. Deduplicación durable por `(campaignId,actorId,requestId)`, payload canónico vigente y resultado inmutable. Nueva clave para alumno ya matriculado produce rechazo, nunca segunda matrícula. Matrícula, detalles, cupos, request y reporte aceptado se confirman en una misma transacción.

Una campaña agrupa competidores de los mismos cupos. Nuevas campañas son administrativas; no se crean automáticamente al login. Configuración académica inmutable durante apertura. Cierre coordinado con transacciones para excluir nuevos commits posteriores; consultas/replays propios permanecen disponibles hasta limpieza integral de campaña. Token de acceso y credencial no aparecen en reporte ni Outcome.

## Compatibilidad y migración

La incompatibilidad detectada es de garantías: la cola/mapas singleton y el selector público de actor no proporcionan persistencia multiinstancia ni autenticación. Se sustituyen mediante inyección de adaptadores solo en despliegue público; las reglas/DTO y vistas se reutilizan. Adaptadores de PostgreSQL deben exponer lecturas asíncronas consistentes, reemplazando el acceso directo a RunSnapshot en consumidores públicos. No intentar persistir el mapa entero después de cada request ni usar caché de ocupación para decidir aceptación.

P1 fijó la lista de consumidores y ampliaciones mínimas en shared antes de implementar. Pantallas SUM conservan estructura, textos, estilos e interacción; únicamente el acceso temporal introduce la variante local de acceso descrita abajo. La regresión global heredada no está aprobada: consultar el informe de aceptación para los fallos del script y las verificaciones específicas que sí pasaron.

## Precisión de implementación, 2026-10-19

El usuario autorizó ejecutar el plan en un entorno de pruebas aislado antes de publicación. Configuración frontend opt-in: `VITE_SUM_SIMULATOR=1`, `VITE_SUM_DATA_MODE=local`, `VITE_SUM_API_BASE_URL=/api`; los valores por defecto locales permanecen. Pantalla de acceso: reutilizar layout/card/CSS de LocalProfileLogin en /local/login, un campo contraseña «Código de acceso», botón «Ingresar» y nota «Simulador de matrícula · datos sintéticos». No cambiar otras vistas SUM.

Para las comprobaciones loopback puede habilitarse explícitamente `SIMULATOR_INSECURE_COOKIE=1` solo si origen/host es loopback; cookie sin prefijo __Host ni Secure en ese entorno y exclusivamente allí. Publicación exige cookie Secure/HTTPS. No relajar validación de origen. El proveedor frontend no persiste credenciales; /session recupera el mismo principal desde cookie. El catálogo local fijo conserva cuatro perfiles; Identity compartida acepta otros IDs SYN válidos para la campaña pública, nunca autoriza acceso por sí misma.

Seed independiente genera manifiesto sintético privado de operación: `{campaignId,runId,contention,expectedAccepted,actors:[{actorId,credential,selection?}],selection}`. `shared` comparte secciones y espera diez aceptaciones; `distributed` asigna secciones por actor y espera cien. Se guarda fuera de archivos versionados con permisos 0600 y no se imprime. Ninguna de esas credenciales es de SUM. Ese manifiesto permite aprovisionar identidades diferentes a k6 y navegador sin un endpoint público de exportación.

## Inventario P1 y proyecciones públicas

Revisión de consumidores actuales completada por principal antes del handoff de implementación. El módulo público registra únicamente auth, matrícula regular y consultas de dashboard propias. No registra módulos legacy de snapshots. Una consulta autenticada solo proyecta el actor de la cookie, con snapshots consistentes de PostgreSQL; no expone todos los actores ni reportes ajenos.

| Claves de consulta existentes | Fuente sintética persistida / proyector reutilizado |
| --- | --- |
| perfil, formulario, historial, fichaSocioeconomica | ActorProfile de PostgreSQL; projectProfileRead / projectStudent; datos faltantes conservan null/vacío actual, sin fallback a otro alumno |
| matriculaInfo, prematricula | projectContext / projectAcademicRead sobre prematrícula y oferta de la campaña |
| programacion, plan | projectAcademicRead; projectScenarioProgramming cuando exista scenarioData sintético explícito |
| matricula, horarios | EnrollmentReport confirmado del alumno; null antes de matrícula |
| evaluaciones, deudas, asistencias, tutoria | projectProfileRead sobre actor sintético, vacío conocido donde el fixture lo declara |

Los documentos ActorProfile/EnrollmentProfile y oferta conservan sus formas existentes, almacenadas en JSONB para PostgreSQL; cupos, identidad, solicitudes y detalles se modelan relacionalmente. Esto evita reconstruir esquemas privados y permite usar los mismos proyectores. Futuro soporte Oracle requiere adaptar documentos/SQL, no copiar literalmente JSONB. Los campos sin observación SUM siguen siendo decisiones sintéticas propias.
