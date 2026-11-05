# Traslado de intención E2 → E3

5 de noviembre de 2026 en Lima, rama `schedule-pt1`. Entorno de aceptación sintético `sum-academic-acceptance` en `127.0.0.1:5280`. Chrome local y API NestJS a través del proxy del proyecto.

## Alcance y decisiones

E1 publica para 2027-I. E2 conserva el ID y la versión exactos en el historial registrado. El corte 2026-1 del estimador describe los antecedentes académicos. El contexto operativo de E3 en Compose sigue siendo 2026-II.

El contrato de traslado usa identificadores de destino E3. El servidor resuelve el curso con `courseCodes` y requiere una correspondencia de sección explícita en el contexto sintético, ligada a la publicación y la versión. Las secciones sin coincidencia, ambiguas, llenas o con horario distinto quedan pendientes. La importación solo prepara una selección editable.

`EnrollmentProfile.academicPolicy` permite que un perfil de servidor compatible use el mismo evaluador para otro periodo. Los umbrales de ponderado se toman del patrón existente y se pueden materializar para una fecha de Lima distinta. El perfil histórico conserva su ruta de evaluación y sus fechas. Las pruebas de 2027-I usan un contexto aislado. La activación operativa de una oferta de ese periodo queda para una etapa posterior.

## Resultados

| Criterio | Comprobación |
| --- | --- |
| Reglas entre periodos | Suite focal de 16 pruebas junto con el traslado. Incluye créditos 11, 12, 26 y 27, excepción y conocimiento insuficiente, prerrequisitos, repitencia, tutoría, cuarta matrícula, cruces, cupo y ventanas por ponderado. |
| Traslado compatible | El servicio recuperó una intención registrada y resolvió una sección de un contexto 2027-I aislado con correspondencia explícita. El contexto de prueba está en `backend/test/e3-intention-import.spec.ts`. |
| Ámbito, sección e identidad | Pruebas de periodo incompatible aun con correspondencia, publicación incorrecta, sección ausente o ambigua, horario distinto, llena, admisión pendiente y sesión. |
| Docker y navegador, API real | El navegador consultó la intención 2027-I frente a la oferta 2026-II. Recibió `SCOPE_MISMATCH` y conservó la selección manual. Se compararon oferta, reporte, publicación e intención antes y después y se comprobó que no se enviara ninguna solicitud de matrícula. |
| Navegador, respuesta compatible controlada | El verificador interceptó solo la respuesta de traslado para comprobar cancelar y confirmar el reemplazo, quitar la sección importada y descartar una respuesta tardía al abrir la confirmación. También restauró una solicitud sintética incierta en `sessionStorage` y comprobó el bloqueo. |
| Regresión integrada | Pasaron `verify-e2-intention.mjs` en fase `resume` y `verify-academic-compose.mjs`, con recuperación E2, consulta escolar, propuesta E1 y matrícula sintética 2026-II con reenvío idempotente. |

## Comandos y límites de verificación

- Backend `vitest run programacion-academica prematricula e3-intention-import matricula-regular test/enrollment-scenarios.spec.ts --exclude '**/*.integration.spec.ts' --maxWorkers=2`. Pasaron 595 de 596 en la primera ejecución. Un caso de orden de causas agotó el límite de 5 s y pasó al repetir su archivo aislado con `--maxWorkers=1 --testTimeout=15000` (5 de 5).
- Frontend `test:data`, 211 pruebas. Contratos y configuración Compose, 32 pruebas. Compilación final en Docker y lint de los dos proyectos aprobados, con cuatro avisos previos de backend en las pruebas de sesión.
- `SUM_E3_SYNTHETIC=1 node client/scripts/verify-e3-intention-import.mjs` pasó con el frontend final. Las suites antiguas de navegador que requieren la instalación de Chromium de Playwright quedan fuera del conteo de Vitest. La verificación de Compose usó el Chrome disponible.
- La primera prueba de navegador preparó la solicitud incierta en el almacenamiento equivocado. Se corrigió el verificador para usar `sessionStorage` y se verificó el bloqueo. La revisión final añadió la invalidación de una consulta pendiente al abrir el selector o la confirmación.

Para activar E3 en 2027-I queda pendiente construir y autorizar una oferta operativa versionada con cupos y ocupaciones propios, asociar sus secciones a una publicación E1 y aportar el calendario y los datos académicos del periodo. La confirmación y el motor de cupos de 2026-II siguen siendo la vía de regresión.
