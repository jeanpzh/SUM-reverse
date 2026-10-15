# Información de Matrícula: mejora UI local

- Revisión **MI-UI-1**, 2026-10-09. Ruta `/alumnoWebSum/v2/matricula/informacion`.
- Complementa [especificación vigente](matricula-informacion.md), [MI-CONTRACT-1](../contracts/local-api/matricula-informacion.md) y, para raw, [MC-CONTRACT-1](../contracts/local-api/matricula-compatibility.md). No sustituye contratos ni tareas aceptadas.
- Objetivo: localizar el estado informado, leer fechas y recorrer la orientación con jerarquía institucional, teclado y pantalla pequeña. Esta composición es **local-only**; no certifica apariencia SUM.
- Guía principal: [DESIGN.md](../../../DESIGN.md). `interface-design` aporta disciplina de jerarquía, densidad y semántica; sus sugerencias genéricas no cambian la dirección institucional ni requieren nueva aprobación de la implementación ya solicitada.

## Fuentes, reglas e incertidumbres

| Fuente | Clasificación | Uso y límite |
| --- | --- | --- |
| `evidence/sum/matricula-informacion/{structure,interactions,measurements}.md` | observed histórico | Título, introducción y cinco temas ordenados; sin screenshot sanitizada ni estado interactivo suficiente para paridad. |
| `evidence/sum/matricula-compatibility/behavior.md`, contrato MC sección Información | observed estático/runtime delimitado | Fechas y mensajeMatricula; condiciones de mensaje/perfil. No acredita permisos ni transacciones. |
| EnrollmentInfo, toEnrollmentArticle, matriculaInformacion y ruta leídos offline; CodeGraph primero | observed local estático | Props, ramas, texto, loader y estados actuales. No es prueba funcional de la mejora. |
| `evidence/local/matricula-informacion-ui/before-desktop.png` | local-only sintético, informado por root | Root informa viewport 1366×900 y jerarquía pobre del dl/lista; planner no inspeccionó navegador ni imagen. |
| Jerarquía, índice, medidas responsive y etiquetas de procedencia de este documento | local-only | Decisiones de réplica, sin atribuirlas a SUM. |

Hipótesis de UX: agrupar estado y cronograma y ofrecer navegación interna hará más fácil encontrar un dato. Debe comprobarse visualmente en el entorno sintético de root; no se presenta como resultado medido. Se desconoce apariencia SUM equivalente, móvil, ramas habilitadas alternativas y texto estacional. No hay observaciones nuevas de producción.

## Frontera de datos fijada

Mantener exactamente la prop pública `EnrollmentInfo({ response }: { response: ApiResponseMap['matriculaInfo'] })`. Consumir `response.data.codSemestre`, `toEnrollmentArticle(response.data)` e `isRawMatriculaInformacion(response.data)` actuales. No nueva request, hook de alumno, summary, validator, adapter, fallback o prop de identidad/modo.

| Parte visible | Fuente / condición | Regla |
| --- | --- | --- |
| Periodo académico | `response.data.codSemestre`, ambas formas | Mostrar cadena recibida en el encabezado; jamás periodo del shell ni un valor fijo. |
| Estado de Matrícula | Solo raw | `mensajeMatricula` como texto principal bajo la etiqueta «Mensaje de matrícula». No badge «habilitada», «matriculado», «apto» ni inferencia de permiso. |
| Mensaje complementario | Raw y `!raw.indMatHabilitada` | Mostrar `raw.mensaje` en el mismo bloque, con condición exacta actual. Sin duplicarlo en cronograma. |
| Cronograma de matrícula | Solo raw | Dl con etiquetas actuales: Fecha del sistema, Inicio de matrícula por Internet y Fin de matrícula por Internet; valores fechaDB/fecIniMatInternet/fecFinMatInternet intactos. |
| Perfil académico | Raw y `!raw.indMatHabilitada && raw.valProgramacion !== null` | Cinco etiquetas/valores actuales: Permanencia, Año de ingreso, Año de estudio, Promedio y Situación académica. Mantener «Información de cronograma disponible para esta consulta.» Sin interpretar valProgramacion ni montar href suyo. |
| Orientación | `article !== null` | Introducción, títulos y descripciones dinámicos actuales, cinco IDs/orden vigentes. Raw usa adaptación local existente, sin cambiarla. |
| Vacío | `article === null` | Texto exacto «No hay información de matrícula disponible.»; sin índice ni lista ni orientación de respaldo. |

