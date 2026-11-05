# E1: editor compacto y análisis de demanda

2026-11-02. Principal: planificación y análisis. Fuente funcional: petición explícita
del usuario, local-only. Complejidad media, incertidumbre baja en UI y media en
estimación; impacto bajo en UI y sin implementación de demanda. Preservar fidelidad
visual/interacción SUM y todas las pantallas estudiantiles. Solo cambia la pantalla
administrativa local. Reutilizar DataTable, editor, estado, API y validaciones.

## Contrato y aceptación

PA-DEMO-1 y POST ajustes permanecen idénticos. No modificar backend, generador,
recursos, matrícula, Docker, dependencias ni catálogos. Secciones propuestas muestra
solo número en columna Sección. Agregar columna Acciones con Editar horario; marca
manual discreta fuera del número conserva información anterior, sin texto Automática
en esa tabla. Antes de seleccionar no hay formulario. Al elegir se muestra un único
panel debajo de la tabla de secciones, sin tarjetas duplicadas por sección. Cancelar
cierra. Secciones sin asignaciones no permiten editar sesiones inexistentes.

Reutilizar controles de responsable, día, inicio y ambientes por componente, vista
previa, error específico, recursos originales, versión e invalidación de respuestas
obsoletas. Conservar bloque/duración y no tocar otras secciones. En split con varios
bloques, selector compacto en el mismo panel; no perder la edición de ninguno.
Solo un formulario activo, incluso al cambiar de sección o bloque. Actualizar script
integrado existente, sin crear un segundo flujo duplicado.

## Tareas

1. Worker React Luna High: exclusivamente client/src/screens/AcademicScheduling.tsx,
AcademicScheduling.css y client/scripts/verify-academic-manual.mjs. Leer root/client
AGENTS y sum-react-implement. Sin delegar. Actualizar pruebas de selección, cancelar,
rechazos, número limpio, una instancia del editor, split si hay escenario viable;
build/lint/test:data. No navegar navegador compartido. Comprobar CodeGraph solo si
exclusiones privadas, dependencias/symlinks acreditadas; no inicializar inseguramente.
2. Principal: inspección read-only de datos/tipos/reglas sintéticos autorizados y
documentar inventario, límites de población/identidad/periodo, fórmula candidata y
decisiones pendientes. No implementar demanda ni modificar reglas o snapshots.
3. Principal: revisión y navegador secuencial en Docker sintético propio5280, sin
inspeccionar servicio operador5180. Regresión API/matrícula focalizada, fuente de
demanda manual intacta, cambio válido y rechazado, tabla/calendario, split. Registrar
resultados reales y capturas; no commits/push.

## Resultado

UI implementada y verificada. Principal conservó planificación/análisis; worker
compact_section_editor gpt-6-luna/high modificó solo los tres archivos asignados.
No cambios al contrato/backend/generador.304 pruebas backend/regresión,196 datos
cliente y6 shared, build/tipos/lint y navegador Docker aprobados. Split probado con
dos días y un único editor. Evidencia:
`evidence/local/programacion-academica-manual/compact-verification.md`.
Análisis, sin implementar demanda:
`docs/reverse-engineering/plans/programacion-academica-demand-findings.md`.
