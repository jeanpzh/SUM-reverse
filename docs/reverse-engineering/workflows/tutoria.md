# Tutoría — simulación del flujo

Fecha: 2026-10-08. Modo: `simular`. Ruta: `/alumnoWebSum/v2/tutoria`. Slug documental y de evidencia: `tutoria`.

Objetivo: especificar, evaluar la implementación existente y preparar aceptación local del estado vacío observado. Restricción de esta ejecución: no modificar frontend/especificación, no ejecutar pruebas, no adquirir evidencia ni contactar SUM.

## Artefactos reutilizables

- [Especificación existente](../screens/tutoria.md): fuentes y límites del estado vacío; falta convertirlos en criterios identificables, obligatorios y verificables.
- [Estructura](../../../evidence/sum/tutoria/structure.md), [medidas](../../../evidence/sum/tutoria/measurements.md), [interacciones](../../../evidence/sum/tutoria/interactions.md) y [referencia sanitizada](../../../evidence/sum/tutoria/reference.png): respaldo suficiente para trabajar en especificación e implementación del estado observado. No cubren filas/acciones ni un contrato poblado.
- Implementación existente en `client/src/routes/alumnoWebSum.v2.tutoria.tsx`, `client/src/screens/TableScreens.tsx` y componentes/estilos compartidos: candidatos a reutilización, sin ediciones en esta simulación.
- [Verificación local de Tutoría](../../../evidence/local/tutoria/verification.md) y [registro global](../../../evidence/local/verification.md): resultados históricos, sin correspondencia de huellas que acredite el código actual. Hay cambios previos en componentes, estilos y script verificador.

## Decisiones y gates

| Etapa | Decisión simulada | Gate de entrada | Salida necesaria |
| --- | --- | --- | --- |
| Nueva investigación | Omitir | Ya existen notas y referencia sanitizada suficientes para el estado vacío | Cero llamadas REA y cero inspección SUM |
| `sum-evidence-to-spec` | Proponer completar incrementalmente | Fuentes verificadas del estado vacío | Especificación lista para ese alcance, con criterios de ruta/título, seis columnas, mensaje vacío, contador y geometría visible; exclusiones e incertidumbres explícitas |
| `sum-frontend-implement` | Proponer diagnóstico condicionado al gate documental | Especificación lista y autorización futura para editar | Reutilizar código y omitir cambios si satisface criterios; modificar solo diferencias comprobadas |
| `sum-frontend-verify` | Proponer después de los gates anteriores | Código/especificación identificables y entorno local seguro | Resultados actuales por criterio, comparación de región válida y dictamen funcional/visual separado |

La referencia SUM es un recorte de **1256 × 568**; las notas sitúan el área principal en **(280, 70)** con viewport del navegador de **1536 × 735**. El candidato completo histórico mide 1536 × 735 y `main-candidate.png` mide 1256 × 568. Comparar la misma región, excluyendo cabecera y resumen enmascarados. El scroll no está explícitamente retenido en las notas: no presumir cero ni certificar criterios visuales que dependan de ese dato hasta acreditar correspondencia con fuentes existentes o evidencia segura. Esto no impide completar criterios estructurales respaldados ni evaluar código.

Las futuras comprobaciones se seleccionarán desde `client/package.json` y el plan vigente: Playwright local para ruta/tabla/estado, build/lint si hay cambios del cliente y `test:data` si se afectan adaptadores/contratos. Ninguna se ejecutó aquí. El diagnóstico estático no sustituye estas comprobaciones ni convierte resultados históricos en aceptación actual.

## Estado final

**`simulado`**. Disposición prevista: **especificación incremental → diagnóstico/reutilización de implementación → verificación local → aceptación condicional del estado vacío**.

No existe bloqueo de evidencia para trabajar en especificación e implementación del estado vacío. La aceptación funcional/estructural sería condicional a pruebas vigentes. Los criterios visuales que requieren scroll comparable quedan bloqueados con los metadatos actuales. Antes del handoff debe declararse si fidelidad visual es obligatoria; si lo es, no se puede prever aceptación integral mientras falte ese dato. Estado poblado, acciones desconocidas y regiones enmascaradas quedan fuera del alcance; no se declara aceptación actual.
