# Propuesta: programación académica asistida de principio a fin

Fecha: 2026-11-07. Estado: **aprobado por el usuario el 2026-11-07** mediante “Esta bien, realizalo”. Se autoriza preparar los contratos y ejecutar las entregas de su alcance, conservando sus revisiones de aceptación. Los contratos/tickets se fijan por entrega antes de implementar; la aprobación no convierte interfaces aún no especificadas en contratos listos.

## 1. Resultado buscado

La escuela parte de datos disponibles, obtiene una propuesta de docentes, aulas y horarios y dedica su trabajo a revisar excepciones. Cuando los datos están completos, generar una propuesta no exige abrir una ficha por docente, ambiente o curso. La automatización conserva decisiones humanas sobre oferta, disponibilidad, habilitación, excepciones, aprobación y publicación.

Indicador principal de éxito: **con una base completa de planificación, el operador puede generar desde el resumen sin abrir ningún formulario individual de recursos**. Las fichas se usan para completar información faltante o corregir un caso. La cantidad de botones o formularios no debe crecer con el tamaño del catálogo en la pantalla inicial.

## 2. Punto de partida y fuentes

| Fuente | Qué sustenta y qué no |
| --- | --- |
| Petición del usuario en esta conversación, 2026-11-07 | Requisito de producto: automatizar la programación y evitar elegir docentes mediante botones sueltos y numerosos formularios. Diseño local propuesto, no evidencia SUM |
| [Dirección visual vinculante](../../design-direction.md) | A como lenguaje visual; Semana de B; aprobación/publicación de C. No se reabre esa decisión |
| `client/src/screens/AcademicResourceEditor.tsx` y `AcademicScheduling.tsx` | Inspección estática del producto propio: listado de docentes como botones, fichas activas, configuración de recursos, generación e invalidación actuales |
| [Preparación compacta](planning-preparation-scale.md) e [informe local](../../../evidence/local/programacion-academica-preparation/fullstack-verification.md) | Tabla de cursos, selección entre filtros, inspector y lote integrados; pruebas locales. UI96 simulada y API real56 son coberturas diferentes |
| [Programa existente](planning-product-program.md) y contratos [rondas](../contracts/local-api/planning-rounds.md), [reajuste](../contracts/local-api/planning-readjustment.md) | Reutilizar tareas y contratos existentes; su presencia no prueba implementación integrada |
| `shared/programacion-academica-api.{mjs,d.mts}` y módulos de planificación del backend | Contratos existentes para recursos, propuesta, ajustes, borradores, revisión, aprobación y publicación; no son una base de recursos independiente entre periodos |

Todo comportamiento nuevo de este documento es una **decisión local propuesta**. No se inspecciona producción ni se usa información privada. El catálogo sintético incorporado actual contiene 56 cursos; el recorrido completo con 96 sigue pendiente. La auditoría independiente de P96-UI quedó pendiente por cuota del proveedor; no se presenta como aprobada.

## 3. Flujo que verá la escuela

Se conservan las cuatro etapas actuales: **Preparación → Horario → Revisión docente → Aprobación**. Publicar continúa como una acción posterior y distinta de aprobar. Se reorganiza el interior de Preparación; no se agrega otro dashboard ni un asistente que obligue a recorrer fichas una por una.

### Preparación: revisar una base y confirmar la oferta

1. Elegir el periodo en el ámbito que realmente soporta la aplicación. Escuela/plan se muestran según los datos disponibles; no se dibujan selectores ficticios para ámbitos aún no implementados.
2. Comenzar desde una base explícita: catálogo sintético disponible o copia de un borrador/versión anterior permitida. Mostrar fuente y periodo. Reutilizar recursos no confirma su disponibilidad para un nuevo periodo.
3. Revisar el resumen de oferta y recursos. Cursos incluidos, demanda, secciones previstas, docentes y ambientes disponibles, y datos que requieren revisión se distinguen sin mezclar cursos, secciones y componentes.
4. Confirmar o corregir la oferta en la tabla de cursos ya implementada. Mantener búsqueda, selección entre filtros, edición en lote y un inspector bajo demanda.
5. Si hace falta, abrir **Recursos** para revisar docentes o ambientes. Volver al resumen y generar la propuesta.

La entrada a Preparación muestra un **Resumen** con la siguiente acción principal disponible. Cursos y Recursos son vistas dentro de esa etapa. Sus filtros y selecciones se conservan al volver. El guardado sigue siendo explícito y muestra cuándo hay cambios pendientes.

### Recursos: una lista, un detalle abierto

