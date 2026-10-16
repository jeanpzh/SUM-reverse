<!--
Sync Impact Report
Cambio de versión: plantilla sin versión adoptada → 1.0.0 (adopción inicial).
Principios definidos:
- I. Fidelidad conductual.
- II. Trazabilidad normativa.
- III. Incertidumbre explícita.
- IV. Configurabilidad por facultad y periodo.
- V. Protección de datos e inspección autorizada.
- VI. Reutilización del código y los contratos existentes.
- VII. Verificación mediante pruebas.
Secciones añadidas: Alcance y restricciones; Flujo de trabajo y aceptación;
Governance con procedimiento de enmienda y revisión de cumplimiento.
Secciones eliminadas: ninguna sección de gobierno previamente adoptada.
Dependencias: las plantillas y comandos leen esta constitución en ejecución;
no se modificaron plantillas, skills, AGENTS.md ni código de aplicación.
TODOs o valores pendientes: ninguno.
Este informe es material temporal de revisión: retirarlo antes de hacer commit.
-->

# SUM-reverse Constitution

## Core Principles

### I. Fidelidad conductual

La réplica DEBE reproducir únicamente comportamientos observables respaldados por evidencia
suficiente para el alcance solicitado, o decisiones locales identificadas expresamente como tales.
Cada escenario DEBE describir precondiciones, acción, resultado visible, navegación y efectos
conocidos; los vínculos no observados DEBEN permanecer pendientes. Las comparaciones visuales
DEBEN alinear ruta, viewport, desplazamiento, contenido y estado de interacción.

La fidelidad visual, la fidelidad conductual, el cumplimiento normativo y la integración local
DEBEN evaluarse por separado. Una simulación local o un contrato propio NO DEBEN presentarse
como paridad del SUM. Ninguna reconstrucción DEBE atribuir una arquitectura, algoritmo de cupos,
transacción o mecanismo de persistencia al backend privado del SUM.

### II. Trazabilidad normativa

Cada regla académica DEBE enlazar una fuente identificable y registrar autoridad emisora,
artículo o apartado aplicable, edición, fecha, vigencia, facultad y periodo cuando correspondan.
Las especificaciones y criterios derivados DEBEN conservar esa referencia. Una disposición
normativa acredita un requisito publicado; NO acredita que la interfaz SUM lo implemente ni
cuándo lo valide.

La documentación en `docs/domain/fisi/2026-II/` DEBE utilizarse dentro de su ámbito y con sus
preguntas pendientes. La documentación histórica DEBE revisarse antes de reutilizarla: su
antigüedad, procedencia, estado de verificación y correspondencia con los contratos y código
actuales DEBEN quedar explícitos. Las contradicciones entre fuentes DEBEN conservarse como
discrepancias; NO DEBEN resolverse mediante una elección silenciosa o una regla inventada.

### III. Incertidumbre explícita

Toda afirmación DEBE distinguir su clase de fuente de su estado de verificación. Las clases
son evidencia normativa (`normative`), evidencia observada (`observed`), testimonio (`testimony`)
e inferencia (`inferred`). Un relato sin captura o traza DEBE mantenerse como testimonio,
incluidos los registros históricos rotulados `Observado-testimonio`. Los desconocidos DEBEN
marcarse `unverified`; las decisiones de la réplica DEBEN marcarse `local-only`.

Una hipótesis, testimonio, norma o prueba local aprobada NUNCA DEBE transformarse en
comportamiento confirmado del SUM. Una confirmación conductual DEBE aportar evidencia observable
sanitizada, condiciones de observación y revisión registrada, conservando la procedencia original.
Las especificaciones DEBEN mantener un listado de incertidumbres y su efecto en la aceptación.
Los niveles N0–N3 del dossier FISI DEBEN utilizarse cuando apliquen, sin elevar simulación o
fidelidad normativa a paridad observable. Los textos no capturados NO DEBEN declararse literales.

### IV. Configurabilidad por facultad y periodo

Las reglas académicas de la réplica DEBEN ser configurables y versionadas por facultad y periodo.
Escuela, programa, plan, modalidad, calendario, turnos, límites y excepciones DEBEN formar parte
del perfil cuando el requisito lo demande. Cada perfil DEBE registrar fuentes, vigencia,
versión y estado de verificación; DEBE separar reglas comunes de variantes particulares.

Los valores FISI 2026-II NO DEBEN convertirse en valores universales ni reutilizarse para otra
facultad o periodo sin revisión. Un perfil ausente o una regla ambigua DEBE producir un pendiente
explícito; NO DEBE activar silenciosamente un perfil ajeno. Las pruebas de cambios en perfiles
DEBEN demostrar aislamiento entre facultades y periodos, límites y excepciones aplicables.
Esta configurabilidad es una decisión de diseño local y NO demuestra un motor equivalente en SUM.

