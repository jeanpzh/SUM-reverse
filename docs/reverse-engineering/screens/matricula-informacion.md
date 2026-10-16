# Información de Matrícula

## Revisión actual: 2026-10-08, MC-CONTRACT-1

REA autorizado observó GET/200 de formulario e información; fechas/mensaje visibles, sin botón de inicio y con controles de formulario ocultos. El JS público determina los bindings y condiciones de perfil/mensaje, además del gate de formulario y redirección a registro, cuya ejecución no se observó. [Evidencia](../../../evidence/sum/matricula-compatibility/behavior.md).

La réplica admite ahora el envelope raw íntegro además del artículo local previo: presenta fechaDB/fecIniMatInternet/fecFinMatInternet/mensajeMatricula y mensaje/perfil condicionados según fuente. La orientación de cinco secciones se identifica como local. Snapshots offline y validación compartida están integrados; no se recrea inicio/registro/confirmación ni se interpreta el perfil como autorización. [Contrato actual](../contracts/local-api/matricula-compatibility.md) y [aceptación sintética](../../../evidence/local/matricula-compatibility/fullstack-verification.md). El resto de esta página conserva el historial MI-CONTRACT-1, no sustituye esta ampliación.

- **Ruta:** `/alumnoWebSum/v2/matricula/informacion`.
- **Interfaz observada:** artículo informativo con introducción y cinco secciones numeradas sobre cronograma, acceso, prematrícula, deudas e interfaz de matrícula; no había botones/formularios visibles en el estado inspeccionado.
- **Interacciones:** contenido estático en el estado observado; no se inició una acción de matrícula.
- **Evidencia:** `evidence/sum/matricula-informacion/{structure,interactions,measurements}.md`; tipo candidato `raw-types/matricula-info.ts`.
- **Límite:** texto local es paráfrasis anotada; no se verificaron cambios estacionales, habilitación ni enlace desde esta pantalla.
- **Confianza:** media-alta en composición y temas; baja en reglas de control y texto exacto.
- **Navegación:** la captura de sidebar suministrada por el operador etiqueta esta opción como “Matrícula Vía Internet”. En la réplica se vincula a la ruta local documentada arriba; la captura no demuestra el destino.
- **Verificación local:** REA controlled replay `ev_8408d7501e82732e71a7d462facbaffb14321b211d5bc1eb19d28809b580130b` abrió esta ruta desde el menú de la réplica y observó las cinco secciones. Sin referencia de contenido sanitizada, la fidelidad visual queda sin verificar.

## Ampliación integrada propia, revisión MI-CONTRACT-1

- **Estado:** implementada en backend y cliente según el plan Sol High del 2026-10-08; build/lint aprobados según entregas Luna High. La integración local aprobó 11/11 escenarios; la fidelidad respecto a SUM sigue sin referencia comparable.
- **Plan reutilizado:** [Matrícula](../plans/matricula.md); [handoff exacto para Luna High](../plans/matricula-informacion.md).
- **Contrato fijado:** [API propia Información de Matrícula](../contracts/local-api/matricula-informacion.md). Consulta readonly POST con acción `obtenerInformacion`, cuerpo ausente o `{}`; `data={codSemestre,articulo}`. Contenido servido por NestJS propio y validado en frontera React.
- **Decisión local:** el artículo observado y el candidato de flags académicos son fuentes distintas. La réplica local sirve introducción y cinco secciones explícitas; no usa flags para habilitar/bloquear acciones ni añade inscripción. El endpoint legado mantiene su compatibilidad mediante unión de tipos y adaptador para modos mock/api.

Estructura conservada: `PageTitle` exterior “Información de Matrícula”; `<article className="enrollment-article">` con `<h3>` de introducción y `<ol>`; cada sección contiene `<li>`, `<h4>` y `<p>`, con clave ID estable. Reutilizar estilos existentes y shell. En populated, títulos en orden: Control de Cronograma de Matrícula, Control de Acceso de Facultad, Control de Pre-Matrícula, Control de Deudas Registradas e Interfaz de Matrícula. Los textos concretos del seed son paráfrasis locales especificadas en contrato; el párrafo de cronograma añade el periodo sintético `2026-2`.

El loader de la ruta pasa `AbortSignal` y consulta `matriculaInfo`; el componente consume su respuesta adaptada y deja de poseer una constante de secciones. En local, contenido nulo produce texto vacío explícito y los errores producen estado de error, nunca las paráfrasis de respaldo. Estas paráfrasis se mantienen únicamente para un DTO heredado válido en mock/api. No agregar formulario, descargas, reglas de deuda o controles de matrícula.

| ID | Estado / resultado esperado | Fuente / clasificación | Comprobación | Obligatorio |
| --- | --- | --- | --- | --- |
| MI-S1 | Misma ruta y navegación observada local, título y cinco temas numerados del artículo. | structure/interactions y REA histórico local; composición `observed`, implementación propia. | MI-UI; DOM de ruta directa/menú, sin controls nuevos. | Sí |
| MI-S2 | Contenido de introducción/títulos/párrafos responde al JSON de NestJS, primer párrafo local incluye periodo del seed. | MI-CONTRACT-1, `local-only`. | MI-HTTP + MI-UI contra servidor real; variar contenido en experimento de frontera prueba adaptación. | Sí |
| MI-S3 | Durante espera, `role=status` “Cargando información…”; luego artículo válido. | RoutePending existente, comportamiento `local-only`. | MI-LOADING con respuesta real demorada. | Sí |
| MI-S4 | Artículo nulo: “No hay información de matrícula disponible.” y ninguna lista. | Decisión `local-only`; estado original no observado. | MI-EMPTY backend real, sin fallback. | Sí |
| MI-S5 | Red/HTTP/JSON/contrato inválido: alert y “Intentar de nuevo”; recuperación con nueva lectura200. | RouteError existente y contrato, `local-only`. | MI-RECOVERY/MALFORMED; sin contenido aparente exitoso. | Sí |
| MI-S6 | Readonly, periodo coherente, request estricto, repetición/reinicio y modos existentes compatibles. | Contrato y módulos propios, `local-only`. | MI-INVALID/READONLY/ENV/MODES/REGRESSION; build/lint ambas capas. | Sí |
| MI-S7 | Texto exacto, condiciones habilitación y apariencia SUM comparable. | `unverified`; no screenshot sanitizado o traza suficiente. | Requiere evidencia de referencia futura; fuera de aceptación propia. | No |

Los resultados históricos de la réplica no acreditan esta integración nueva. Cerrar como integración verificada únicamente después de MI-V1; fidelidad SUM y recuperación de internos privados permanecen afirmaciones separadas.

