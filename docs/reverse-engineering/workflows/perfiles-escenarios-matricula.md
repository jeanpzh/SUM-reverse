# Perfiles y escenarios sintéticos de matrícula

Inicio de revisión: 2026-10-15. Plan e implementación: 2026-10-16 (America/Lima). Estado: completado en el alcance sintético local.

## Encargo y fuentes

Generar perfiles y escenarios realistas de matrícula reutilizando `datos-sinteticos/` y los contratos locales. El operador confirmó expresamente en esta sesión que la carpeta es íntegramente sintética y no contiene datos privados. Esta confirmación es testimonio de procedencia, no verificación de comportamiento SUM. No se accedió a `datos-reales/`, servidores del operador ni producción, ni se ejecutó el generador que lee entradas privadas.

Revisión estática local: nueve JSON; ocho parsean. `formulario-datos-matricula.json` no es JSON válido (línea 20, columna 27). Se conserva sin modificar; no debe ser dependencia de generación. El catálogo contiene 97 filas/85 cursos distintos y la programación 165 filas/56 cursos distintos. Los contadores describen únicamente este conjunto sintético, no SUM.

Reutilizar los contratos MR y LPD, las cuatro identidades existentes y el plan [PS-1](../plans/perfiles-sinteticos.md). Conservar la fidelidad visual y de interacción SUM y las interfaces existentes. No se autorizan cambios de pantallas para esta tarea. Reglas, horarios, autorizaciones y resultados construidos serán `local-only`; no acreditan normativa ni comportamiento de SUM.

## Enrutamiento y aceptación

Complejidad media: coherencia entre historial, oferta y estado académico. Incertidumbre media: datos de entrada parciales y necesidad de resultados aislados por escenario. Impacto medio: únicamente fixtures y arranque local explícito; contratos HTTP e interfaz existentes deben conservarse.

Planificador delegado mediante override efectivo `gpt-6.1-sol`, esfuerzo `high`, rol `sum-planner`; archivo exclusivo [plan de escenarios](../plans/perfiles-escenarios-matricula.md), PEM-1 listo. Los TOML `.codex/` figuran eliminados en el árbol de trabajo previo; no se restauran ni se afirma haber usado un perfil TOML disponible. Implementación asignada secuencialmente mediante override efectivo `gpt-6-luna`, esfuerzo `high`, rol `sum-implementer`, tareas PEM-B1/B2/S1 y archivos exclusivos del plan, más `scripts/enrollment-scenarios.test.mjs` autorizado para pruebas del loader en temporales sintéticos. Ningún worker puede subdelegar.

El coordinador agregó el adendum semántico PEM-1 al contrato LPD antes de despachar implementación. No modifica el wire HTTP. Nueve paquetes previstos: regular, repitencia, tutoría, prerrequisito, cruce, cupo, deuda, horario desconocido y prioridad de repitencia. Cada paquete conserva cuatro actores y define cuatro casos; la variante se activa expresamente y conserva PS-1 por defecto.

Acreditar generación reproducible, coherencia de perfiles, aislamiento de escuela y escenario, resultados del motor local y uso desde el arranque aislado. Ejecutar build/lint y pruebas focalizadas con fixtures sintéticos; no afirmar integración React/NestJS ni fidelidad visual sin escenarios comparables realmente ejecutados. Detalle de criterios y archivos: plan enlazado.

## Resultado

Implementados PEM-B1/B2/S1 y verificación PEM-V. Se generaron [nueve paquetes y guía de perfiles](../../../evidence/local/perfiles-escenarios-matricula/generated/README.md), cada uno con cuatro actores. El launcher acepta `--scenario`; sin argumento preserva PS-1. Se mantienen pantallas, motor y wire. [Verificación](../../../evidence/local/perfiles-escenarios-matricula/verification.md): build y lint backend pasan (cinco warnings ajenos), 27 pruebas Vitest y dos Node pasan; 36 casos HTTP producen 16 accepted, 16 rejected y cuatro pending. La regeneración conserva los diez archivos byte por byte. Smoke de arranque/proxy regular pasó; proceso propio detenido. Sin nueva inspección de referencia ni navegador; no se acredita integración React ni paridad visual.