- **Docentes:** tabla buscable por nombre/código, cursos habilitados, disponibilidad resumida y carga máxima. Distinguir total de catálogo, recursos incluidos en el borrador y recursos visibles. La carga asignada solo se muestra cuando una propuesta existente la permite calcular; no se inventa una carga antes de generar.
- **Ambientes:** tabla buscable con tipo, capacidad y disponibilidad resumida; filtros de aula/laboratorio y recursos incluidos.
- Elegir una fila abre el único inspector de recursos activo. Disponibilidad, preferencias, habilitaciones y límites se editan ahí usando los controles y validadores existentes.
- Los botones de cada profesor se sustituyen por filas. “Incluir recurso” y “Abrir ficha” tienen acciones distintas y etiquetas claras.
- Incorporar o retirar varios recursos usa un alcance explícito y vista previa. No se habilita masivamente a todos los docentes para todos los cursos. Los cambios de disponibilidad en lote son una entrega posterior opcional; primero se resuelve la operación básica sin inventar reglas de compatibilidad.
- La consulta permanece accesible en propuestas congeladas; la modificación queda bloqueada. Corregir una versión aprobada/publicada empieza un nuevo borrador.

### Horario: generar y resolver pendientes

El motor existente intenta asignar docentes, recursos y franjas al conjunto completo incluido. Los filtros de pantalla no cambian el conjunto que recibe.

Un resumen único indica cobertura de secciones/componentes y pendientes. La lista de pendientes presenta la causa que realmente devuelve el motor, el elemento afectado y una acción pertinente: revisar habilitación, disponibilidad, capacidad o abrir el bloque. Una carencia probable detectada antes de generar se presenta como advertencia, no como una prueba de imposibilidad.

Los resultados se inspeccionan en Tabla/Semana existentes. Un ajuste se muestra como propuesta hasta que el servidor lo acepta. Un límite de búsqueda conserva ese significado: no se declara que no exista solución.

Corregir datos no debe destruir silenciosamente el resultado guardado. Se propone mostrar que la propuesta corresponde a una configuración anterior y requiere regeneración. Este estado exige contrato y conservación explícita del resultado; hoy la edición de recursos invalida la propuesta en memoria. No basta con ocultar un mensaje o dejar un horario obsoleto marcado como vigente.

La regeneración que conserva asignaciones aceptadas se integra mediante los contratos de rondas y el núcleo existente de retención; no se presenta como una función ya disponible ni se crea un segundo motor.

### Revisión, aprobación y publicación

Los docentes revisan su parte y comunican conformidad u observaciones. Las observaciones estructuradas y las rondas completas siguen el contrato de rondas existente. No se promete interpretar automáticamente texto libre.

La escuela resuelve pendientes, obtiene las conformidades requeridas y aprueba una versión. Publicar es una confirmación separada. Una publicación queda consultable e inmutable. No se incorporan correo, notificaciones externas ni permisos reales mediante el selector de rol simulado.

## 4. Qué automatiza el sistema y qué decide la escuela

| El sistema | La escuela |
| --- | --- |
| Precargar una base identificada y calcular secciones con demanda/capacidad | Confirmar oferta y demanda final |
| Detectar datos mal formados y carencias comprobables | Confirmar habilitaciones, disponibilidad y excepciones |
| Proponer docentes, aulas y horarios bajo restricciones configuradas | Resolver los casos pendientes y aceptar ajustes |
| Conservar versiones, revisión y alcance de regeneración según contrato | Aprobar y publicar |

La referencia histórica sirve como punto de partida. Nunca se convierte automáticamente en una disponibilidad, habilitación o regla institucional confirmada para el nuevo periodo.

## 5. Datos reutilizables y estados honestos

Se propone reutilizar **copias de la configuración de borradores existentes**, sin crear un módulo administrativo independiente de recursos en esta entrega. Cada borrador conserva su propia configuración por ámbito y periodo; editarlo no altera otras versiones.

Además de los valores existentes, se necesita especificar metadata de preparación: origen de la base, referencia de versión y revisión de los datos usados en ese borrador. “Revisado por el operador” describe una decisión local; no equivale a procedencia oficial ni a observación verificada de SUM.