### V. Protección de datos e inspección autorizada

Todos los agentes y workers DEBEN respetar las exclusiones de `AGENTS.md`, incluida
`datos-reales/`. Está prohibido leer, listar, buscar, indexar, copiar, modificar o utilizar datos
privados, y acceder a ellos indirectamente mediante aplicaciones, respuestas HTTP, navegadores,
REA, MCP, capturas, cachés o logs. Los agentes NO DEBEN iniciar ni inspeccionar servicios con
snapshots privados, ejecutar exportadores productivos o generadores que lean entradas privadas.
El operador DEBE suministrar reproducciones sintéticas o evidencia previamente sanitizada.

La inspección de SUM productivo con REA o Playwright está permitida únicamente cuando el
solicitante declare explícitamente que el entorno/cuenta está autorizado y delimite pantallas
y acciones, conforme a `AGENTS.md`. Esa declaración basta; las credenciales o una sesión abierta
por sí solas NO bastan. El agente DEBE registrar alcance, fecha y vencimiento si existe, y
mantener la inspección en solo lectura. Las observaciones de red requieren alcance explícito.

Está prohibido matricular, enviar formularios, cambiar datos, subir archivos, eludir controles,
enumerar cuentas, inspeccionar funcionalidades administrativas no autorizadas o internos privados.
NO DEBEN capturarse ni conservarse cookies, tokens, credenciales, cabeceras de autorización,
identificadores personales o respuestas sensibles. La autorización de inspección NO habilita
acceso a datos privados ni pruebas o experimentos contra producción. La restricción de una
observación NO DEBE bloquear trabajo independiente con evidencia segura y fixtures sintéticos.

### VI. Reutilización del código y los contratos existentes

Antes de crear contratos, componentes, DTOs, validadores, adaptadores o módulos, el agente DEBE
revisar los artefactos pertinentes y reutilizar o extender los compatibles. Las referencias
incluyen `docs/reverse-engineering/contracts/local-api/`, `shared/`,
`client/src/components/`, `client/src/data/` y los módulos existentes en `backend/`.

Una sustitución DEBE justificar la incompatibilidad y documentar consumidores, revisión del
contrato, migración y pruebas necesarias. NO DEBEN mantenerse contratos o componentes paralelos
para el mismo comportamiento sin una necesidad explícita y delimitada. La reutilización DEBE
respetar validación en ejecución, propiedad de carpetas y separación de vista, acceso a datos,
lógica y persistencia. El cliente local DEBE consumir la API propia; NO DEBE llamar ni hacer
proxy al SUM productivo.

### VII. Verificación mediante pruebas

Cada cambio DEBE tener criterios de aceptación medibles y verificaciones trazables antes de
declararse completo. El registro DEBE relacionar criterio, escenario o comprobación, resultado
esperado y resultado real. Las implementaciones DEBEN ejecutar build, lint y pruebas pertinentes
de los proyectos afectados, reutilizando cobertura suficiente y añadiendo cobertura significativa
para comportamiento o contratos modificados. Las pruebas NO DEBEN limitarse a repetir detalles
de implementación.

Las pruebas DEBEN utilizar exclusivamente fixtures identificados como sintéticos, con procedencia,
preparación y restablecimiento repetibles. NO DEBEN utilizar exportaciones reales, snapshots
privados, sesiones de producción o datos de procedencia incierta. Renombrar una carpeta o sustituir
identificadores NO demuestra que un conjunto derivado esté libre de datos privados; DEBE aplicarse
la comprobación de procedencia de `AGENTS.md` o solicitar una reproducción sintética independiente.

Los casos DEBEN cubrir éxito, vacío, error y límites según el alcance. Los cambios integrados
DEBEN verificar escenarios reales de React → NestJS → efecto/estado local; los mocks y build/lint
por sí solos NO acreditan integración. Las verificaciones visuales DEBEN usar estados comparables.
Un resultado previsto, omitido o fallido NO DEBE declararse aprobado. Los cambios exclusivamente
documentales DEBEN comprobar contenido, enlaces y coherencia de políticas; no requieren pruebas
de aplicación. Durante specify/clarify solo se definen escenarios y se validan documentos.

## Alcance y restricciones

