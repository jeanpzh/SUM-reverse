# RESOURCE-UI-1 — entrega integrada

Fecha: 2026-11-07. Código integrado: `0f7c90b`, base `75c3536`. Fuentes: [brief fijo](../../../docs/reverse-engineering/plans/planning-resource-workbench.md), [plan aprobado](../../../docs/reverse-engineering/plans/planning-assisted-workflow.md), código y fixtures sintéticos independientes. Clasificación: requisito local y observación del prototipo; no conducta SUM.

## Intervención del principal

Ante la demora reportada por el usuario, se canceló el worker original (estado final `interrupted`) y se conservaron sus cambios en su checkout. No se inició otro worker. La revisión separó los fallos de selectores de prueba y la integración funcional del defecto de layout al ampliar Recursos. La prueba aislada pasó generación, guardado, recarga/recuperación y aprobación/consulta, y reprodujo un desborde de 43px (507px disponibles, 550px de contenido).

Se corrigió el reflujo de pestañas y los límites de ancho, y se eliminó una regla que ocultaba overflow de la tabla de Cursos ajena al alcance, además de una sombra decorativa incompatible con A. La prueba de layout pasó con 507/507 y ningún elemento fuera del contenedor. El script admite fases `integration` y `layout` para diagnosticar solo el tramo afectado; su resumen enumera únicamente los criterios ejecutados. No se considera que una fase aislada apruebe toda la suite.

La regresión general se adaptó a la retirada por selección múltiple y a puertos de prueba seguros. Se restauró su variable `root` y se consolidó la comprobación de puertos; no se rebajaron las aserciones de negocio. El servidor de demostración del usuario,3210/5176, no se usó para pruebas ni se detuvo.

## Resultados reales

| Criterio / comprobación | Esperado | Resultado |
| --- | --- | --- |
| RUI1–RUI3 | Cero fichas iniciales, una ficha de recurso como máximo, búsqueda/contadores y consulta sin incorporación implícita | Suite completa candidata llega a fin con exit0 |
| RUI4–RUI6 | Vista previa/cancelar/confirmar, duplicados y campos existentes | Suite completa exit0; límites y helpers también cubiertos en tests de datos |
| RUI7 | Cliente → NestJS real: generar, guardar, recargar y continuar | Cumple en candidato y raíz integrada (fase integration, exit0) |
| RUI8 | Aprobación por API real y consulta de recursos congelados | Cumple en candidato; sin manipular el DOM para fingir bloqueo |
| RUI9 | Foco de tabla,720px sin overflow, texto>=12px y reflujo CSS200% | Cumple; no equivale a zoom nativo ni auditoría completa de contraste/teclado |
| Cliente build/lint/test:data | Exit0 | Cumple en candidato y raíz integrada; 252/252 tests de datos |
| Regresión académica general adaptada | Exit0 | Cumple en candidato con el mismo código integrado: edición/regeneración, demanda0, invalid-input, retención, recuperación de red y guardia estudiantil |
| Alcance del diff | Sin contratos/backend/componentes estudiantiles modificados | Cumple; siete archivos de cliente, conforme al brief |

Comandos ejecutados: `pnpm --dir client build`, `pnpm --dir client lint`, `pnpm --dir client test:data`, `timeout 120 env -i PATH="$PATH" node client/scripts/verify-academic-resources.mjs` (exit0 en candidato), `timeout 150 env -i PATH="$PATH" node client/scripts/verify-academic-scheduling.mjs` (exit0 en candidato) y las fases focalizadas del script de recursos. Puertos propios3411/5411 comprobados libres, backend standalone sintético y directorio temporal exclusivo de borradores; sin datos privados ni servicios del operador. Los artefactos PNG/JSON históricos regenerados no forman parte del commit de implementación.

La primera comprobación en raíz falló durante la navegación inicial al aplicar el límite de acción10s al arranque de Vite en paralelo con build. Se separó el tiempo de navegación45s y se esperó DOMContentLoaded, manteniendo10s para acciones y todas las aserciones funcionales. No fue un timeout de guardado ni un fallo de la API.

## Límites y siguientes entregas

Esta entrega reorganiza Recursos. No incluye todavía base reutilizable/metadata de revisión, Resumen como entrada, nuevo contrato de estado desactualizado, rondas/regeneración parcial ni estimador/integración de96 cursos. Auditoría independiente pendiente; no se declara realizada ni se sustituye por las pruebas. Reutilizar el código y la evidencia ya suficientes en próximas entregas y repetir solo los checks afectados.

Comprobación final integrada: `timeout 100 env -i PATH="$PATH" SUM_TEST_PHASE=integration node client/scripts/verify-academic-resources.mjs` terminó con exit0, RUI7/RUI8/RUI9 aprobados. El endpoint del módulo React por el enlace remoto devolvió200 y contiene el nuevo workbench. Esta última comprobación acredita disponibilidad del código servido, no una comparación visual.
