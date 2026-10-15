# Información de Matrícula: mejora UI/UX

- Fecha: 2026-10-09.
- Encargo: mejorar la ruta `/alumnoWebSum/v2/matricula/informacion` manteniendo `DESIGN.md`.
- Coordinación: root, skill `sum-workflow`; disciplina visual `interface-design`.
- Planner real: sum-planner, GPT-6.1 Sol High, tarea `enrollment_ui_plan`.
- Plan/especificación: `plans/matricula-informacion-ui.md` y `screens/matricula-informacion-ui.md`.

## Fuente e intención

Se reutilizan `DESIGN.md`, los contratos MI-CONTRACT-1/MC-CONTRACT-1, la evidencia offline de Información de Matrícula y el código actual. La persona necesita consultar fechas, mensajes y orientación del proceso; la jerarquía debe priorizar esos datos con una presentación institucional y legible. Las mejoras visuales y el índice son decisiones locales.

No se inspeccionó el servidor del operador en localhost:5173 porque puede consumir snapshots privados. Root inició una instancia independiente en 127.0.0.1:5189 con `VITE_SUM_DATA_MODE=mock`, datos sintéticos existentes y bloqueo de solicitudes `/api`/orígenes externos en el navegador de revisión. No se inició un backend ni se accedió a datos privados.

## Observación inicial

Estado raw sintético, scroll inicial 0. Escritorio 1366×900 y móvil 390×844 con navegación cerrada mediante el botón existente. Capturas `evidence/local/matricula-informacion-ui/before-desktop.png` y `before-mobile.png`.

El contenido utiliza un artículo único: fechas, mensaje y orientación tienen jerarquía débil; la lista tiene márgenes diferentes por posición. No hay referencia equivalente que permita acreditar fidelidad visual SUM. La revisión se centra en usabilidad de la réplica y coherencia con DESIGN.

## Estado

MI-UI-1 entregado por el planner. Implementación asignada a sum-implementer, GPT-6 Luna High, tarea `enrollment_ui_implement`, con propiedad de EnrollmentInfo.tsx y EnrollmentInfo.css. Primera entrega pasó build/lint; root comprobó un desbordamiento real (1366 viewport,1646 documento), herencia de dl/dt global y orientación comprimida en `first-pass-desktop.png`. Se asignó un único ciclo de reparación MUI-R1 y se precisó la especificación. Comprobaciones finales pendientes; no cambio de contratos ni datos.
