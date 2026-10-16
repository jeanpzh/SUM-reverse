# Registro de una ejecución o simulación

Leer al registrar las decisiones del orquestador. Usar `docs/reverse-engineering/workflows/<slug>.md` y conservar las ejecuciones anteriores como historial; si la sesión prescribe otro destino, respetarlo. No incluir datos de cuenta ni enlaces a artefactos sin sanitizar.

Registrar de forma compacta:

1. Funcionalidad, ruta, estado/alcance, modo, fecha, restricciones y objetivo de aceptación.
2. Artefactos reutilizados con rutas, procedencia, estado y límites. Para resultados reutilizados, identificar las entradas/revisión/huellas que acreditan su vigencia. Si no están disponibles, etiquetarlos como históricos y programar comprobación local.
3. Decisiones de etapa: `ejecutar`, `omitir`, `proponer` o `bloquear`, razón, gate de entrada y salida esperada/observada. Las etapas previstas nunca se registran como ejecutadas.
4. Criterios cumplidos/fallidos/bloqueados y discrepancias cuando haya verificación real. Separar aceptación frontend/visual, comportamiento de referencia, contrato backend propio e integración React/NestJS; registrar modo mock o API propia, escenarios, solicitudes y efectos comprobados; registrar enmascarado y estados sin referencia.
5. Incertidumbres, bloqueo, mínima evidencia/acción segura requerida y siguiente etapa admisible. Una restricción de seguridad no se resuelve reintentando otra herramienta.
6. Estado final: `aceptado` (todos los criterios obligatorios del alcance cumplen), `rechazado` (hay fallas comprobadas), `bloqueado` (falta requisito/evidencia/permiso/infraestructura), `listo-para-implementar` o `listo-para-verificar` si la etapa final pedida termina antes, o `simulado` con disposición prevista separada.

La simulación escribe exclusivamente el registro autorizado. Puede leer código y resultados anteriores para decidir etapas, pero no modificar `client/` ni `backend/`, completar la especificación, ejecutar tests/build/lint, crear candidatos visuales, llamar REA o inspeccionar SUM.

Para enrutamiento dinámico añadir complejidad/incertidumbre/impacto y sus razones,
plan reutilizado o brecha que justifica uno nuevo, rol/modelo/esfuerzo seleccionados
y efectivos (si hubo despacho), archivos exclusivos, contador de reparaciones (0/1),
razón de escalamiento y referencia al plan persistente cuando sea necesario.
Conservar resultados de checks antes de una revisión crítica. Una selección prevista
en simulación no equivale a un agente lanzado ni a una inferencia realizada.
