# Exportación privada: todos los módulos

Fecha de preparación: 2026-10-08 America/Lima. Alcance confirmado por el solicitante: **todos los módulos de la réplica**, con scripts. Entrega: herramienta que el operador ejecuta personalmente; no extracción de sus datos por agentes.

## Fuentes y REA

- Producción autorizada previamente para lecturas/metadatos de la cuenta del solicitante. Esta revisión seleccionó la pestaña estudiantil y observó metadatos y JavaScript frontend público de Inicio. No navegó a nuevas vistas, no ejecutó exportadores, no recopiló cuerpos HTTP, identidad ni valores de storage.
- Reutilizó las16rutas de vistas documentadas y el catálogo de12consultas candidatas. Sólo seis métodos GET tienen la observación de red previa; la API propia NestJS no prueba métodos SUM de otros módulos.
- REA encontró el detector que ejecuta `debugger` cada1000ms y recarga si la pausa supera100ms. Su relación con los fallos del exportador es una inferencia respaldada por ese código y el síntoma del operador. No se ejecutó una exportación real para reproducirla.
- Evidencia mínima: [rea-findings.json](../../../evidence/sum/export-data/rea-findings.json), [fragmento público](../../../evidence/sum/export-data/detector.js). Incluye IDs de target listing, inspección de metadatos, bundle estático, fuente pública, análisis offline y traza de módulo. Análisis estático live:14scripts parseados,0fallos; los endpoints dinámicos jQuery no quedaron resueltos por ese análisis.

## Plan y roles efectivos

Plan persistente: [ME-EXPORT-2](../plans/matricula-export-script.md).

| Etapa | Perfil realmente despachado | Propiedad |
| --- | --- | --- |
| Evidencia, orquestación y revisión estática | Principal | Evidencia, guía y este registro |
| Especificación exacta | `sum-planner`, GPT-6.1 Sol High | Plan ME-EXPORT-2 |
| Implementación conforme al plan | `sum-executor`, GPT-6 Luna High | Los dos scripts `export-sum-all.*.mjs` |

El planner precedió al implementador y fijó navegación, allowlist, estados, formatos, límites, errores y salida. Los trabajadores no delegaron. El principal no afirma haber cambiado de modelo mediante instrucciones textuales.

## Decisión de implementación

Script CDP externo al documento:16vistas GET secuenciales y captura de las12consultas permitidas **cuando la propia página las solicita**, sin adivinar método/payload ni consultar endpoints nuevos. JSON wire preservado; DOM visible separado como `sum-visible-dom-v1`; manifest técnico con faltantes. La carga inicial no cubre otros periodos, pestañas, paginación ni registro de matrícula.

La carpeta `datos-reales/` sigue fuera del acceso de agentes. Autoría de código y revisión estática no incluyen ejecutar el colector, leer la carpeta, iniciar el backend con datos reales o inspeccionar los resultados indirectamente. Los cinco JSON de Matrícula son los únicos consumidos por el importador actual; los demás son suplementarios.

## Revisión y validación

Comprobaciones de entorno realmente realizadas: `node --version` → v24.18.0; lectura **sólo de metadatos** `/json/version` del CDP loopback → Chrome155, accesible y WebSocket anunciado. No se ejecutó el nuevo cliente CDP contra SUM.

La primera revisión estática encontró incompatibilidad del formato DOM, un identificador de retorno indefinido, espera insuficiente de solicitudes pendientes, lock adquirido demasiado tarde, tratamiento incompleto de pausas/navegación y cleanup. Se enviaron los hallazgos juntos a Luna para **un ciclo de corrección**. No se realizaron pruebas de runtime con datos reales ni sintéticos.

Tras ese único ciclo, el principal diagnosticó y corrigió puntos aislados: normalización de etiquetas de opciones seleccionadas, estado checked de checkbox/radio visibles, presupuesto de 30s compartido entre navegación/cuerpos/DOM, corte inmediato ante401/403 y cierre de un WebSocket que abre después del timeout. Esta fue la decisión del principal posterior a la revisión; no se solicitó otro ciclo automático al worker.

Checks finales iniciales: `node --check scripts/export-sum-all.manifest.mjs`, `node --check scripts/export-sum-all.cdp.mjs` y `git diff --check` terminaron con exit0. `git diff --no-index --check /dev/null` de cada script nuevo terminó con exit1 y sin salida: indica contenido añadido, sin avisos de whitespace. La revisión de ME-I1..ME-I8 fue estática. No se ejecutaron tests ni el colector por agentes; no acredita interoperabilidad del ZIP ni cobertura runtime.

## Diagnóstico de la primera ejecución del operador

El operador ejecutó la herramienta y compartió sólo estos diagnósticos: `TARGET_SELECTED valid-page`, `START views=16 queries=12`, `VIEW 1/16 inicio`, `VIEW 2/16 perfil`, `SESSION_OR_SCOPE`. No confirmó ZIP ni recopilación completa. La causa precisa del corte sigue pendiente: el código original agrupaba cambios de ruta/origen y HTTP401/403 bajo ese único código.

REA volvió a listar targets de origen SUM (evidencia `ev_5884945a3ddac5ea9420e70b85e63da303532f587b21a965f4bcce0c488ba426`); la pestaña estudiantil estaba en `/alumnoWebSum/v2/inicio`. Esta observación posterior no prueba el motivo de una redirección ni su estado HTTP. Perfil conserva la ruta previamente documentada. No se navegó ni se recuperaron cuerpos para intentar reproducir el fallo.

Decisión: instrumentación mínima, sin cambiar el gate ni adivinar un arreglo. El principal añadió `SCOPE_DETAIL` con slug de vista, motivo fijo (`frame-navigation`, `document-navigation`, `document-http`, `allowed-request-http`, `unlisted-request-http`), destino limitado a slugs conocidos/enum y HTTP401/403. Nunca imprime URL completa, query, cabeceras, cuerpo ni error nativo. El operador puede repetir el comando y compartir exclusivamente estas líneas. No se añadió referrer ni se modificó la política de navegación sin evidencia de la causa.

Segunda ejecución del operador: `SCOPE_DETAIL view=perfil reason=document-navigation destination=inicio`, seguido de `SESSION_OR_SCOPE`. Ante la pregunta «¿Mi Perfil abre correctamente cuando lo seleccionas desde el menú del SUM?», contestó «No, también vuelve a Inicio». Es evidencia aportada por el operador de indisponibilidad actual mediante navegación normal; no prueba la regla interna del servidor. Se descartó aplicar la hipótesis de referrer: no se hizo ese cambio.

Nueva decisión de alcance ME-EXPORT-3: Sol High revisa el caso limitado de vuelta al Inicio conocido, para marcar la vista como no disponible y continuar módulos accesibles sin exportar Inicio bajo otro nombre. Login, rutas desconocidas, cambio de origen y HTTP401/403 siguen siendo fatales. Este ajuste procede de nueva evidencia del operador y no constituye otro ciclo automático de reparación ME-EXPORT-2. Implementación pendiente de esa especificación.

Estado de entrega: scripts preparados y revisados estáticamente; ejecución completa pendiente del diagnóstico privado del operador. La extracción total y la compatibilidad real permanecen sin verificar. Los agentes mantienen la prohibición de acceso a `datos-reales/`.

Guía de uso: [private-snapshots.md](../private-snapshots.md).