- La copia de otro periodo queda identificada y pendiente de revisión. La revisión de un conjunto puede confirmarse con una sola acción y vista previa de su alcance, sin abrir cada ficha.
- Cambiar los datos revisados obliga a revisar nuevamente las partes afectadas. Guardar/recuperar conserva valores, revisión y procedencia juntos.
- Errores de formato bloquean el envío. Falta de recursos o cobertura puede permitir generar una propuesta parcial para investigar, con advertencias visibles.
- La propuesta añade como decisión local que los datos de preparación utilizados estén revisados antes de aprobar una nueva versión. Su detalle debe fijarse en el contrato, con compatibilidad para versiones históricas congeladas.
- La metadata no se añade unilateralmente desde React: los validadores compartidos y la API propia deben aceptarla y validarla. Borradores antiguos se reconocen explícitamente sin reescribir hashes o contenido de versiones aprobadas/publicadas.
- Se mantienen guardado explícito, control de versión y detección de conflictos. Los errores de escritura no se presentan como cambios guardados.

## 6. Entregas y dependencias

| Orden | Entrega | Resultado revisable | Dependencias |
| --- | --- | --- | --- |
| 0 | Especificación de la experiencia y contratos | Flujo, inventario de estados, reglas de revisión y compatibilidad acordados; contrato fijado antes de implementar | Feedback/aprobación de este plan |
| 1 | Recursos compactos | Docentes y ambientes en tablas buscables, un inspector, sin botones sueltos ni fichas abiertas al entrar | 0; reutilizar PA-DEMO-1 cuando no cambie el contrato |
| 2 | Base reutilizable y revisión de datos | Iniciar desde una copia permitida, procedencia visible, revisión por conjuntos y guardado/recuperación por periodo | 0; extensión compartida/API y persistencia, luego UI |
| 3 | Preparación orientada a generar | Resumen inicial con oferta, recursos y pendientes; Cursos/Recursos bajo demanda; acción principal clara | 1 y 2 |
| 4 | Resolución guiada y regeneración | Pendientes con causas respaldadas; resultado anterior identificado; conservación de asignaciones aceptadas donde el contrato lo permita | 3, contrato de rondas y backend correspondiente integrado |
| 5 | Verificación del recorrido y escala | Pruebas de oferta completa/parcial, revisión, congelamiento y 96 cursos con fuentes independientes; auditoría y entrega | 1–4; P96-DEMAND y P96-INTEGRATION existentes |

Cada entrega se valida antes de ampliar la siguiente. No se vuelve a implementar la tabla de cursos, Semana, el generador, el guardado o los contratos de rondas que ya sean compatibles.

P96-DEMAND corrige el alcance 32/96 del estimador; P96-INTEGRATION demuestra el recorrido completo. Son requisitos de la entrega de escala, no prueba de que el generador encuentre siempre una solución. El número máximo admitido, la cobertura obtenida y el presupuesto de búsqueda se reportan por separado.

## 7. Criterios de aceptación

| ID | Escenario/check sintético | Resultado esperado |
| --- | --- | --- |
| A1 | Abrir Preparación con una base completa | Resumen inicial; cero fichas de docentes o ambientes expandidas |
| A2 | Generar con datos completos y oferta confirmada | Se llega a una propuesta sin abrir ninguna ficha individual de recursos ni asignar manualmente cada docente |
| A3 | Buscar un docente/ambiente y abrir otro | Coincidencias por nombre/código y máximo un inspector de recursos activo; abrir no cambia inclusión |
| A4 | Incluir/retirar recursos, filtrar y generar | Vista previa exacta de cambios en conjunto; cancelar no cambia nada; filtros no alteran el payload |
| A5 | Copiar una base del periodo anterior y editarla | Procedencia visible, revisión pendiente y cambios aislados del original; guardado/recuperación conservan el estado |
| A6 | Cambiar un dato después de revisarlo y generar | Las partes afectadas pierden su revisión; propuesta previa claramente desactualizada, conservada según contrato y nunca presentada como vigente |
| A7 | Curso sin docente habilitado, laboratorio insuficiente o disponibilidad incompatible | Advertencia/pendiente respaldado con acceso al dato pertinente; no promesa de solución ni causa inventada |
| A8 | Generación completa, parcial y por límite de búsqueda | Cobertura y mensajes coherentes con la respuesta; se distinguen todos los estados |
| A9 | Regenerar con asignaciones aceptadas según rondas | Se preserva el conjunto fijado; si las restricciones lo contradicen, rechazo explícito sin cambiar la versión guardada |
| A10 | Aprobar/publicar y consultar; intentar cambios; crear nuevo borrador | Consulta disponible, modificaciones bloqueadas y nuevo borrador independiente; compatibilidad de versiones previas |
| A11 | 96 cursos, recursos compartidos entre ciclos y caso 97 | Petición/estimación/generación reales consistentes para 96; 97 rechazado por contrato; filtros no eliminan conflictos globales |
| A12 | Teclado, foco, 720px, zoom200, contraste y controles de error | Operación completa accesible, sin desborde de documento, texto esencial >=12px y estado no comunicado solo por color |
| A13 | Build/lint/tests afectados + escenarios React/NestJS propios | Salida 0 y evidencia por criterio; pruebas simuladas separadas de integración real |
| A14 | Inspección del diff y regresiones estudiantiles comparables | Sin cambios en selector de módulos, pantallas/componentes/tokens SUM ni contratos estudiantiles por efecto de esta reorganización |

