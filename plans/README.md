# Análisis de mejoras SUM

Fecha: 2026-10-09. Base Git: `263f067`, con cambios locales anteriores y de esta conversación. Método: revisión estática directa, sin subagentes. Estado: propuestas; ninguna mejora de este informe ha sido implementada.

## Alcance y límites

Se revisaron la réplica React, sus adaptadores y tipos, los scripts de verificación y documentación de contratos/evidencia. Se reutilizaron las imágenes aportadas por el usuario y las notas sanitizadas existentes. Se consultaron metadatos del backend, sin auditarlo íntegramente.

No se inspeccionó SUM en producción, `datos-reales/`, respuestas privadas, servidores activos, sesiones o secretos. No se ejecutaron pruebas, auditorías de dependencias ni nuevas verificaciones de navegador. Por tanto, los hallazgos de código describen la réplica; las propuestas para SUM original son recomendaciones de producto basadas en evidencia parcial. No se certifican accesibilidad, rendimiento, integración o fidelidad visual.

Las comprobaciones build/lint realizadas antes de este análisis corresponden a las modificaciones previas del cliente. No validan todos los escenarios del informe.

## Criterio de prioridad

P1: información fiable y comprobación de cambios. P2: lectura, navegación y acceso a tareas. P3: extensiones de producto. Esfuerzo S: horas; M: aproximadamente un día; L: varios días. Estimaciones orientativas, sujetas al contrato y a la evidencia disponible.

## Hallazgos confirmados y mejoras propuestas