No transformar fechas mediante Date, zona horaria, formato, cuenta regresiva o comparación con hoy. Renderizar números del perfil directamente, sin redondear ni añadir escala. Todas las cadenas se montan como texto React; conservar texto y saltos significativos, nunca HTML interpretado. Valores vacíos no se reemplazan por fechas/mensajes académicos inventados.

## Composición y dirección

Checkpoint `interface-design` fijado para Luna: estudiante consultando información; foco en mensaje recibido y fechas; azul institucional para títulos/enlaces/foco; blanco para superficie; bordes discretos como estrategia de profundidad; Poppins para página; ritmo de 4px, separaciones8/12/16/24 y padding20 desktop/16 móvil. Conceptos del dominio: periodo, consulta, cronograma, perfil, orientación, matrícula. Firma: título SUM en azul, periodo académico rotulado, cronograma semántico, lenguaje español existente y orientación numerada.

1. Envolvente `.screen-matricula-informacion`, sin segundo main. Encabezado con PageTitle existente «Información de Matrícula», subtítulo local «Consulta el estado informado, el cronograma y la orientación del módulo.» y metadato «Periodo académico» + codSemestre. Título alineado al inicio en esta pantalla, 24px/600 desktop y 22px móvil; PageTitle mantiene su h2. Override scoped elimina height fija 46px y alineación centrada. Una sola instancia del título.
2. Si raw: grupo superior con dos secciones hermanas «Estado de Matrícula» y «Cronograma de matrícula», h3. Estado: etiqueta secundaria, mensajeMatricula16px/500/line-height1.6 como foco, mensaje complementario debajo cuando corresponde. Cronograma: dl de tres entradas con dt encima de dd, dd legible y tabular nums. Desktop≥900px: columnas `minmax(0, 1fr)` iguales con gap 16px; menor ancho: columna única. Sin timeline ni semáforo de fechas.
3. Perfil condicionado como sección blanca compacta independiente, h3 y dl que refluye en columnas de al menos 180px cuando caben; una columna en móvil. Mantener orden DOM y todos los valores. No título, resumen del alumno o aviso de cronograma cuando la condición falla.
4. Orientación como un article blanco, encabezado h3=`article.introduccion`. Antes del contenido, mostrar en todas las formas «Orientación local de demostración». Con raw conservar además el aviso actual exacto «Orientación local de demostración; no forma parte de la respuesta del estado académico.»; puede usarse como párrafo único bajo una etiqueta breve, evitando repetir el párrafo íntegro. Con artículo propio, nota local «Contenido informativo de la réplica local.» La etiqueta evita presentar paráfrasis como instrucciones oficiales.
5. Índice `<nav aria-label="Índice de orientación local">` con rótulo «En esta orientación» y ol de cinco anchors. Texto de anchor=section.titulo intacto. Ubicación: antes de la lista de contenido, dentro de orientación; desktop usa dos columnas para índice si cabe, móvil una. No sticky, scrollspy, acordeón o tabs.
6. Contenido ol independiente: cinco li en orden, encabezado h4=`titulo`, párrafo=`descripcion`, clave ID actual. Número visible y semántico, sangría 1.5rem; separación uniforme 24px y títulos 17px/500. No cajas individuales grandes para cada párrafo. IDs destino `matricula-orientacion-${id}` en h4 con tabIndex=-1; href del índice correspondiente. Fragmento desplaza y permite foco del destino; outline visible también en destino enfocado. No enlaces entre pantallas en esta revisión: el índice satisface el caso de navegación solicitado sin inventar equivalencias de «Control de Acceso» o «Interfaz».

