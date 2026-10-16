# Plan: jerarquía y orientación de Información de Matrícula

- ID `matricula-informacion-ui-2026-10-09`, revisión **MI-UI-1**, estado **lista para Luna High**.
- Planner: rol real `sum-planner`, GPT-6.1 Sol High; solo documentación asignada, sin delegación, implementación, servidor, navegador ni pruebas de aplicación.
- Alcance: mejora UI/UX local de `/alumnoWebSum/v2/matricula/informacion`, respetando DESIGN.md. [Especificación exacta](../screens/matricula-informacion-ui.md).
- Reutilizar [MI previo](matricula-informacion.md) y [MC aceptado](matricula-compatibility.md), pantalla, adapter, loader y RouteStatus. Sus tareas API/transporte/validación/integración ya realizadas se conservan; no vuelven a planificarse.
- Contrato frontend/backend fijo: **MI-CONTRACT-1 + extensión MC-CONTRACT-1**, sin nueva revisión HTTP ni cambios backend. La interfaz de pantalla sigue `response: ApiResponseMap['matriculaInfo']` y los adapters actuales.
- Complejidad media (composición y responsive), incertidumbre media (jerarquía propuesta sin referencia equivalente), impacto medio (riesgo de confundir orientación con datos académicos); UI reversible, privacidad/procedencia tienen alto impacto.

## Decisión Sol y límites

Sol fija la separación entre estado raw y artículo local: destacar mensajeMatricula, agrupar tres fechas intactas, conservar condiciones exactas de mensaje/perfil y etiquetar la orientación; el índice solo navega dentro de ella. No convierte flags ni fechas en elegibilidad o habilitación de acciones. Así Luna puede implementar dos archivos con criterios claros sin decidir reglas académicas ni extender la API.

Observado: fuentes offline de estructura/medidas, comportamiento MC y código actual enumerados en la especificación. Hipótesis: jerarquía e índice mejorarán consulta/lectura; resultado pendiente de comprobación local. Decisiones local-only: alineación del encabezado, paneles, escala, índice, procedencia visible, responsive y teclado. Sin fidelidad visual SUM verificable: ausencia de screenshot comparable, periodos/ramas alternativos no observados. No requiere volver a producción.

## Invariantes de impacto

| ID | Invariante | Aceptación |
| --- | --- | --- |
| MUI-I1 | Fuente exclusivamente código/evidencia previa/sintéticos. No datos-reales ni aplicación/API existente ni puerto5173. | Root administra preview aislado con mock explícito y origen nuevo; workers no navegan. |
| MUI-I2 | Prop, adapter, validadores, API, loader, modos y AbortSignal actuales conservados. | Diff solo pantalla/CSS; build/lint. Sin backend ni nuevas requests. |
| MUI-I3 | Mensaje solo !indMatHabilitada; perfil solo !indMatHabilitada && valProgramacion!==null. | Tres variantes raw; ausencia/presencia exactas. Sin reglas de permiso. |
| MUI-I4 | Periodo es response.data.codSemestre; fechas/números/texto intactos. | Variant periodo diferente al shell y strings largos; comparación visible contra sintético. |
| MUI-I5 | Orientación es local, IDs/orden/textos preservados; null no cae a respaldo. | Cinco destinos/anchors/temas, nota visible, vacío sin ol. |
| MUI-I6 | Sin mutaciones, inscribir, gates de formulario, enlaces SUM/valProgramacion, HTML interpretado o dependencias. | Diff y review del comportamiento local. |
| MUI-I7 | CSS de pantalla no cambia shell/otras rutas. | Clases nuevas scoped; App.css/Common/RouteStatus sin escritura. |

## Handoff y propiedad

Worker futuro `sum-implementer`, GPT-6 Luna High; leer `client/AGENTS.md`, `client/.agents/skills/sum-react-implement/SKILL.md`, DESIGN.md y esta especificación antes de editar. `interface-design` se aplica con dirección ya fijada; no nueva aprobación ni archivo de sistema alternativo. No estás solo en el repositorio: preservar cambios ajenos, no revertirlos. No delegar ni usar navegador/servidor.

Archivos exclusivos del worker: `client/src/screens/EnrollmentInfo.tsx` y nuevo `client/src/screens/EnrollmentInfo.css`. La ruta no necesita cambio: pending/error/loader están definidos y se reutilizan. Si una comprobación demuestra brecha de estado, root asigna explícitamente `client/src/routes/alumnoWebSum.v2.matricula.informacion.tsx` antes de corregir; solo wrappers visuales de esa ruta, sin cambiar semántica ni componentes globales. No editar data/, backend/, shared/, App.css, index.css, Common, RouteStatus, DESIGN o contratos. No nuevos paquetes.

Propiedad planner: este plan y `screens/matricula-informacion-ui.md`. Root: workflow/evidencia, preview/mock aislado y navegador, resultados y actualización de estado del plan después de entrega. No dividir client/backend: backend no tiene tarea pendiente en este alcance.

## Tareas pequeñas y dependencias

Todas las tareas de código son secuenciales dentro del mismo worker porque comparten pantalla. CSS es archivo exclusivo suyo; no se lanza otro implementador en paralelo para estos archivos.