| ID | Prioridad / categoría | Hallazgo y efecto | Mejora | Esfuerzo / riesgo / confianza | Evidencia |
| --- | --- | --- | --- | --- | --- |
| A01 | P1 · funcional | La rama candidata fija «No registrado» para créditos y asignaturas aprobadas. El usuario ve ausencia de datos, cuando realmente falta definir el mapeo. | Obtener claves sanitizadas y semántica de `creditaje`; mapear campos respaldados. Separar valor ausente de campo aún no interpretado. No calcular aprobaciones con una nota mínima inventada. | M / medio: interpretación académica / alta para el placeholder, desconocida para las claves | `client/src/screens/TableScreens.tsx:145`, `raw-types/historial.ts:10`, `docs/reverse-engineering/contracts/local-api/mi-informacion-compatibility.md:101` |
| A02 | P1 · verificación | El verificador busca encabezados, etiquetas y clases previos al rediseño. Tiene aserciones incompatibles con la UI actual. | Actualizar criterios de historial, menú acordeón, enlace local y horario con horas. Usar fixtures sintéticos y selectores semánticos. | M / bajo / alta; incompatibilidad estática, ejecución no realizada | `client/scripts/verify.mjs:191`, `client/scripts/verify.mjs:200`, `client/src/screens/AcademicHistory.tsx`, `client/src/screens/WeeklySchedule.tsx` |
| A03 | P1 · funcional | «Promedio último periodo» toma el último elemento del array, sin un contrato que garantice orden cronológico. Puede etiquetar un periodo antiguo como último. | Definir orden/códigos y elegir el máximo periodo válido; contemplar listas desordenadas y duplicados. Si no puede establecerse cronología, cambiar la etiqueta a una descripción exacta del dato. | S–M / medio / alta para dependencia del orden; el error depende de la entrada | `client/src/screens/TableScreens.tsx:135`, `client/src/data/adapters.ts:94` |
| A04 | P1 · documental | El README del cliente aún describe proxy/sesión y varios datos como desconocidos o demostración; el proyecto tiene API propia y contratos locales posteriores. | Documentar un inicio seguro con mock o API NestJS propia, fuentes de datos y representaciones. Revisar instrucciones heredadas que pueden inducir a configurar un proxy incorrecto. | S / bajo / alta | `client/README.md:9`, `client/README.md:11`, `client/AGENTS.md`, `backend/README.md` |
| A05 | P1 · documental | La especificación del historial afirma que no hay tipo API, aunque existe `raw-types/historial.ts`. | Sincronizar especificación, matriz y desconocidos con cambios actuales. Separar evidencia histórica SUM, implementación local y validaciones con fecha. | S / bajo / alta | `docs/reverse-engineering/screens/historial.md:9`, `raw-types/historial.ts:1`, `docs/reverse-engineering/coverage-matrix.md` |
| A06 | P2 · visual/accesibilidad | El horario necesita al menos 1050 px de ancho y usa textos de 10–11 px. Las sesiones cortas tienen desplazamiento interno. En móvil se acumulan desplazamientos y cuesta leer. | Mantener semana en escritorio y ofrecer agenda por día en móvil. Mostrar inicio/fin, asignatura y sección sin scroll dentro de cada evento; abrir detalle por teclado si hace falta. | M / medio: preservar todas las sesiones / alta para dimensiones; usabilidad pendiente de navegador | `client/src/screens/WeeklySchedule.css:22`, `client/src/screens/WeeklySchedule.css:65`, `client/src/screens/WeeklySchedule.css:72` |
| A07 | P2 · visual/funcional | Un solapamiento hace que todas las sesiones de ese día compartan un número de columnas, incluso las que no coinciden. | Calcular columnas por grupos de intervalos conectados. Marcar coincidencias temporales como aviso informativo, sin decidir reglas de matrícula. | M / medio / alta para algoritmo; escenarios no ejecutados | `client/src/screens/WeeklySchedule.tsx:55`, `client/src/screens/WeeklySchedule.tsx:63`, `client/src/screens/WeeklySchedule.tsx:70` |
| A08 | P2 · visual/accesibilidad | La navegación móvil usa la barra lateral superpuesta y un estado de colapso; no implementa un drawer con backdrop, cierre por Escape o gestión de foco. | Convertir el menú móvil en drawer accesible; mantener acordeón en escritorio y hacer visible el contexto activo. | M / medio / alta para ausencia en el componente; comportamiento real pendiente de navegador | `client/src/components/Shell.tsx:12`, `client/src/components/Shell.tsx:22`, `client/src/App.css:840` |
| A09 | P2 · funcional/copy | El shell muestra `00:00:00` constante y un botón Salir deshabilitado. Pueden sugerir una sesión real que la réplica no implementa. | Retirar el contador simulado o explicar su función real. Definir qué significa Salir en la réplica antes de habilitarlo. | S / bajo / alta | `client/src/components/Shell.tsx:99`, `client/src/components/Shell.tsx:127` |
| A10 | P2 · visual/funcional | Formularios de consulta mantienen controles y botones Modificar deshabilitados. La lectura se parece a una edición bloqueada. | Presentar datos de consulta como filas de etiqueta/valor, explicar solo lectura una vez y conservar controles únicamente donde se requieran. No habilitar guardado sin un contrato de escritura. | M / medio: tipos y valores incompletos / alta | `client/src/screens/StudentForms.tsx:230`, `client/src/screens/StudentForms.tsx:282` |
| A11 | P2 · funcional/accesibilidad | El componente común de tabla tiene scroll sin nombre/foco y encabezados sin `scope`. Descargas generan CSV pero algunos botones solo dicen «Descargar». | Estandarizar semántica, navegación por teclado, encabezados, formato numérico y nombres de exportación. Indicar formato CSV y alcance de filas exportadas. | M / medio: muchas pantallas comparten el componente / alta | `client/src/components/Common.tsx:61`, `client/src/components/Common.tsx:81`, `client/src/components/Common.tsx:86`, `client/src/data/download.ts:3` |
| A12 | P2 · visual/mantenimiento | `App.css` conserva estilos de calendario de altura fija y otras reglas históricas junto a componentes nuevos con CSS propio. No todas esas alturas siguen activas. | Identificar reglas realmente usadas antes de retirar código. Unificar tokens de texto, espaciado, bordes y densidad; evitar glow y tarjetas por cada fila. | M / medio: cascada CSS / alta para coexistencia, activación por confirmar | `client/src/App.css:406`, `client/src/App.css:409`, `client/src/screens/WeeklySchedule.css`, `DESIGN.md` |

## Mejoras de producto a evaluar

Son decisiones locales propuestas, no capacidades verificadas de SUM.

### 1. Inicio orientado a tareas

Los accesos de Inicio cubren perfil, historial, matrícula, programación, reportes y plan (`client/src/screens/Home.tsx:7`). Priorizar «Consultar mi horario», «Ver matrícula» y «Buscar asignatura» según tareas frecuentes que confirme el usuario. Reemplazar «Ver más...» por verbos con destino claro. Evitar duplicar el contexto del alumno en varias superficies grandes.

Valor: menos pasos para consultas recurrentes. Esfuerzo S–M; no añadir avisos académicos ni fechas límite sin datos respaldados.

### 2. Consulta académica con filtros coherentes

Historial y programación ya tienen búsqueda textual (`client/src/screens/AcademicHistory.tsx`, `client/src/screens/TableScreens.tsx:78`). Evaluar filtros por periodo, ciclo y tipo, contador de resultados y restablecimiento. Exportar debe explicitar si incluye todo o solo lo filtrado. Los filtros de «aprobado» requieren resolver primero A01.

