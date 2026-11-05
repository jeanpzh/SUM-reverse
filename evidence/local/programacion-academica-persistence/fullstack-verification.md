# Persistencia E1 — aceptación local

Fecha: 2026-11-04. Rama: schedule-pt1. Clase: observed/local-only.
Prototipo administrativo, no evidencia del SUM oficial. Plan:
`docs/reverse-engineering/plans/programacion-academica-persistence.md`.

## Fuente y aislamiento

Instancia propia `sum-academic-acceptance`, http://127.0.0.1:5280, creada con
`docker compose --env-file NUL -f compose.local.yaml -p sum-academic-acceptance up --build --detach --wait`
y `SUM_PORT=5280`. Solo catálogo e historiales explícitamente sintéticos del repositorio.
No se inspeccionó el servidor del operador en5180, snapshots privados ni PDF.
No se añadieron dependencias ni se ejecutaron migraciones. El simulador público
no recibe la variable ni el volumen de propuestas administrativas.

## Criterios y resultados

| Criterio | Comprobación | Resultado |
| --- | --- | --- |
| Guardar configuración y resultado | React → API: estimar base, editar demanda final, generar y mover bloque completo; guardar listo para revisión | Pasó; base y final distintas, ajuste conservado |
| Evitar sobrescrituras | Segundo escritor avanza versión; guardar desde versión vieja |409; archivo conserva versión nueva y pantalla conserva edición local |
| Cierre de navegador y reinicio | Fase save cierra proceso/browser; `restart backend`; fase resume abre proceso/browser nuevos | Pasó; mismo ID/version de archivo y nueva sesión interna, sin regenerar |
| Restaurar edición | Mis propuestas → desplegar fila → Continuar edición | Pasó; demanda, estado y marca de ajuste manual restaurados |
| Invalidar horarios obsoletos | Cambiar demanda después de recuperar y guardar de nuevo | Pasó; vuelve a borrador, sin resultado; nueva sesión recupera solo configuración |
| Integridad y fallos de disco | Vitest persistencia: corrupción/formato, validación semántica, recursos/configuración, escritura fallida, cuotas |11/11 |
| Bloques, preferencias y revisión manual | verify-academic-manual.mjs, ERP180/45 | Pasó; cuatro secciones, ajustes y rechazos, tablas/calendario coherentes |
| Matrícula aislada | Comparar oferta antes/después de E1; verify-academic-compose.mjs y regresión backend | Pasó; oferta intacta por E1, matrícula válida e idempotente |

## Comandos y resultados

- `pnpm --dir backend test programacion-academica test/matricula-regular-regression.spec.ts test/enrollment-scenarios.spec.ts`:17 archivos,330/330 casos.
- `pnpm --dir backend build`: pasó, también ejecutado dentro del build Docker.
- `pnpm --dir backend exec tsc -p tsconfig.build.json --noEmit --incremental false`: pasó.
- `pnpm --dir backend lint`: pasó sin errores;4 advertencias preexistentes unbound-method en local-profile-session.spec.ts (52,68,89,135).
- `pnpm --dir client build`: pasó (incluye tipos), también dentro de Docker.
- `pnpm --dir client lint`: pasó.
- `pnpm --dir client test:data`:199/199.
- `node --test shared/programacion-academica-api.test.mjs shared/programacion-academica-demand.test.mjs shared/programacion-academica-persistence.test.mjs`:14/14.
- `node --test scripts/academic-compose-config.test.mjs`:2/2, volumen local y aislamiento público.
- `SUM_ACADEMIC_PERSISTENCE_SYNTHETIC=1 node client/scripts/verify-academic-persistence.mjs --phase=save`: pasó.
- `SUM_PORT=5280 docker compose --env-file NUL -f compose.local.yaml -p sum-academic-acceptance restart backend`: pasó.
- Mismo verificador `--phase=resume`: pasó después del reinicio.
- `SUM_ACADEMIC_COMPOSE_SYNTHETIC=1 node client/scripts/verify-academic-manual.mjs`: pasó.
- Mismo entorno, `node client/scripts/verify-academic-compose.mjs`: pasó.
- `git diff --check`: pasó; aviso existente LF/CRLF de routeTree.gen.ts.

Incidencias durante preparación: Docker estaba apagado y se inició Docker Desktop.
El verificador nuevo asumía un curso con un componente y luego usaba un selector
de texto ambiguo. Se corrigió únicamente el verificador: patrón completo existente
y selector exacto. Las dos fases finales pasaron. No se corrigió el generador.

Capturas Chrome1440×1000, ruta /local/programacion-academica, estado local sintético:
phase-save.png (conflicto conservando edición), phase-save-result.png (resultado
ajustado) y phase-resume.png (barra después de recuperar). Son evidencia local,
sin comparación visual con producción. synthetic-draft.json es un checkpoint
de prueba independiente, sin historias ni identificadores de estudiantes.

## Límites

Una instancia backend escritora,50 archivos/2MiB, sin autenticación ni propiedad
por cuenta, sin respaldo/migración automática. Se probó reinicio real de contenedor;
no fallo físico de disco. El volumen preserva archivos al recrear contenedores,
pero se pierden si el operador elimina el volumen. La sesión sin guardar mantiene
su caducidad anterior; recuperar un guardado crea otra sesión sin ejecutar búsqueda.
No hay aprobación, publicación, E2/E3 ni integración con oferta vigente.

## Archivos de esta entrega

Nuevos:
- backend/src/programacion-academica/saved-draft-store.ts
- backend/src/programacion-academica/saved-draft.service.ts
- backend/test/programacion-academica-persistence.spec.ts
- client/scripts/verify-academic-persistence.mjs
- shared/programacion-academica-persistence.test.mjs
- docs/reverse-engineering/plans/programacion-academica-persistence.md
- docs/reverse-engineering/programacion-academica-persistence.md
- docs/reverse-engineering/workflows/programacion-academica-persistence.md
- Este informe y capturas/checkpoint sintéticos en su misma carpeta.

Extendidos respecto al trabajo existente al comenzar esta etapa:
- backend/src/programacion-academica/demo-proposal.service.ts
- backend/src/programacion-academica/demo.controller.ts
- backend/src/programacion-academica/demo-module.ts
- client/src/screens/AcademicScheduling.tsx
- client/src/screens/AcademicScheduling.css
- client/src/data/academicScheduling.ts
- client/src/data/academicScheduling.test.ts
- shared/programacion-academica-api.mjs
- shared/programacion-academica-api.d.mts
- backend/Dockerfile
- compose.local.yaml
- scripts/academic-compose-config.test.mjs
- docs/reverse-engineering/contracts/local-api/programacion-academica-demo.md

Muchos archivos E1 anteriores siguen sin rastrear en Git: «nuevo» en git status no
significa que se haya creado en esta entrega. Los otros cambios rastreados previos
(registro del módulo y rutas locales) se conservaron. No cambiaron package.json,
lockfiles, generador, reglas/ofertas/escenarios de matrícula ni pantallas estudiantiles.
