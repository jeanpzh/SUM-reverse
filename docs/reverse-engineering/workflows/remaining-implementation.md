# Cierre de pendientes de las 16 rutas

Fecha: 2026-10-08, ejecución local. Encargo: «Realízalo» sobre la tabla de implementación pendiente. Alcance interpretado: completar las conexiones y módulos locales que admiten datos sintéticos y contratos propios. Estados SUM no observados no se atribuyen a la referencia.

## Estado inicial comprobado

- CodeGraph: índice actualizado antes de explorar código.
- `localHttpKeys` ya incluye formulario, los cinco reportes, asistencias e Información de Matrícula; formulario usa HTTP local, pero sus secciones visibles aún se construyen desde catálogos/valores del cliente. Perfil, historial, ficha, programación, tutoría y plan no usan HTTP propio en modo local.
- Manuales usa `tutorialResources` estático y no tiene destinos observados; un backend no aportaría un comportamiento requerido por la evidencia actual.
- Información de Matrícula: verificación posterior completada, 11/11 escenarios integrados y 21/21 pruebas de datos; referencia SUM no comparable.

## Enrutamiento

Se despachó `remaining_scope_plan`, rol nativo `sum-planner` GPT-6.1 Sol High, propietario de `plans/remaining-implementation.md` y `contracts/local-api/remaining-implementation.md`. Debe entregar contratos, tareas y criterios antes de despachar implementadores `sum-implementer` GPT-6 Luna High por carpeta. Principal conserva este workflow e integración; solo un navegador local compartido y máximo dos workers concurrentes con archivos disjuntos. Los agentes cargan skills propias de su carpeta antes del código.

## Pendiente de entrega

Plan Sol High y contrato RI-CONTRACT-1 entregados en los dos documentos asignados. Despachados `remaining_backend` (rol nativo `sum-implementer`, GPT-6 Luna High) y `remaining_client` (rol nativo `sum-executor`, GPT-6 Luna High) con propiedad disjunta backend/client; ambos deben cargar sus AGENTS.md y skills propias antes de código y usar CodeGraph. Implementación, build/lint e integración local de las nuevas rutas en curso. Las brechas de destino real de manuales, acciones de matrícula, calendario de asistencias y estados SUM no observados permanecen `unverified` hasta contar con evidencia autorizada y sanitizada.

Antes de nuevos módulos se guardó una instantánea sintética de los once endpoints existentes en `/tmp/backend-before-remaining-implementation.json` para regresión posterior. El NestJS anterior está en proceso local PID 316967; se reiniciará únicamente después de terminar el nuevo build backend.

## Entrega backend y aceptación HTTP

`remaining_backend`, rol nativo `sum-implementer` GPT-6 Luna High, entregó tres módulos NestJS en sus carpetas exclusivas y registró sus providers en `AppModule`. `pnpm --dir backend build` y `pnpm --dir backend lint`: exit 0 según entrega del worker. El principal detuvo su servidor local anterior y ejecutó el nuevo `dist/main.js` para comprobar el contrato. `evidence/local/remaining-implementation/http-check-results.json`: **6/6 bloques aprobados** (RI-HTTP, RI-INVALID, RI-READONLY, RI-REGRESSION-HTTP, RI-EMPTY, RI-CONFIG). Las once respuestas anteriores mantuvieron status y JSON, incluyendo Información de Matrícula. El script temporal acabó con el backend detenido; integración cliente pendiente.

## Corrección aislada durante la entrega cliente

`remaining_client`, rol nativo `sum-executor` GPT-6 Luna High, reportó build fallido por un alias circular y narrowing de horario, aplicó un ciclo automático acotado y diagnosticó una referencia residual `StudentRecord` en `client/src/data/miInformacion.ts`. El principal consultó CodeGraph, sustituyó exclusivamente esa referencia por el alias propio `MiStudentRecord` y ejecutó `pnpm --dir client build` con exit 0. El contador de reparación automática del worker permanece en uno; el worker continúa sus tareas restantes sin reiniciar el ciclo. `pnpm --dir client lint` había pasado según reporte del worker antes de esta corrección.

## Cierre local

Ambos implementadores entregaron sus archivos. El principal encontró que una respuesta local de Programación sin `alumno.codAlumno` aún se aceptaba, reprodujo el caso y añadió la comprobación del alumno en `client/src/data/transport.ts`. La misma respuesta se rechazó después; build y lint del cliente aprobaron tras la corrección. No se cambió ningún contrato de producción.

La verificación integrada está en [verification.md](../../../evidence/local/remaining-implementation/verification.md): HTTP backend 6/6 bloques, navegador local 5/5 bloques, frontera 7 respuestas válidas y 12 inválidas, CSV 3/3, modo mock 16 rutas sin HTTP, `test:data` 21/21, build/lint de ambas capas y `git diff --check` sin errores. Se reutilizó la aceptación anterior de Información de Matrícula (11/11). Las rutas y efectos comprobados pertenecen exclusivamente a esta réplica con fixtures sintéticos.

REA/CDP observó localmente la carga de Programación y dos respuestas HTTP 200. La captura del clic del modal quedó incompleta por un selector ambiguo en dos intentos; el modal sí se comprobó con el navegador de integración independiente. [rea-behavior.md](../../../evidence/local/remaining-implementation/rea-behavior.md) conserva la limitación. No se inspeccionó SUM de producción.

Estado: implementación e integración local completadas para el alcance RI-CONTRACT-1. Permanecen sin verificar en SUM las reglas de matrícula/cupos/prerrequisitos, filas y acciones de Tutoría, destinos de Manuales, calendario de Asistencias, descargas originales y paridad visual donde faltan condiciones de referencia equivalentes. La simulación de matrícula y el despliegue Cloudflare no forman parte de esta entrega.