Reparaciones: un ciclo del harness del coordinador por ruta incorrecta del smoke (404); corregida contra el controlador, sin cambios de aplicación. No hubo más ciclos automáticos. La contradicción de diseño PEM-1a se resolvió explícitamente como se detalla abajo.

Decisión PEM-1a: el worker encontró mediante HTTP que la selección de prioridad B también incumple el prerrequisito C07→C11. Se corrigió el oráculo del plan para conservar las tres causas simultáneas, sin modificar motor, ledger ni selección. Se trata de una contradicción de planificación diagnosticada y resuelta explícitamente, no de una relajación de reglas ni de una causa ocultada para aprobar el test.

## Corrección aislada: `spawn pnpm ENOENT`

El usuario reportó que el lanzador no podía crear el proceso `pnpm --dir backend build`. El principal aplicó `systematic-debugging` y consultó documentación Node mediante Context7: `spawn` busca el comando usando PATH y emite ENOENT si no lo encuentra. Se reprodujo exactamente con un test de arranque real que suministra `PATH=''`, sin snapshots ni variables heredadas. CodeGraph e índice existentes revisados; no se reindexó.

Corrección pequeña realizada directamente por el principal: `scripts/start-local-profile-dashboard.mjs` resuelve la CLI Nest instalada desde `backend/package.json` y la ejecuta con `process.execPath`, `cwd=backend`, igual que el patrón existente para Vite. El script build actual es `nest build`; se conserva esa operación. No depende de un ejecutable pnpm al arrancar. No se instalaron dependencias ni se cambiaron pantallas, reglas o contratos.

Aceptación: `node --test scripts/start-local-profile-dashboard.test.mjs scripts/enrollment-scenarios.test.mjs` pasó 3/3 pruebas. El nuevo test falló antes con el mismo ENOENT y pasó tras la corrección: compilación real, arranque backend/Vite, catálogo de cuatro perfiles por proxy y documento login HTTP200 con PATH vacío; cierre limpio del proceso propio y sus hijos. `node --check` de lanzador y test, y `git diff --check` focalizado pasaron. Un ciclo de corrección de este fallo nuevo; sin reparaciones adicionales. No se abrió navegador ni se acreditó comportamiento en otros sistemas operativos.

## Corrección aislada PEM-1b: prematrícula coherente con prerrequisitos

El usuario precisó que la matrícula toma sus cursos de la prematrícula ya validada. Se registró como testimonio T-PEM-PRE y requisito de la simulación, sin promoverlo a observación de producción. CodeGraph permitió confirmar que los componentes ya consumen la misma prematrícula; la inconsistencia estaba en la lista fija del seed. El principal aplicó `receiving-code-review`, `systematic-debugging`, `test-driven-development` y la skill local disponible `backend/.agents/skills/sum-nestjs-implement/SKILL.md`, con apoyos Vitest/Oxlint. La skill raíz de workflow previamente leída en esta conversación ya no se encuentra en disco; no se restauró ni se inició una nueva etapa de funcionalidad. Se usó la excepción de corrección aislada diagnosticada del AGENTS raíz, conservando asignaciones y restricciones previas.

Se corrigió solo la generación sintética: A expone C09–C12 y B C07–C10, ambos en prematrícula y matrícula. C13 queda fuera por prerrequisito no aprobado. El envío negativo de C13 se conserva únicamente como prueba HTTP ajena al selector; prioridad B usa ahora C08,C09,C10 y omite C07. Plan y contrato documentan el ajuste; se regeneraron los nueve paquetes y guía. Sin cambios de interfaz, motor, wire, PS-1 por defecto ni datos de origen.

Aceptación: regresión roja antes del cambio y verde después; build y lint backend pasan (cuatro warnings ajenos, cero errores); 27 pruebas focalizadas pasan con los 36 casos HTTP y lectura de las dos proyecciones. Ejecución de adaptadores cliente para 36 perfiles/escenarios confirma misma lista y C13 excluido; [resultado](../../../evidence/local/perfiles-escenarios-matricula/prematricula-coherence.json). Dos generaciones dejan los diez archivos byte por byte iguales. Sin navegador ni afirmación de integración React completa. No se requirió una reparación adicional tras la comprobación final de esta corrección.
