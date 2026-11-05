# Integración Docker local de programación académica

Fecha: 2026-10-29. Rama verificada: schedule-pt1. Autor del plan y aceptación:
principal. Implementación: workers academic_api y academic_ui, archivos disjuntos;
principal: composición, argumento Docker, prueba integrada y documentación.
Fuentes: solicitud explícita del usuario y contratos/código locales. Decisiones
local-only; no se inspeccionó producción ni el PDF privado 2026-II.

## Resultado y criterios

- compose.local.yaml habilita módulo y frontend; argumento de imagen desactivado
  por defecto. Configuración pública sin habilitación: 2 pruebas Node aprobadas.
- Selector separado en /local/modulos; menú y pantallas estudiantiles conservados.
- API accesible por proxy existente /api; acceso desde IP DNS exacta del servicio
  frontend, nunca por una subred entera ni por encabezados aportados por cliente.
- Navegador real: selector → estudiante sintético → pantallas de matrícula →
  escuela → POST → generador → complete, tres secciones, tabla y calendario.
- Oferta idéntica antes/después de generación. Matrícula sintética aceptada,
  repetición idempotente y ocupación incrementada solo en secciones matriculadas.
- Sin errores JavaScript ni peticiones externas en ese recorrido. No acredita
  equivalencia visual con producción ni cobertura de todos los flujos estudiantiles.

## Verificación ejecutada

- docker compose --env-file NUL -f compose.local.yaml -p
  sum-academic-acceptance up --build --detach --wait, SUM_PORT=5280: imágenes
  compiladas, ambos contenedores saludables. Puerto 5180 ocupado: no se consultó
  ni detuvo ese servicio. Configuración entregada mantiene 5180 por defecto.
- pnpm --dir backend build: pasó.
- pnpm --dir backend exec tsc -p tsconfig.build.json --noEmit --incremental false: pasó.
- pnpm --dir backend lint: sin errores, cuatro advertencias preexistentes
  unbound-method en test/local-profile-session.spec.ts (52, 68, 89, 135).
- pnpm --dir backend test programacion-academica: 205/205 (193 lógica, 7 API, 5 acceso).
- Node --experimental-strip-types --test sobre los tres archivos
  programacion-academica-*.test.mjs del backend: 193/193.
- pnpm --dir client build, lint y test:data: pasaron; 191/191 casos de datos.
- node client/scripts/verify-academic-compose.mjs, bandera sintética explícita:
  pasó contra http://127.0.0.1:5280. Primer intento falló por selector de texto
  inexistente en la prueba; se corrigió ese selector, sin cambiar la pantalla.

Capturas y resultado: evidence/local/programacion-academica-docker/.
Se mantienen los archivos previos, sin dependencias nuevas, cambios de lockfiles,
migraciones, commits ni push. La instancia sintética de aceptación queda disponible
en 5280; el operador puede detenerla con compose -p sum-academic-acceptance stop.
Para actualizar su ejecución habitual usar el comando autorizado en 5180.

## Límites

Prototipo local sin autenticación administrativa institucional, aprobación ni
persistencia. Propuestas en memoria; datos sintéticos pequeños sin ampliación de
sesiones. No se modificaron lógica, fixtures, cupos ni servicios de matrícula.
El simulador público no se desplegó; aislamiento verificado por configuración,
banderas y pruebas del registro/control de acceso, no mediante despliegue público.
