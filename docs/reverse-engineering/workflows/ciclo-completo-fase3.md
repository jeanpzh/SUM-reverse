# Revisión de propuesta y preparación de fase 3

Fecha: 2026-11-05. Estado actualizado: implementación P1/P2 y A/B/C completada;
recorrido Docker/React/NestJS aprobado con datos sintéticos y reinicio. Resultados
por criterio y límites en [aceptación](../../../evidence/local/ciclo-completo-fase3/fullstack-verification.md).
Rama `docs/fase3-propuesta`, derivada de `schedule-pt1` en `5f9083f`.
Plan del principal: [ciclo-completo-fase3](../plans/ciclo-completo-fase3.md).

## Registro histórico del diagnóstico y ejecución incremental

Los conteos y pendientes siguientes corresponden a sus respectivos momentos de
ejecución. El cierre al final y el informe de aceptación contienen el estado actual.

Se localizaron y leyeron los dos Markdown de `jeanpzh/propuesta-pre-matricula`.
La raíz contiene además una presentación; no hay PDF. No se copiaron documentos
privados ni se ejecutó su generador. El plan distingue fases del proyecto de las
etapas E1/E2/E3 y de los trabajos A/B/C del encargo.

Skills aplicadas: `sum-workflow` y `mattpocock-skills:research`. Investigación oficial
delegada a un trabajador con contexto nuevo, sin delegar planificación. Archivo
exclusivo: [fuentes](../../domain/fisi/2026-II/phase3-planning-sources-2026-11-05.md).
El principal revisó los contratos, el código con CodeGraph y los planes existentes;
produce el diagnóstico, las dependencias, los criterios y la futura asignación.
Durante ese diagnóstico no se lanzaron implementadores. Complejidad e impacto altos; incertidumbre
institucional no resuelta por testimonios ni por una demo sintética.

Decisiones recibidas del usuario: «lo recomendado» para conservar población y
capacidad de tesis y limitar la excepción a docentes; «recomendado» para preferir
una excepción explícita desde 14:00 antes de sábado. Se registran como decisiones
locales, sin elevarlas a norma. Adscripción/categoría y ventanas exactas requieren
los datos/criterios señalados en el plan.

Se reutiliza la aceptación local PR35 como histórica, sin certificar una nueva
oferta E3. Se verificó en GitHub que el job posterior backend-browser terminó en
fallo, separado de los checks client/backend aprobados. Se recopilaron solo causas
técnicas y conteos de ese workflow sintético; no se guardaron logs crudos.

Comprobaciones nuevas: tipos de fuente sin emitir pasan; tipos completos actuales
fallan con 106 diagnósticos en pruebas, frente a 77 en la línea base comparable.
El plan detalla la comparación y los 29 diagnósticos en pruebas nuevas. No se
ejecutaron suites, Docker, navegación, datos privados, producción ni exportaciones.

Cambios de este encargo: tres documentos nuevos (plan, registro y fuentes). Los dos
documentos locales `replica-funcional-integrada.md` se preservan sin edición.
No hay cambios a frontend/backend/shared/configuración, commits, push o merges.

Validación documental ejecutada: pasan los tres documentos, ocho enlaces relativos,
existencia de módulos citados, criterios obligatorios y control de whitespace/URLs
sin tokens. `git diff --check` pasa. Se revisaron metadatos y procedencia.
Reparaciones de implementación: no aplica. La siguiente etapa es A0 y el handoff
de A, junto con la estabilización S0, cuando se autorice implementación.

## Ejecución autorizada posterior

El usuario ordenó «realiza lo q te encomende»: se ejecutan P1/P2 y A/B/C sin commits,
push ni merges. Contrato preciso de P1/P2: `contracts/local-api/ciclo-completo-fase3.md`.
Ventanas sintéticas fijadas: L–V08–22, VII–X18–22, excepción14–22, sábado08–13;
sin pretender que sean normas oficiales. Principal mantiene contratos/shared y A0.

Routing: validate_routing.py detectó que los defaults del proyecto no son efectivos
en esta sesión. No se afirma cambio del modelo principal. Para implementadores se
usan los overrides reales disponibles `gpt-6-luna`, esfuerzo `high`, contexto nuevo.

