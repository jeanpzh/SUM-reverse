# Plan: módulo Mi Información

- **ID:** `mi-informacion-2026-10-08`
- **Objetivo:** completar localmente las vistas respaldadas de Mi Información y dejar criterios sin soporte explícitamente bloqueados.
- **Alcance:** desplegable Mi Información, Mi Perfil, Historial Académico, Formulario de Datos Personales y Ficha Socioeconómica.
- **Aceptación:** navegación y estructura con fixtures locales; controles representan el estado inicial observado (incluye un campo visiblemente habilitado pero localmente `readOnly`); capturas locales sintéticas; Playwright, build y lint aprobados. La fidelidad visual integral sigue pendiente.
- **Autorización / restricciones:** el solicitante declaró explícitamente autorizado el entorno y limitó el alcance a estas cinco áreas y acciones de lectura; según `AGENTS.md`, el gate está satisfecho. REA y Playwright inspeccionaron el Brave iniciado por `powershell-brave-startup.ps` en el target autorizado y origen `https://sum.unmsm.edu.pe`. No alterar SUM, editar ni descargar datos personales.
- **Evidencia de entrada:** rutas `docs/frontend/routes.md`; notas históricas en `evidence/sum/{perfil,historial,formulario-datos,ficha-socioeconomica}/`; especificaciones existentes en `docs/reverse-engineering/screens/`; capturas previas `evidence/local/<slug>/candidate.png` se tratan solo como candidatas locales.
- **Clasificación:** complejidad media (cuatro pantallas y shell compartido); incertidumbre alta (detalle y referencia visual incompletos); impacto medio (prototipo local de lectura).
- **Enrutamiento:** coordinador principal más un revisor Sol High para auditoría evidencia→código y un verificador Luna Low para artefactos locales, usando perfiles configurados. Ambos tuvieron tareas de solo lectura y no navegaron el browser ni editaron archivos.
- **Reparaciones automáticas:** 0/1; una reparación máxima solo si las comprobaciones locales revelan una discrepancia respaldada.

| ID | Tarea / dependencias | Archivos exclusivos | Aceptación / verificación | Estado |
| --- | --- | --- | --- | --- |
| MI-01 | Revisar gate, cobertura, evidencia y estado del cliente. | Ninguno | Registrar autorización, target, alcance y conservación de cambios previos. | completada |
| MI-02 | Completar especificaciones con criterios sustentados, supuestos locales y brechas. Depende de MI-01. | `docs/reverse-engineering/screens/{perfil,historial,formulario-datos,ficha-socioeconomica}.md` | Criterios enlazan evidencia sanitizada y límites; etiquetas/tipos no exponen valores. | completada con REA/Playwright 2026-10-08 |
| MI-03 | Implementar diferencias respaldadas en `client/` y verificar en navegador local. Depende de MI-02. | `client/src/screens/{Profile,StudentForms,TableScreens}.tsx`, `client/src/data/routes.ts`, `client/scripts/verify.mjs`, `client/src/components/Shell.tsx`, `client/src/App.css` | Perfil cambia a panel académico; etiquetas personales/académicas, formularios, tabla familiar y submenú comprobados. | completada localmente; comparación visual parcial |
| MI-05 | Investigación autorizada en SUM con REA/Playwright, secuencial por sesión. Depende de MI-01. | `evidence/sum/mi-informacion/` | Observar estructura, estilos, navegación y lectura; no activar acciones de edición/descarga. | completada parcialmente; detalle sanitizado en observations-2026-10-08.md |
| MI-04 | Capturar estado de plan/decisiones y resultados. Depende de MI-01–03. | `docs/reverse-engineering/plans/mi-informacion.md`, `docs/reverse-engineering/workflows/mi-informacion.md`, `evidence/local/<slug>/verification.md` | Registrar gates, comandos y resultados, capturas, estado por criterio y brechas. | completada; aceptación global parcial |

## Brechas que bloquean aceptación completa

1. No se retuvieron capturas de contenido personal de perfil y formularios; por privacidad, comparación visual integral de esas pantallas sigue bloqueada.
2. Perfil: Cambio de Contraseña y descarga SUM no observados/accionados; no completar esos criterios.
3. Historial: contenido de filas, búsqueda, ordenamiento, paginación y estados alternativos no observados; no conservar calificaciones.
4. Formularios: no se observaron opciones, validación, estados condicionales ni comportamiento de Modificar/Descargar.
5. La ficha actual expuso 13 grupos; el conteo histórico de 12 queda superado por la observación actual. La asociación exhaustiva etiqueta-control de algunos grupos socioeconómicos queda parcial.

## Resultado esperado

Playwright local, build y lint aprobados en la revisión final. La implementación local no implica paridad visual ni cubre comportamientos no observados. El módulo completo permanece parcial mientras existan criterios marcados pendientes.
