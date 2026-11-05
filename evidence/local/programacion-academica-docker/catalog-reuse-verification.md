# Aceptación E1: reutilización del catálogo sintético

Fecha 2026-10-29. Principal: plan, contrato y aceptación. Workers backend y frontend
GPT-6 Luna High, propiedad disjunta; no delegación adicional. CodeGraph no disponible;
se revisaron exclusiones, sin instalar ni crear índice. Decisión local del usuario,
sin inspección de SUM ni PDF privado. No acredita fidelidad a reglas oficiales E1.

## Archivos y efecto

- backend/src/programacion-academica/synthetic-catalog-adapter.ts (nuevo): importa
  únicamente el seed explícitamente sintético existente, agrupa 165 filas en 56
  cursos, conserva 165 secciones y todas sus sesiones. Mantiene código/nombre,
  ciclo/créditos; convierte HH:mm sin confiar en campos Min que pueden valer cero.
  Rechaza referencias ambiguas y metadatos contradictorios. Devuelve copias.
  No copia nombres/códigos de docentes; usa pseudónimos de referencia.
- demo-catalog.ts: sustituye dos cursos independientes por el adaptador.
- demo-proposal.service.ts: subconjunto seleccionado, capacidad y patrón elegidos,
  verificados contra catálogo del servidor; autoridad original retenida como antes.
- shared/programacion-academica-api.mjs y .d.mts: extensiones aditivas de contrato,
  historial y procedencia, hasta 256 cursos consultables/32 seleccionables. Se
  mantienen límites del generador y se filtran los recursos a la selección.
- client/src/screens/AcademicScheduling.tsx y .css: selección, demanda/capacidad,
  patrón explícito, ciclo/créditos y referencia histórica plegable. Cambiar parámetros
  invalida propuesta anterior. Conserva componentes, tabla, calendario y diagnósticos.
- Pruebas del adaptador/API, datos cliente, contrato compartido y scripts de navegador;
  plan/contrato/guía actualizados. No se modificaron archivos de matrícula/seed.

## Parámetros locales y límites

Referencia sin periodo institucional confirmado. Nuevo periodo identificado como
semestre sintético. Demanda inicial 0/capacidad 30, sin inferirlas de matriculados o
topes. Cuatro aulas sintéticas de 40 plazas, docente sintético por curso, carga
máxima 600 min/semana, disponibilidad lunes-viernes 08:00-18:00, paso de 60 min.
Patrones mantienen cantidad/duración/tipo de sesiones, nunca derivadas de créditos;
no fijan días históricos ni infieren disponibilidad o compatibilidad por ciclo.
Tipos de sesión se conservan en referencia/etiquetas de patrón; no se incorporó una
regla nueva de equipamiento de laboratorio, continuidad ni un docente distinto por
tipo. Esas restricciones requieren especificación futura.

Se ajustó exclusivamente el presupuesto de este perfil sintético de 1.000 a 10.000
exploraciones: caso reproducible de tres cursos necesitó 1.149 y pasó de search-limit
a complete. Algoritmo y límites cooperativos de tiempo/trabajo intactos. No garantiza
solución para toda selección de 32 cursos ni cancelación estricta por reloj.

## Comprobaciones y resultados

- pnpm --dir backend test programacion-academica: 6 archivos, 210/210 casos.
  Incluye 193 anteriores, 9 API, 5 acceso y 3 adaptador. Regresión tres cursos:
  cuatro secciones y ocho sesiones cubiertas.
- Node --experimental-strip-types --test sobre los tres archivos backend
  programacion-academica-*.test.mjs: 193/193.
- pnpm --dir backend build y exec tsc -p tsconfig.build.json --noEmit --incremental false:
  pasaron. Lint sin errores, cuatro advertencias previas unbound-method en
  test/local-profile-session.spec.ts (52,68,89,135).
- pnpm --dir client build, lint, test:data: pasaron, 192/192 casos.
- node --test shared/programacion-academica-api.test.mjs: 2/2.
- node --test scripts/academic-compose-config.test.mjs: 2/2, local/público aislados.
- Docker propio sum-academic-acceptance, compose.local.yaml, SUM_PORT=5280:
  reconstrucción del código final, contenedores saludables. El puerto habitual 5180
  no se inspeccionó ni reinició; configuración principal conserva su valor por defecto.
- Navegador Chrome real, script verify-academic-compose.mjs: selector y estudiante,
  referencia completa de sesiones, dos cursos demanda31/20-capacidad30 → tres
  secciones/seis sesiones complete. Capacidad31 → dos secciones; propuesta antigua
  intacta. Oferta idéntica tras generación, matrícula sintética aceptada e idempotente.
- Script verify-academic-scheduling.mjs con servidores dedicados propios:
  límite de selección32, tres cursos/varios patrones, complete, propuesta vacía,
  impossible por capacidad41 frente a aulas40, invalid-input por demanda enorme,
  recuperación de error de red simulado y control de sesión estudiantil: pasó.
  Las respuestas del generador no se simularon. Sin errores JS ni tráfico externo.

Primer intento del escenario ampliado de navegador alcanzó correctamente search-limit;
se calibró presupuesto y se corrigió la expectativa del número de secciones al añadir
un tercer curso. Se repitieron pruebas sobre el código final. Un intento preliminar
del worker no produjo salida verificable: no se contabiliza ni se atribuyen fallos
globales/preexistentes a ese intento. Solo se certifican los comandos capturados.

Capturas revisadas: escuela-cursos.png y escuela-calendario.png. Pruebas locales
no constituyen comparación visual con SUM. Sin nuevas dependencias, migraciones,
persistencia, aprobación, E2/E3, cambios de Docker en esta etapa, commits ni push.
PDF sin abrir. Los únicos recursos del generador son sintéticos, no identidades
de la referencia ni disponibilidad inferida del horario previo.