Para A11 se construyen catálogo y fuentes sintéticas independientes de 96; no se generan a partir de privados ni se usa un mock de respuesta como prueba fullstack. No se promete una duración máxima de generación: se medirá la ejecución y se informará el límite usado y la cobertura alcanzada.

## 8. Implementación y coordinación después de aprobar

- Principal: contratos, dependencias, aceptación y navegador integrado. Cada ticket recibe criterios, revisión de contrato y archivos exclusivos antes de despacharse.
- Frontend: reutilizar/extender `AcademicResourceEditor`, `AcademicPreparationCourses`, `AcademicScheduling`, adaptadores de `client/src/data/` y tokens `--planning-*`. Separar lista/resumen/inspector solo donde los componentes existentes no sean compatibles, registrando la razón.
- Backend/shared: extender contratos y módulos actuales de `backend/src/programacion-academica/` únicamente para metadata, conservación de estado y regeneración que lo requieran. No duplicar backend o repositorios.
- `AcademicScheduling.tsx`, los validadores compartidos y los servicios de borradores tienen un único dueño a la vez. No paralelizar tickets que los comparten. Modelos y alternativas conforme AGENTS §5; el despacho de implementación está autorizado desde la aprobación del usuario; cada entrega requiere su brief y contrato fijados.
- Mantener el diseño interno A, las interacciones de Semana y la estructura de aprobación/publicación elegidas. Preservar fidelidad visual/de interacción SUM del alumno. Alcance visual autorizado por el plan: Preparación y paneles de recursos; en Horario/Revisión/Aprobación, solo los estados y acciones nuevos descritos aquí, reutilizando las vistas actuales.
- Pruebas solo en procesos propios sintéticos, puertos aislados y almacenes temporales explícitos. Nunca usar `datos-reales/`, producción ni la demo del operador como fixture. No detener el servidor de demostración solicitado por el usuario para correr pruebas.

## 9. Fuera de esta propuesta

Intercambio SQL, reajuste posterior a prematrícula S-5, pantallas del alumno, autenticación institucional, importación/exportación desde producción, canales de notificación externos y reemplazo del motor por IA/otro solver conservan sus planes separados. Una integración de datos institucionales necesitará su propia fuente autorizada y contrato; este plan usa datos sintéticos.

## 10. Decisiones propuestas para el feedback

1. **Resumen como entrada**, con Cursos y Recursos como vistas de Preparación; mantener las cuatro etapas actuales.
2. **Precarga por copia identificada**, con revisión por conjuntos y confirmación humana de la oferta; evitar un nuevo módulo administrativo global en esta fase.
3. **Automatizar la propuesta y trabajar por pendientes**, con cambios manuales concentrados en casos concretos.
4. **Entregar por etapas**, comenzando por Recursos compactos y cerrando la experiencia con pruebas reales de escala.

El usuario puede aceptar el conjunto o ajustar cualquiera de estas decisiones antes de iniciar contratos e implementación.

## 11. Validación de este documento

Aceptación documental: enlaces locales existentes; coherencia con dirección visual y planes previos; estado propuesto separado del implementado; cada entrega con dependencias y criterios medibles; límites de privacidad y fidelidad explícitos. No requiere ni ejecuta pruebas de aplicación. Las comprobaciones del documento se registran al entregar el plan.

Resultado documental (2026-11-07): enlaces Markdown locales comprobados y existentes; A1–A14 presentes; estado propuesto, dependencias, fuentes y restricciones revisados; `git diff --check` sin errores. Solo se creó este documento; no se modificó la aplicación ni se ejecutaron sus pruebas.


## Ejecución autorizada

Entrega 1 especificada en [Recursos compactos](planning-resource-workbench.md). Primero se integra y verifica esa entrega; después se fijan los contratos de metadata y reutilización de la entrega 2. No se reduce el plan aprobado a su primera entrega. El servidor de demostración existente se conserva activo.


Avance de ejecución (2026-11-07): entrega1 Recursos integrada en `0f7c90b`, con [verificación local](../../../evidence/local/programacion-academica-resources/fullstack-verification.md). Entregas2–5 conservan su alcance aprobado y siguen pendientes. No confundir este incremento con el plan completo finalizado.
