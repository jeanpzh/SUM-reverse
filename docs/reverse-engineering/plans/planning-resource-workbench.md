# Recursos compactos — entrega 1 del flujo aprobado

Fecha: 2026-11-07. Estado: **implementada e integrada en `0f7c90b`; verificación local registrada**. Revisión local: `RESOURCE-UI-1`. Origen: [plan aprobado](planning-assisted-workflow.md), entregas 0–1 y criterios A3, A4, A10, A12–A14. Se implementa una reorganización de UI y estado local sobre **PA-DEMO-1 sin cambios de wire**. No corresponde a SUM oficial.

## Alcance

Solo Recursos dentro de Preparación, en `/local/programacion-academica`, y los wrappers mínimos necesarios para consultar recursos congelados. Reutilizar `AcademicResourceEditor`, sus editores de disponibilidad/habilitación/preferencias/carga/ambientes y los adaptadores/validadores existentes. Conservar tabla de cursos, Horario/Semana, revisión, aprobación, selector de módulos y pantallas/componentes/tokens SUM del alumno. Aplicar `docs/design-direction.md`, lenguaje A; no rediseñar el resto del dashboard.

No incluye aún Resumen como entrada, metadata de revisión, copia entre periodos, cambio de política de invalidación, regeneración parcial ni extensión del estimador. Son siguientes entregas del plan aprobado. No añadir dependencias, DTOs o contratos paralelos.

## Contrato e interacción fijados

1. Recursos abre una vista de **Docentes** o **Ambientes**, con tabla buscable y cero fichas abiertas. Solo una ficha de recurso, entre ambos tipos, puede estar abierta. Alternar las vistas cierra la ficha y conserva los filtros y el conjunto incluido; no produce mutaciones.
2. Las tablas separan las referencias del catálogo de los recursos incluidos en la configuración del borrador; recursos locales añadidos también permanecen accesibles. Mostrar contadores inequívocos de referencias, incluidos y visibles. Filtrar por nombre/código; ambientes admiten aula/laboratorio. Referencia no significa confirmado para el periodo.
3. Cada fila identifica el recurso, su inclusión y sus datos disponibles. Docentes: cursos habilitados, disponibilidad resumida y carga máxima cuando existen; ambientes: tipo, capacidad y disponibilidad. Una referencia sin esos campos muestra que falta configuración; no se presentan valores inventados como datos de referencia. La carga asignada es opcional y solo si una propuesta vigente permite calcularla.
4. **Abrir ficha** no incorpora, retira, habilita ni invalida nada. Para un recurso incorporado, abre el editor actual; para una referencia no incorporada, muestra sus datos y una acción explícita de incorporación. Los detalles se cierran sin alterar valores ni inclusión.
5. La selección para acciones múltiples es diferente de la inclusión comprometida. **Incorporar seleccionados** / **Retirar seleccionados** abren una vista previa que lista IDs, nombres, acción, alcance, exclusiones y conteos. Recursos ya incluidos/ausentes son casos sin efecto indicados; límites 128/128 y duplicados se validan antes de confirmar. Cancelar no cambia el borrador.
6. Incorporación de referencias reutiliza las reglas actuales de construcción de recursos. La vista previa muestra claramente los valores iniciales sintéticos de disponibilidad/carga que se agregarían, si los hay; no los atribuye al catálogo ni los confirma institucionalmente. No habilitar todos los cursos a todos los docentes. Conservar correspondencias de referencia que ya mantiene el editor; evitar duplicados al incorporar repetidamente o después de editar un identificador.
7. Confirmar aplica una sola transición local de `AcademicPlanningResources` mediante el `onChange` existente y su invalidación actual. El cambio requiere guardar explícitamente como hoy. La vista previa se invalida si cambian selección/datos/opciones de su alcance. No crear endpoints ni persistencia adicional.
8. Se conserva agregar recurso local y todos los campos existentes, pero bajo demanda. Editar IDs mantiene la validación de duplicados. Retirar un recurso activo cierra su ficha de manera coherente.
9. En borradores aprobados/publicados, tablas, filtros, abrir/cerrar ficha y consulta siguen disponibles; incorporación, retiro y edición quedan bloqueados con su razón. El `fieldset` padre no puede deshabilitar la navegación de consulta. Ajustar solo los wrappers necesarios en `AcademicScheduling.tsx`; mantener los campos de Cursos y generación bloqueados y los controles/handlers mutables protegidos.
10. Tabla en región de scroll propia con foco visible; formularios con labels; estados no dependen solo del color; diálogo con foco inicial, Tab contenido, Escape y retorno al disparador. Diseño A, tokens existentes y texto esencial >=12px. Preservar scroll y filtros al consultar una ficha.

## Propiedad exclusiva del worker

- `client/src/screens/AcademicResourceEditor.tsx`
- `client/src/screens/AcademicResourceEditor.css` si se necesita CSS específico nuevo
- `client/src/screens/AcademicScheduling.tsx`: solo prop de bloqueo y wrappers del editor de recursos
- `client/src/data/academicResources.ts` y `.test.ts` si hacen falta helpers puros de unión/selección/vista previa; reutilizar tipos y búsqueda existentes
- `client/scripts/verify-academic-resources.mjs` nuevo
- `client/scripts/verify-academic-*.mjs`: adaptar únicamente selectores afectados por Recursos y configurar puertos propios seguros donde sea necesario