| ID / resultado | Dependencia / interfaz | Archivos | Aceptación | Estado / verificación |
| --- | --- | --- | --- | --- |
| MUI-P1 fijar composición y contrato UI | MI/MC + DESIGN + código offline | Dos docs asignados | Props, condiciones, diseño, ownership y casos delimitados | Completada; revisión documental y diff. |
| MUI-C1 encabezado/contexto y estado | MUI-P1; response actual/raw narrowing | EnrollmentInfo.tsx | PageTitle único, subtítulo, periodo de respuesta; estado/crono separados; mensaje/perfil exactos | Lista; MUI-DATA/BRANCH. |
| MUI-C2 orientación/índice/vacío | MUI-C1; article del adapter existente | EnrollmentInfo.tsx | Nota local, títulos/descripciones intactos,5anchors/IDs,ol ordenado; null sin índice | Lista; MUI-INDEX/EMPTY. |
| MUI-C3 jerarquía y responsive scoped | MUI-C2; clases de spec | EnrollmentInfo.css + import/clases en tsx | Poppins, blancos/azul/borde discreto,grids que colapsan,espaciado uniforme,foco,textos largos | Lista; MUI-VISUAL/ACCESS. |
| MUI-C4 checks y entrega | MUI-C3 | Mismos dos archivos | build/lint aprobados, diff scoped, reporte de criterios | Pendiente; comandos debajo, worker sin navegador. |
| MUI-V1 revisión UI sintética | MUI-C4 + preview seguro preparado root | Evidencia propia root | Casos en tabla,desktop/móvil y keyboard; resultados honestos | Pendiente; root navegador exclusivo. |

No pruebas nuevas: casos browser son criterios para revisión root autorizada, no instrucción al worker de ejecutar suites. Reparaciones 0; máximo una reparación automática de discrepancias verificadas, registrar cambios y volver a checks afectados. Si falla después, diagnosticar y escalar solo decisión concreta pendiente; no replanificar toda la pantalla.

## Casos de aceptación de root

Preview aislado explícitamente sintético, distinto de 5173, sin conectar APIs existentes ni snapshots privados. Root conserva before/after con viewport/ruta/scroll/fixture equivalentes. Preview mock acredita UI local, no integración NestJS ni apariencia SUM.

| ID | Datos/acción | Resultado obligatorio |
| --- | --- | --- |
| MUI-DATA | Raw sintético default, periodo distinto del shell | Título/subtítulo/periodo exacto; Estado de Matrícula con mensajeMatricula; tres fechas exactas; nada «apto/habilitado/ventana abierta» derivado. |
| MUI-BRANCH | Raw a)true con valProgramacion no null b)false/null c)false/no null | a)sin mensaje/perfil b)mensaje sin perfil c)mensaje+cinco campos perfil+aviso cronograma. Nada consume enlace_cronograma. |
| MUI-ARTICLE | Respuesta artículo propia con título/descripción personalizados | Datos de API shape sin estado/crono/perfil raw,cinco temas y metadato correcto; etiqueta orientación local visible. No constante duplicada. |
| MUI-INDEX | Tab/Enter en cada uno de 5 anchors | Nombres exactos,orden/IDs únicos,fragmento y destino correspondiente visibles bajo header; foco perceptible y navegación sin request/mutación. |
| MUI-EMPTY | Forma artículo con articulo:null | Encabezado/periodo+texto vacío exacto,cero índice y lista. Nada aparenta consulta exitosa tras error. |
| MUI-STATE | Espera y fallo específicos simulados solo en preview seguro; retry | status «Cargando información…»; error alert+Intentar de nuevo; relectura recupera; sin mock ocultando error. Registrar simulado, no integración real. Reutilizar RouteStatus. |
| MUI-VISUAL |1366×900 y 390×844 (sidebar cerrada con el botón existente), scroll 0 y sección final, synthetic before/after equivalente | Mensaje/crono claros,ritmo consistente,textos legibles,índice local,secciones completas,azul/Poppins/shell vigente. No paridad SUM declarada. |
| MUI-ACCESS |320px y200%zoom,textos largos,salto por índice | Sin overflow horizontal de pantalla,overlap/clipping; todos los textos envuelven;anchors 44px,foco visible,contraste 4.5:1 texto normal/ 3:1 componentes,headings ordenados y dl semántico. |
| MUI-SCOPE | Revisión diff y una ruta ajena en mock aislado si root lo considera útil | Solo screen/CSS cambian; no CSS global alcanzando otras rutas,no nuevas acciones ni deps. |

Worker ejecuta `pnpm --dir client build` y `pnpm --dir client lint`; root o worker `git diff --check`. No `test:data`, suites ni `verify` global exigidos para este cambio visual. Planner no ejecutó esos comandos de aplicación ni verificó casos browser.

## Estado final de planificación

Plan/spec listos; código y aceptación UI pendientes. Root informó un before sintético capturado, que permite comparar mejora local; planner no reclama haberlo visto. La revisión documental fija contrato vigente y diferencias de presentación. Ningún bloqueador exige nueva autorización; los gaps SUM permanecen explícitos y fuera de esta aceptación local.