Las subsecciones usan h3 y los temas h4, coherentes con PageTitle h2 actual. No nuevas ilustraciones, iconos, chips de flags o acciones académicas. Estado/cronograma/perfil/orientación usan superficies blancas y borde tenue, radio 8px como decisión local, sin sombras decorativas. Mensaje principal gana por posición/peso, no por color de éxito/error inferido.

## CSS, responsive y acceso

Nuevo `client/src/screens/EnrollmentInfo.css`, importado por la pantalla, con selectores bajo `.screen-matricula-informacion` y clases `enrollment-info__*`. Evitar reutilizar la clase global `enrollment-article`: sus reglas nth-child y ol sin sangría distorsionan el nuevo ritmo. Retirar su uso de esta pantalla; no editar App.css ni componentes comunes para compensarlo. Variables locales semánticas: fondo blanco, texto #4c545f, título/brand #203e91, enlace #1c62b1, borde tenue y fondo auxiliar azulado elegidos dentro de DESIGN; colores son decisiones locales, no nuevos tokens medidos SUM. Poppins,Arial,sans-serif scoped; reutilizar font-face existente, sin descargar fuentes ni simular assets.

- Cuerpo14px, line-height1.6; párrafos de lectura máx75ch, panel de orientación al ancho disponible, min-width0 en hijos de grid. No fijar width100% en el main que conserva márgenes del shell. Bordes y espacios con escala4px. Etiquetas secundarias legibles14px; no información esencial en color tenue de contraste insuficiente.
- A 320/390px de viewport no hay desbordamiento horizontal atribuible a la pantalla. Anchors y texto largo envuelven; dl no tiene dd con margen predeterminado ni alturas fijas. Padding16px, gap 16px. A 200% zoom no se pierde contenido ni índice.
- Anchors nativos con destino único, área mínima44px de alto mediante padding, :hover subrayado y :focus-visible outline 2px offset 3px con contraste suficiente. DOM del índice coincide con orden del contenido; no controles clickables no semánticos.
- Destinos scroll-margin-top 80px para quedar bajo header 64px actual; ajustar solo si root comprueba otro obstáculo en preview seguro. Sin scroll animado forzado; respetar reduced-motion si se añade transición de color.
- Estado informativo estable no usa role=alert ni aria-live por sí solo. Loading/error conservan RoutePending role=status y RouteError role=alert/reintento existentes. El periodo y el vacío siguen legibles sin depender del color.

## Estados y aceptación

RoutePending y RouteError y loader/AbortSignal siguen disponibles sin editar la ruta. El error no monta orientación ni datos exitosos; reintento mantiene su lectura existente. No nueva lógica de carga en EnrollmentInfo. Artículo nulo muestra encabezado/periodo y un panel vacío sin anchors. Los detalles de apariencia/recuperación de estos estados se verifican con escenarios sintéticos de root, no API existente.

Criterios y tareas verificables en [plan MI-UI-1](../plans/matricula-informacion-ui.md). Backend, API, persistencia y fidelidad visual SUM no tienen cambios; verificación mock de esta mejora solo acredita UI local.

## Ajuste tras primera revisión sintética

Root observó en 1366×900 un ancho de documento1646 por aplicar width100% al main con margen280. También el CSS global de dl/div y dt hacía que las etiquetas siguieran a35% en filas flex. Se asignó un ciclo de reparación: eliminar ese ancho explícito, restablecer bloques dt/dd y sus anchos/espacios mediante selectores scoped, y usar el ancho completo del panel de orientación con índice aproximado240px y columna de lectura flexible. El límite75ch se aplica a párrafos, no al panel que contiene ambas columnas. Fuente: `evidence/local/matricula-informacion-ui/first-pass-desktop.png`; decisión local, sin cambio de datos.