No modificar backend, shared, configuración raíz, documentación/evidencia, otros componentes/tokens o dependencias. Si un componente/helper ya cubre un caso compatible, extenderlo antes de duplicarlo; registrar incompatibilidades antes de reemplazar. No delegar.

## Aceptación obligatoria

| ID | Escenario sintético / check | Resultado esperado |
| --- | --- | --- |
| RUI1 | Entrar; alternar docentes/ambientes y abrir dos fichas | Cero fichas al entrar, máximo una de recurso abierta y sin lista de botones por docente |
| RUI2 | Buscar y filtrar recursos de referencia/incorporados/locales | Coincidencias correctas, contadores inequívocos, inclusión intacta y estados vacíos útiles |
| RUI3 | Abrir/cerrar una referencia y un incorporado | Configuración y propuesta no cambian; no incorporación implícita |
| RUI4 | Selección múltiple, vista previa, cancelar y confirmar | Alcance exacto, cancelación sin efectos y una transición al confirmar; nuevos valores iniciales identificados como sintéticos |
| RUI5 | Incorporación repetida, IDs editados, duplicados, 128/129 y selección sin efectos | Sin duplicados; límites/exclusiones explícitos y datos previos conservados |
| RUI6 | Editar disponibilidad/habilitación/carga/preferencias/límites; aula/laboratorio y capacidad | Mismo payload y validaciones PA-DEMO-1; no perder campos existentes |
| RUI7 | Cliente/API reales: configurar, generar, guardar, recargar y continuar | Misma configuración recuperada y propuesta coherente; todos los incluidos viajan aunque estén filtrados |
| RUI8 | Aprobar por API real, recargar y Consultar | Tablas y fichas consultables, mutaciones bloqueadas y sin POST de ajuste; no cambiar el DOM para simular bloqueo |
| RUI9 | Teclado, diálogo, 720px, render200 y tamaños calculados | Operación verificable, foco correcto, sin desborde de documento, texto >=12px; informar límites de zoom nativo |
| RUI10 | Build/lint/test:data + Semana/Preparación/regresión general afectadas | Exit0 con procesos propios; informe distingue simulación de API real y cada criterio ejecutado |
| RUI11 | Inspección de diff | Conservar interfaces y contratos estudiantiles, diseño A y cambios solo en pantallas autorizadas |

No afirmar aprobación por compilación ni por un resumen que acepte respuestas alternativas. Las pruebas deben verificar acciones reales y efectos (no comentarios, DOM deshabilitado artificialmente ni solo la existencia de una fila para afirmar recuperación).

## Entorno, privacidad y pruebas

Nunca acceder a `datos-reales/` ni snapshots privados, ni indirectamente por API/browser/caches/logs. No producción ni servicios del operador. Solo fixtures independientes sintéticos y procesos propios, entorno permitido explícito, directorio de borradores temporal exclusivo y puertos comprobados libres.

**Demo activa del usuario: backend3210 y frontend5176. No detener, reutilizar, navegar ni probar contra esos procesos.** El acceso remoto por Tailscale de esa demo permanece activo; no modificar su mapeo. Nuevas pruebas: preferir 3411/5411. Los scripts antiguos usan 3210/5176: parametrizar sus puertos con enteros validados y comprobación de disponibilidad antes de ejecutarlos, o informar el bloqueo; nunca adjuntarse a la demo. Semana usa3291/5291 y Preparación3391/5391, sujetos igualmente a comprobar disponibilidad. Scripts de navegador se ejecutan secuencialmente, con contextos propios; no hay propiedad del browser compartido.

Checks requeridos: `pnpm --dir client build`, `pnpm --dir client lint`, `pnpm --dir client test:data`, script nuevo y regresiones afectadas tras adaptación. Revisar `package.json` y scripts antes de ejecutar. No ejecutar exportaciones/migraciones ni instalar herramientas/dependencias.

## Handoff

Rol UI: antigravity / gemini-3.8-flash / thinking_level high, conforme AGENTS §5; principal integra. Leer raíz `AGENTS.md`, `client/AGENTS.md`, `/home/ubuntu/.codex/RTK.md`, `client/.agents/skills/sum-react-implement/SKILL.md`, este brief, plan aprobado y dirección de diseño. Verificar CodeGraph; si falta índice, validar primero exclusiones explícitas de privados/dependencias/symlinks ajenos en `codegraph.json` antes de `codegraph init`, sin leer archivos privados. Ninguna inicialización autoriza modificar contratos/configuración ni ampliar el acceso.

Entregar commit local, archivos, evidencia por RUI1–RUI11, comandos/resultados reales y límites. No merge, push ni PR. Principal verifica la entrega y decide integración y siguiente etapa. Este es el primer ciclo de implementación de RESOURCE-UI-1; como máximo una reparación automática diagnosticada.


Resultado: [informe local](../../../evidence/local/programacion-academica-resources/fullstack-verification.md). El principal canceló el ciclo delegado por demora, conservó el trabajo y cerró directamente la integración y el defecto de layout; sin nuevo worker. Auditoría independiente pendiente.