Valor: encontrar cursos sin recorrer tablas largas. Esfuerzo M; conservar todas las columnas y campos originales, distinguiendo presentación y precisión de origen.

### 3. Plan de estudios legible por ciclo

La representación local tiene ciclo, créditos y prerrequisitos (`client/src/data/transport.ts:127`); la candidata se proyecta de otra forma (`client/src/data/adapters.ts:104`). Evaluar secciones por ciclo y detalle de prerrequisitos exclusivamente cuando esa representación disponga de ellos. Relacionar plan e historial exige identificar claves, equivalencias y periodos antes de mostrar avance.

Valor: entender la secuencia del plan. Esfuerzo M–L. No inferir elegibilidad, equivalencias, aprobación ni permiso de matrícula.

### 4. Ayuda contextual breve

Información de Matrícula ya combina estado, cronograma y orientación (`client/src/screens/EnrollmentInfo.tsx`). Separar claramente «Qué informa el estado», «Qué puede consultar el estudiante» y «Dónde obtener ayuda». Manuales puede servir de destino, siempre que el recurso esté identificado y verificado. Mantener la explicación cerca de la tarea, evitando grandes bloques introductorios.

Valor: menos confusión ante estados no habilitados. Esfuerzo S–M; no prometer acciones habilitadas ni trámites inexistentes.

## Documentación que conviene consolidar

1. **Guía de inicio única:** comandos mock/local, requisitos, variables permitidas y datos sintéticos. Enlaces al backend y a diagnósticos sanitizados; no repetir instrucciones contradictorias.
2. **Diccionario de datos:** campo, tipo, significado, unidad, origen, representación, nulos y regla de presentación. Empezar por `creditaje`, `criterioCalificacion`, códigos de semestre y promedio global/por periodo. Registrar «significado desconocido» explícitamente.
3. **Ficha por pantalla:** finalidad, acciones, estados, contrato aplicable, límites, evidencia y fecha de última validación.
4. **Matriz de aceptación:** escenario, fixture, resultado esperado, método de comprobación y resultado real. Build, funcionalidad, integración y comparación visual deben tener estados distintos.
5. **Guía de UI compacta:** tipografía consistente, separadores de filas, iconos, cifras, tablas, calendario y foco. Adoptar las decisiones recientes sin reinterpretarlas como detalles observados en producción.
6. **Registro de decisiones:** por qué se modificó una interacción, qué conserva de la referencia y qué es mejora local. Mantener referencias antiguas como históricas, sin afirmar que describen el código actual.

## Orden recomendado y aceptación

1. A01 y A03: definir semántica y periodos antes de mostrar nuevos indicadores. Aceptación: campos conocidos se muestran; cero se conserva; desconocido se distingue de ausente; orden de respuesta no cambia «último periodo».
2. A02: actualizar verificación para la UI actual. Aceptación: menú exclusivo, enlace local, agrupación de periodos y horarios con escala comprobados con fixtures sintéticos; estados vacío/error separados.
3. A04 y A05: actualizar documentación para que el siguiente implementador no use supuestos obsoletos. Puede ejecutarse en paralelo con la definición de A01.
4. A06–A11: priorizar agenda móvil, navegación, consulta de formularios y tablas. Aceptación: teclado, viewport móvil, zoom, textos largos y sesiones cortas/solapadas comprobados sin pérdida de información.
5. A12: unificar estilos solo con la verificación de A02 disponible; evitar una limpieza general sin inventario de selectores.
6. Propuestas de producto: seleccionar después de confirmar las tareas y reglas necesarias; no implementar todo de una vez.

Los futuros cambios del cliente requieren `pnpm --dir client build` y `pnpm --dir client lint`. Las pruebas de datos/UI deberán solicitarse o autorizarse y usar exclusivamente fixtures sintéticos. Un cambio backend requeriría su contrato, instrucciones de carpeta y checks correspondientes; no se propone implementar backend en este análisis.

## Decisiones descartadas

- No reportar el horario sin eje de horas como problema actual: ya fue corregido en esta conversación.
- No reportar el menú con varios grupos abiertos como problema actual: ya funciona como acordeón.
- No recomendar habilitar edición, autenticación o matrícula real como «arreglo» de los botones deshabilitados: la réplica tiene alcance de consulta y no hay requisito de escritura.
- No inferir que los valores ausentes están realmente vacíos ni que toda nota sobre un umbral constituye aprobación.
- No certificar WCAG, velocidad o seguridad global a partir de una revisión estática. Esos puntos requieren verificaciones separadas.
