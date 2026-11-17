# Consejero normativo · Dirección A

Implementación local del HTML «Consejero Normativo.html» proporcionado por el usuario el 2026-11-17. Su componente «Dirección A · Hilo con decisión fija» es la referencia visual; no es evidencia de SUM. Solo se autoriza reemplazar el consejero de `/local/programacion-academica`, conservando el resto del producto y las pantallas del alumno.

## Reutilización y límites

Se extienden `PlanningAssistAdvisor`, `PlanningNormativeChat`, `AdvisorFindings`, `SuggestionCard` y `AdvisorImpact`, con los componentes Message, Bubble, MessageScroller, InputGroup y Checkbox existentes. No hay dependencias ni contratos paralelos. Se reutilizan el chat persistente del workspace, los adaptadores y los validadores compartidos.

El rail tiene 420 px iniciales y mantiene el redimensionamiento y cierre existentes. En modo expandido la conversación ocupa una columna y el diagnóstico y las opciones otra. Los filtros normativos se conservan bajo demanda junto al compositor; en presencia de una propuesta la conversación del consejero integra la normativa, sin una pestaña visual redundante. Sin propuesta se conserva la navegación normativa anterior. Se mantienen el tema y los tokens existentes, con pesos 400/500, bordes finos, superficies neutras y estado acompañado de texto.

Los datos, títulos y periodos proceden de la sesión y la API, no de las cifras ilustrativas del HTML. El contrato no aporta porcentajes de ocupación por franja, prioridades numéricas, responsable de autorización por opción, ideas de gestión ni procedencia individual de propuestas del modelo. Esos bloques no se inventan. No se afirma que una opción esté autorizada por no requerir ampliación de carga. Carga docente y habilitación de ventanas muestran expresamente la necesidad de autorización externa.

## Corrección aislada del motor

El código previo simulaba automáticamente la selección predeterminada durante la consulta. Se corrigió en `planning-engine/advisor_agent.py`: omitir `selectedRecommendationIds` consulta sin ejecutar CP-SAT ni devolver `verifiedImpact`; una selección explícita conserva la simulación real. No cambia la forma del contrato. La herramienta de simulación no se ofrece al modelo: la selección humana manda y el modelo solo redacta, sin reordenar el catálogo determinista. La petición explícita vacía sigue siendo compatible en la API, pero la UI exige al menos una opción.

Aplicar conserva los controles de versión y selección exacta, modifica el workspace y regenera; no guarda ni publica. Cambiar cualquier selección descarta el impacto incluso si se vuelve a la combinación anterior. Cancelar descarta la respuesta de transporte y conserva el análisis y la selección; no se afirma que detenga un solver ya iniciado en el servidor.

## Aceptación sintética

| Criterio | Escenario y resultado esperado | Comprobación |
| --- | --- | --- |
| Montar no consulta | Abrir el rail: cero peticiones de consejero | `advisor-direction-a-initial-chat-and-simulation` |
| Consultar no simula | Petición sin IDs: sin impacto verificado ni CP-SAT | E2E anterior + `test_initial_consultation_never_runs_solver_even_on_model_tool_request` |
| Diagnóstico visible | Un análisis nuevo comienza arriba del hilo | E2E anterior |
| Conversación conservada | Consulta normativa real, expansión/restauración sin perder respuesta | E2E anterior |
| Simulación exacta | Selección explícita, respuesta real del motor, Aplicar habilitado | E2E anterior |
| Impacto invalidado | Marcar/desmarcar, incluso regresar al conjunto anterior: Aplicar deshabilitado | E2E anterior + `advisor-selection-invalidates-impact` |
| Cancelación y vacío | Checkboxes bloqueados durante simulación; cancelar no aplica; cero selección impide simular | `advisor-direction-a-cancel-simulation` |
| Aplicación y efectos | Segunda generación real, ID diferente y cero borradores guardados | `advisor-applies-only-on-command-and-regenerates` |
| Error y reintento | Fallo de transporte, reintento conserva exactamente los IDs | `advisor-retry-preserves-requested-selection` |
| Sin bloqueos | Una sola conclusión y ninguna acción de simulación/aplicación | `advisor.test.mjs` |
| Orden y degradación | Fallo/no configuración del LLM deja catálogo; modelo no reordena | `test_advisor_agent.py` |
| Accesibilidad y temas | Claro/oscuro, 360/720/1440 px, foco con teclado y sin overflow horizontal | E2E de presentación |

El runner `verify-planning-redesign-stack.mjs` crea su propio React/NestJS/Python y directorio de borradores sintéticos, con LLM deshabilitado, sin adjuntarse a servidores existentes. Los atrasos/fallos se inyectan solo en la frontera de transporte sintética. Las llamadas satisfactorias usan los servicios reales locales.

La cobertura a 720 px comprueba el reflujo equivalente a reducir a la mitad un viewport de 1440 px; no se afirma haber probado el zoom del navegador al 200%. Las pantallas del alumno no se modifican; no se ejecutó comparación visual de ellas. Las pruebas con proveedor LLM son dobles locales, sin llamadas a un proveedor vivo.

## Resultados

- `pnpm --dir client build`: aprobado; mantiene el aviso previo de chunks mayores de 500 kB.
- `pnpm --dir client lint`: aprobado.
- `pnpm --dir client test:data`: 308 pruebas aprobadas.
- `pnpm --dir client exec node --test src/components/ai-elements/advisor.test.mjs`: 8 pruebas aprobadas.
- `uv run --directory planning-engine pytest test_advisor_agent.py -q`: 20 pruebas aprobadas; aviso de deprecación de LangChain.
- Cuatro escenarios integrados se ejecutan por lotes breves: presentación/conversación/simulación, cancelación/selección vacía, aplicación/regeneración y error/reintento. Los intentos de ejecutar todos en un lote excedieron la ventana del proceso; no se cuentan esos lotes interrumpidos como aprobados.
- La revisión visual y sus adaptaciones están en `design-qa.md`, en la raíz del repositorio.
