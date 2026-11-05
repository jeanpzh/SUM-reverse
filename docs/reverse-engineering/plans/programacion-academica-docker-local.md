# Integración PA-DEMO-1 en Compose local

Fecha: 2026-10-29. Rama schedule-pt1. Autor principal: plan y contrato. Alcance
autorizado por el usuario: integrar lo existente, sin escenario multisesión nuevo.
No abrir/procesar Programacion_Asignaturas (2).pdf ni otros datos privados.

## Decisiones y límites

Reutilizar compose.local.yaml, backend AppModule opt-in, API/generador actuales,
React y proxy /api existente. Docker frontend recibe un ARG con defecto 0 para
VITE_SUM_ACADEMIC_SCHEDULING; solo compose.local lo activa. Backend activa
SUM_ACADEMIC_SCHEDULING=1 y SUM_ACADEMIC_PROXY_HOST=frontend. Las composiciones
pública y del operador no cambian y mantienen el módulo deshabilitado.

Acceso: guardia propia del módulo permite loopback como antes o, exclusivamente
en modo local explícito no público, la dirección resuelta por DNS del servicio
frontend configurado. No aceptar rangos privados completos ni X-Forwarded-For.
El backend no publica puertos en Compose; frontend publica únicamente loopback.
Origen cross-site sigue rechazado. Esto no constituye autenticación administrativa.
No hay cambios al proxy global, matrícula, fixtures, sesiones ni permisos globales.

UI: selector independiente /local/modulos con dos accesos visibles, Estudiante y
Escuela. Cuando la bandera está habilitada, / redirige al selector; en otros modos
conserva destino anterior. Excepción exacta de raíz solo para /, selector y pantalla
académica, sin bridge estudiantil en esas páginas. No agregar entradas al menú del
alumno ni rediseñar pantallas SUM. Preservar fidelidad visual y de interacción de
las interfaces existentes. La pantalla administrativa incluye regreso al selector.

## Archivos y propiedad

Principal: compose.local.yaml, client/Dockerfile, documentación, pruebas de
configuración y aceptación integrada. Backend worker: nuevo demo-access.ts,
demo.controller.ts y pruebas propias de acceso. Frontend worker: helper/rutas raíz,
index, AcademicLocalShell, selector nuevo, CSS y pruebas de helper, routeTree gen.
Workers sin subdelegación, gpt-6-luna/high mediante override real. No CodeGraph
init si CLI ausente/exclusiones no seguras; jamás indexar datos privados/cachés.

## Aceptación

1. Compose config: bandera local en backend/build; no puertos backend ni snapshots;
   configuraciones públicas sin activación. Sin nuevas dependencias ni Dockerfiles
   duplicados ni servicios nuevos.
2. HTTP: a través de Nginx frontend del mismo origen → catálogo/propuesta/consulta.
   Proxy exacto permitido, IP ajena y X-Forwarded-For falsificado rechazados;
   público/cross-site siempre rechazados según alcance. Sin confiar en usuario.
3. Navegador: raíz → selector → Escuela → generar tabla/calendario; regresar →
   Estudiante → login sintético → inicio/programación/información de matrícula.
   No aparece Programación académica en menú estudiantil. Consultas de matrícula
   y datos del actor no cambian tras generación administrativa.
4. Conservar 193 regresiones, API y pruebas frontend; build/tipos fuente/lint.
5. Comprobar Compose real en proyecto sintético propio. Si 5180 está ocupado,
   no inspeccionar ni detener ese servicio: probar en puerto alternativo, declarar
   exactamente cuál y mantener puerto predeterminado 5180 en configuración.
   No iniciar compose.yaml, compose.prod.yaml, migraciones ni bases externas.