| Trabajo | Propiedad exclusiva | Rol | Estado |
| --- | --- | --- | --- |
| P1/P2 servidor | backend/src/programacion-academica/** y backend/test/programacion-academica* | Luna High backend | Implementado, checks dirigidos aprobados; integración pendiente |
| P1/P2 cliente | AcademicScheduling.tsx, AcademicResourceEditor.tsx, su CSS, data/academicScheduling.ts y su test | Luna High cliente | Build/lint y 214 pruebas de datos aprobados |
| A/B/C servidor | matricula-regular, local-profile-dashboard, prematricula, import AppModule y pruebas asignadas | Mismo Luna High backend | En curso con contrato congelado |
| A/B/C cliente | Panel de publicación, login/contexto, adaptadores y matrícula existentes | Mismo Luna High cliente | Build/lint aprobados; 221 pruebas de datos aprobadas tras corrección diagnosticada del principal |
| S0 navegador | Tres specs históricas MR y harness Vite sintético | Mismo Luna High cliente | Asignado; navegador exclusivo del worker durante esta tarea |
| Shared/API/A0 y aceptación | shared/**, docs/**, compose/scripts raíz y futura evidencia integrada | Principal | En curso |

Cada worker lee root/folder AGENTS y skill local, valida CodeGraph/exclusiones y no
delega. Se asignó posteriormente navegador único al worker S0, secuencial con la
aceptación del principal; no hay navegación concurrente ni entornos ajenos.
Fidelidad SUM, reutilización de interfaces y ausencia de rediseño son aceptación.

### Estabilización y correcciones aisladas del principal

Se reprodujeron 106 diagnósticos TS antes de los cambios. Correcciones acotadas a
pruebas: tipar datos conocidos, usar validadores existentes al cruzar contratos,
construir Socket real sin conectar, e introducir datos inválidos mediante Reflect
en pruebas negativas. No se quitaron pruebas ni aserciones. Playwright1.63.0,
ya usado por el cliente, se declara como dependencia de desarrollo del backend:
las pruebas no importan el paquete atravesando node_modules del otro proyecto.
Se añadió declaración de tipos del exportador de métricas existente.

Comprobación dirigida: 261/261 pruebas, 17 archivos; TypeScript completo queda con
cuatro diagnósticos en los archivos de prueba del handoff A/B/C. Las 45 pruebas de
contratos compartidos pasan. No equivalen a aceptación Docker/navegador de A/B/C.

Revisión diagnosticó un borde P1: con ventanas genéricas más amplias, el generador
podía aceptar un bloque que comienza antes de22:00/13:00 y termina después. El
principal limitó la duración completa y añadió prueba de borde; preserva el camino
legacy sin política. También corrigió el EOF indicado por diff--check.

El primer ciclo del worker A/B/C cliente dejó un fallo exclusivamente de mensaje
esperado en su nueva prueba UUID; el principal revisó y corrigió la expectativa al
mensaje canónico del validador existente. Resultado posterior: 221/221. No hubo
cambio de comportamiento para satisfacer esa aserción.

Verificación adicional del principal: 97/97 casos de generador (incluye borde de
duración), 46/46 contratos compartidos y 5/5 comprobaciones Compose. Una aserción
histórica esperaba ausencia de volumen en compose.local, incompatible con la
persistencia E1 ya adoptada: ahora exige exactamente el volumen academic-drafts,
su tipo y destino; conserva la exclusión de snapshots. No se cambió Compose.
Frontend construido con éxito mediante Docker, proyecto propio
sum-fase3-20261105. Su volumen aún no existía al preparar la ejecución y el puerto
5280 se comprobó libre sin inspeccionar servicios ajenos. Dockerignore usa lista
permitida y excluye datos privados, secretos y dependencias.

Se prepara `client/scripts/verify-cycle-complete.mjs` para la integración real en
ese entorno: parámetros/búsqueda/pool, E1 mediante HTTP, dos intenciones desde
React, activación versionada, login2027, importación, cambios de sección,
confirmación por el motor existente, reporte, idempotencia y reinicio. Hasta su
ejecución satisfactoria no se da ningún criterio A/B/C por integrado.

### Continuación del principal y garantías verificadas

Los dos trabajadores alcanzaron el límite de uso del proveedor durante A/B/C y
S0. El usuario reiteró «prosigue». Se retomó la implementación con la configuración
del principal, informando la limitación; no se simula una delegación adicional.
El principal recupera la propiedad exclusiva del navegador tras finalizar ambos.

Correcciones diagnosticadas: revisión MR canónica en mayúsculas; conservar el mapa
académico completo para no cambiar la huella E2; copiar/validar/persistir la unidad
operativa antes de publicar en RAM; respetar la clave por actor del mapa existente
de matrículas y mantener correlaciones independientes por enrollmentId. Se reutiliza
la proyección de contexto en un módulo puro para validar oferta/horarios/créditos.
El adaptador de archivos se configura únicamente desde OperationalOfferModule;
el módulo base conserva su prueba estricta de ausencia de archivos/entorno/snapshots.
E2 filtra publicaciones de otros periodos y las rechaza al seleccionarlas; traslado
E3 conserva sus diagnósticos de ámbito incompatible sin sustituir selecciones.

Suite backend (perfil CI, navegador separado): 51 archivos, 748 pruebas aprobadas.
Posteriormente se amplió la integración de ofertas de dos a seis escenarios y pasan
los seis: persistencia/reinicio, CAS/cambio conservando contexto previo, concurrencia
de dos estudiantes previamente admisibles por última plaza, idempotencia/conflicto,
fallo de escritura sin efectos parciales y consulta tras reinicio, corrupción de
ocupación con checksum válido y rechazo de periodo E1 incompatible. La inyección de
fallo afecta solo a la escritura; el recorrido HTTP y el motor son reales.

S0 navegador US1 migra a login por perfil y a la interfaz actual, conserva CSV y
comparación exacta de estado con reloj fijo, y exige solo POST de sesión (ningún
envío de matrícula). Cubre ambos programas y seis estados documentales: aprobado.
Los otros archivos de navegador y el recorrido Docker aún deben completarse.

### Cierre de implementación y aceptación

El principal completó A/B/C y S0 con las skills de implementación por carpeta;
aceptación integrada mediante `sum-fullstack-verify`. Los trabajadores iniciales
fueron Luna High; el cierre se realizó con la configuración principal disponible
tras el límite de uso del proveedor, sin afirmar otro cambio de modelo.

La demo completa pasó en Compose propio `sum-fase3-final-20261105`, puerto5280,
con volumen nuevo comprobado antes de crearlo. El entorno anterior se detuvo
conservando su volumen. Escuela genera/revisa/publica por HTTP, estudiantes A/B
registran por UI, Escuela activa por UI, A importa/cambia secciones/confirma12
créditos y obtiene reporte. Repetición idéntica no altera ocupación. Tras reiniciar
backend se recuperan resultado, reporte, ocupaciones y ambas intenciones; la sesión
invalidada conduce al reingreso explícito de la misma oferta2027-I. Sin mocks de API.

Revisión visual detectó periodo2026-2 hardcodeado en la proyección compartida y
etiquetas internas de sección: corrección acotada usa scopeperiod y ordinal legible,
preservando2026-II. Se construyeron de nuevo las imágenes antes de la ejecución
final; captura confirmada muestra2027-1, sección2, cuatro filas y12 créditos.
Los diálogos existentes reutilizan contención de foco para Tab/Shift+Tab/Escape,
sin cambios visuales. No se certifica paridad visual contra producción SUM.

Se diagnosticó una brecha adicional: contextos independientes podían permitir
otra matrícula del mismo actor en una versión nueva del mismo periodo. El contrato
ahora fija unicidad por estudiante/periodo/escuela/plan entre ofertas. Dentro de
la cola global se añade la causa existente ALREADY_ENROLLED y se conservan reporte
y ocupación anteriores; recuperación rechaza duplicados persistidos. Prueba HTTP
con dos publicaciones y reinicio aprobada. Concurrencia ampliada verifica además
que el perdedor de una plaza llena pueda matricularse en otra sección admisible.

Resultados: backend51 archivos/753 pruebas; nueva integración de oferta7 escenarios
aprobados, incluidos casos ampliados; cliente222 pruebas; shared46; Compose5;
generador97. Build/lint de ambas capas pasan; TypeScript completo0 diagnósticos.
Lint backend conserva cuatro advertencias preexistentes. `test:e2e`:1 aprobado,
9 omitidos por ausencia de PostgreSQL sintético. S0 final: cuatro archivos,
30/30 pruebas (14 navegador y16 HTTP), agregado backend783/783. Comandos detallados
en el informe de aceptación. No se quitaron pruebas ni se debilitaron
aserciones; se ajustó el timeout de los dos recorridos HTTP nuevos más extensos
a30s tras medir el límite genérico5s y la contención de builds paralelos.

Estado final y evidencia: [informe completo](../../../evidence/local/ciclo-completo-fase3/fullstack-verification.md).
No se tocaron los dos documentos preexistentes replica-funcional-integrada, datos
privados ni volúmenes ajenos. Sin commits, push o merges. El entorno local se deja
disponible para revisión; no constituye despliegue institucional.

### Autorización de publicación Git

Después de la aceptación, el usuario pidió «haz el commit y push si es necesario».
Se publica el trabajo en `docs/fase3-propuesta`, sin merge a main/master ni cambios
a los dos documentos ajenos preexistentes. El informe distingue explícitamente la
demo aceptada del cumplimiento parcial de toda la propuesta: núcleo sin IA,
DFS TypeScript en lugar de CP-SAT y brechas de rondas, reajuste, roles y métricas.

### PR36: preparación del merge y corrección CI

Autorización explícita posterior: «pr y merge». PR36 hacia master, porque PR35
ya integró schedule-pt1 mediante squash. Se comprobó igualdad exacta de árboles
master/5f9083f antes de alinear historia; las resoluciones de add/add conservan
exactamente el árbol probado de40bee2b. No se modificó funcionalidad al sincronizar.

Primera ejecución CI42077824945: cliente y backend aprueban; navegador falla antes
de ejecutar14 escenarios porque backend/dist no existe en su runner independiente.
Los16 casos HTTP sí pasan. Corrección aislada del principal: añadir el comando de
build backend después de instalar y antes de ejecutar navegador, conservando el
guard de runtime compilado y todas las aserciones. No se interpreta como fallo
funcional ni se reintenta sin corregir su causa. El siguiente CI decide la aceptación.