SUM-reverse entrega una réplica independiente del comportamiento observable del SUM, con frontend
React en `client/`, backend NestJS en `backend/`, evidencia en `evidence/` y contratos propios.
NO DEBE crearse un backend duplicado en `server/` ni recuperarse la implementación privada del SUM.
Las decisiones locales sobre persistencia, permisos y reglas DEBEN quedar explícitas en contratos.

[AGENTS.md](../../AGENTS.md) establece los límites operativos, de privacidad y de inspección.
Las instrucciones de carpeta, skills, planes históricos y hooks NO DEBEN relajar esos límites.
Esta constitución consolida los principios y DEBE aplicarse junto con AGENTS.md; un conflicto
DEBE registrarse y resolverse conservando las restricciones, antes de la acción afectada.
Las instrucciones expresas del usuario y las restricciones efectivas del entorno siguen vigentes.

La ausencia de evidencia obligatoria DEBE bloquear únicamente la afirmación o dependencia que
requiere esa evidencia. El resto del alcance seguro DEBE avanzar y reportarse con sus límites.

## Flujo de trabajo y aceptación

1. Revisar instrucciones, evidencia, dossier aplicable, contratos, componentes y planes existentes.
   Registrar vigencia, clasificación de fuentes y brechas antes de especificar o implementar.
2. Durante `specify` y `clarify`, mantener código y contratos de ejecución en solo lectura.
   Modificar únicamente especificaciones, aclaraciones, checklists y metadatos Spec Kit necesarios.
   NO modificar código, configuración de ejecución, dependencias, fixtures o pruebas. Los hooks
   y handoffs NO DEBEN iniciar implementación automáticamente desde esas etapas.
3. Completar un plan persistente con contrato local, dependencias, criterios y escenarios de prueba
   antes de implementar, siguiendo la etapa de planificación de AGENTS.md. Reutilizar planes
   suficientes; las decisiones locales NO DEBEN sustituir evidencia para una afirmación de paridad.
4. Orca coordina workers futuros con archivos exclusivos, contrato fijado, instrucciones de carpeta,
   límites de acceso, criterios y pruebas. Conservar los perfiles y límites de concurrencia de
   AGENTS.md; los workers NO DEBEN delegar. La sesión compartida de navegador DEBE tener un único
   propietario y utilizarse secuencialmente.
5. Ejecutar las verificaciones pertinentes solo en entornos locales sintéticos, revisar resultados
   y permitir como máximo un ciclo automático de reparación conforme a AGENTS.md. Un fallo
   persistente DEBE diagnosticarse y registrarse antes de otro intento.
6. Entregar archivos cambiados, fuentes y estado de verificación, decisiones locales, criterios
   satisfechos, comandos y resultados reales, y pendientes materiales. NO declarar aceptación
   completa si faltan criterios obligatorios ni inventar inspecciones o verificaciones.

## Governance

Esta constitución rige la elaboración de especificaciones, planes, tareas, implementación y
aceptación. Los artefactos DEBEN identificar los principios aplicables y cualquier incumplimiento
antes de avanzar la dependencia afectada. La revisión DEBE comprobar trazabilidad de fuentes,
incertidumbre, perfil académico, privacidad, reutilización y pruebas, según el alcance del cambio.
Las verificaciones documentales y deterministas bastan para cambios documentales; una opinión
de otro agente NO sustituye los resultados de aceptación exigidos.

Toda enmienda DEBE describir motivo, texto afectado, impacto en artefactos y migración necesaria,
obtener autorización explícita del responsable del proyecto y registrar versión y fecha.
Una instrucción expresa del usuario para actualizar estos principios constituye esa autorización.
NO se admiten excepciones tácitas ni enmiendas que atribuyan hechos no observados al SUM o eludan
las restricciones de privacidad. Los cambios constitucionales DEBEN preservar las restricciones
operativas de AGENTS.md o resolver su coherencia mediante una tarea explícitamente autorizada.

La versión DEBE seguir SemVer: MAJOR para eliminar o redefinir principios de forma incompatible;
MINOR para añadir principios, secciones o ampliar materialmente obligaciones; PATCH para
aclaraciones sin cambio de obligaciones. La fecha de ratificación inicial DEBE conservarse y
la fecha de última modificación DEBE actualizarse con cada enmienda. La versión 1.0.0 constituye
la primera adopción de principios; la plantilla anterior no era una constitución ratificada.

Las plantillas y comandos dependientes leen la constitución en ejecución. Este flujo DEBE
modificar únicamente `.specify/memory/constitution.md`. El informe de impacto inicial es material
de revisión y DEBE retirarse antes de hacer commit, sin alterar las reglas adoptadas.

**Version**: 1.0.0 | **Ratified**: 2026-10-11 | **Last Amended**: 2026-10-11
