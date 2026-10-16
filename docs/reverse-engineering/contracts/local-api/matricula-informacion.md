# API propia: Información de Matrícula

- **Revisión:** `MI-CONTRACT-1`, 2026-10-08; estado `lista` para implementación local.
- **Alcance:** consulta readonly de un artículo informativo. Todas las rutas, DTOs, errores, fixtures y reglas de este documento son decisiones `local-only` del proyecto.
- **Fuentes reutilizadas:** [especificación](../../screens/matricula-informacion.md), notas en `evidence/sum/matricula-informacion/`, pantalla actual `client/src/screens/EnrollmentInfo.tsx`, endpoint candidato en `client/src/data/endpoints.ts` y validación compartida `backend/src/common/readonly-query.ts`.
- **Distinción:** `raw-types/matricula-info.ts` describe un contrato candidato con flags académicos; no demuestra que ese JSON genere el artículo observado. El backend propio entrega contenido explícito y no interpreta esos flags como reglas de matrícula.

## Operación MI-READ

| Campo | Valor obligatorio |
| --- | --- |
| Actor/contexto | Contexto sintético único de la aplicación, `DEMO-001`; sin selección de alumno ni autenticación nueva. |
| Método y ruta backend | `POST /alumnoWebSum/v2/matricula/informacion` |
| Query | Solo `accion=obtenerInformacion`, una cadena exacta. |
| DTO de consulta | `ConsultaMatriculaInformacionDto = { accion: 'obtenerInformacion' }` |
| Body | Ausente o objeto JSON vacío `{}`. Sin campos, identidad, periodo o fixture enviados por el cliente. |
| Respuesta correcta | HTTP `200`, `Content-Type` JSON; envelope de exactamente `message`, `codError`, `data`. |
| Ruta desde React local | `/api/alumnoWebSum/v2/matricula/informacion?accion=obtenerInformacion`; proxy existente retira `/api`. |
| Transporte local | `Accept: application/json`, `credentials: 'omit'`, sin body; preservar `AbortSignal`. |
| Efectos | Ninguno. Lectura repetible sin modificaciones, red externa ni escritura persistente. |

La composición del endpoint reutiliza la convención de la réplica y el candidato documental; no acredita una captura de red SUM ni una implementación privada.

## Respuesta propia y validación runtime

```ts
type SeccionMatriculaId = 'cronograma' | 'acceso-facultad' | 'prematricula' | 'deudas' | 'interfaz'
type SeccionMatricula = {
  id: SeccionMatriculaId
  titulo: string
  descripcion: string
}
type ArticuloMatricula = {
  introduccion: string
  secciones: SeccionMatricula[]
}
type MatriculaInformacionLocalData = {
  codSemestre: string
  articulo: ArticuloMatricula | null
}
type MatriculaInformacionEnvelope = {
  message: null
  codError: null
  data: MatriculaInformacionLocalData
}
```

- El backend declara tipos propios; no importa tipos o código runtime del cliente. DTO HTTP validado por pipe que reutiliza `validateReadonlyQuery` y `ConsultaReadOnlyRequest` existentes.
- En local, React valida el envelope exacto y sus dos valores nulos, el objeto `data` con exactamente dos claves y `codSemestre` cadena con formato `/^\d{4}-[12]$/`.
- `articulo` es **obligatorio**: `null` es vacío válido; ausencia, `undefined`, `{}` o cadena son respuesta malformada.
- Un artículo es objeto de exactamente `introduccion`, `secciones`; introducción cadena no vacía después de `trim`. `secciones` tiene exactamente cinco objetos, con exactamente `id`, `titulo`, `descripcion`. IDs y orden exactos: `cronograma`, `acceso-facultad`, `prematricula`, `deudas`, `interfaz`. Título y descripción son cadenas no vacías después de `trim`.
- Validar estructura, sin coerción, corrección de orden ni sustitución por constantes. Los textos válidos recibidos pueden variar; se muestran como texto React, sin interpretar HTML ni usar `dangerouslySetInnerHTML`.
- Campos adicionales, IDs duplicados/desordenados, listas incompletas, números como texto o `data:null` rechazan la respuesta local. Mensaje de validación: `La respuesta local de información de matrícula no cumple el contrato.`
- El título exterior `Información de Matrícula` pertenece a la pantalla; no se envía en el DTO. `codSemestre` asegura coherencia de contexto, sin añadir un bloque de datos del alumno ni un encabezado no observado.

## Fixtures y persistencia

`MATRICULA_INFORMACION_FIXTURE` acepta únicamente ausencia, `populated` o `empty`. Ausencia equivale a `populated`. Cualquier otro valor, incluida cadena vacía, `EMPTY` o espacios, impide arranque con mensaje `MATRICULA_INFORMACION_FIXTURE inválido: <valor>. Use populated o empty.`; no normalizar ni recuperar silenciosamente.

Repositorio singleton con inyección por constructor de `ReportesRepository`, provisto mediante import de `ReportesModule`. Obtiene `readFormulario().alumno.periodo` para `codSemestre`; no registra otro proveedor de ReportesRepository. Periodo actual de seed: `2026-2`, también en `REPORTES_FIXTURE=empty`.

Semilla propia `populated`, parametrizada por el periodo:

```json
{
  "message": null,
  "codError": null,
  "data": {
    "codSemestre": "2026-2",
    "articulo": {
      "introduccion": "Módulo de Matrícula Vía Internet",
      "secciones": [
        {"id":"cronograma","titulo":"Control de Cronograma de Matrícula","descripcion":"Información sobre el cronograma académico relacionado con la matrícula del periodo 2026-2."},
        {"id":"acceso-facultad","titulo":"Control de Acceso de Facultad","descripcion":"Información sobre el control de acceso de la facultad."},
        {"id":"prematricula","titulo":"Control de Pre-Matrícula","descripcion":"Información sobre el proceso de pre-matrícula."},
        {"id":"deudas","titulo":"Control de Deudas Registradas","descripcion":"Información sobre las deudas registradas."},
        {"id":"interfaz","titulo":"Interfaz de Matrícula","descripcion":"Información sobre la interfaz del módulo de matrícula."}
      ]
    }
  }
}
```

Las descripciones reutilizan paráfrasis locales existentes; la mención del periodo en cronograma es una decisión local que prueba contenido propio. No son transcripción literal SUM ni requisitos para acceder al módulo.

En `empty`: HTTP 200, mismo periodo, `data.articulo=null`. No conservar secciones como contenido de respaldo. La UI muestra exactamente `No hay información de matrícula disponible.` y no monta `ol`.

Seed al arrancar; consultas devuelven `structuredClone` para impedir mutación compartida. No base de datos, reset HTTP, reloj, escrituras ni persistencia entre procesos. Recarga y reinicio con igual modo/periodo producen respuesta semánticamente idéntica. Consultas paralelas no cambian estado. No requisitos de atomicidad de inscripción/cupos porque esta operación no inscribe.

## Errores de entrada y recuperación

Se conserva prioridad de `validateReadonlyQuery`: acción → campos query → body. Sin modificar esa utilidad compartida.

| Entrada | HTTP / envelope exacto |
| --- | --- |
| Acción ausente, distinta, vacía o repetida como array | `400`; `{message:'Acción de consulta inválida.',codError:'INVALID_ACTION',data:null}` |
| Acción válida y query extra, p. ej. `codAlumno`, `periodo`, `fixture` | `400`; `{message:'Parámetro de consulta no admitido.',codError:'INVALID_QUERY',data:null}` |
| Acción/query válidas y body objeto no vacío, array, null, primitivo o texto no parseado con bytes | `400`; `{message:'La consulta no admite cuerpo de datos.',codError:'INVALID_BODY',data:null}` cuando llega al pipe. |
| JSON sintácticamente inválido / primitivo rechazado antes del pipe | HTTP `400` del parser Nest/Express existente; su envelope estándar no se transforma ni se exige igual al de los errores del pipe. |
| Método no registrado como GET/PUT/DELETE | `404` del router existente; sin mutación. |

Fallo HTTP, red, JSON, content-type o contrato permanece error visible, nunca vacío ni mock. Se reutiliza `RouteError` (`role=alert`, `Intentar de nuevo` → `router.invalidate()`), que inicia nueva lectura. `RoutePending` expone `role=status` y `Cargando información…`. No mensaje nuevo de éxito ni acción de matrícula.

## Compatibilidad del cliente

Se conserva endpoint/key `matriculaInfo`. En `client/src/data/contracts.ts`, esa entrada será unión de `JsonValue<EnrollmentInformation>` heredado y `LocalReportEnvelope<MatriculaInformacionLocalData>`. Los tipos propios pueden residir en `data/matriculaInformacion.ts` e importarse como tipos; conservar `raw-types/` sin cambios.

Interfaz concreta para que Luna no elija variantes: definir los cuatro tipos de contenido anteriores y `legacyEnrollmentArticle: ArticuloMatricula` en `client/src/data/matriculaInformacion.ts`, sin importar runtime desde contracts (evitar ciclo). El respaldo conserva la descripción original de cronograma, `Información sobre el cronograma académico relacionado con la matrícula.`, y los otros cuatro párrafos sin cambios. En el mismo archivo, exportar `validateMatriculaInformacion(value: unknown): asserts value is MatriculaInformacionLocalData`; arroja el error de contrato cuando falla. En contracts importar únicamente el tipo propio y declarar `MatriculaInfoLegacyEnvelope = JsonValue<EnrollmentInformation>`, `MatriculaInfoLocalEnvelope = LocalReportEnvelope<MatriculaInformacionLocalData>` y la unión como entrada del mapa.

En `client/src/data/adapters.ts`, añadir exactamente esta frontera tipada (no obtener el modo desde el componente):

```ts
export function toEnrollmentArticle(
  data: ApiResponseMap['matriculaInfo']['data'],
): ArticuloMatricula | null {
  if ('articulo' in data) return data.articulo
  return structuredClone(legacyEnrollmentArticle)
}
```

El DTO local tiene `articulo` requerido y el DTO heredado no tiene esa propiedad; TypeScript estrecha la unión sin casts. `parseResponse` conserva el branch heredado cuando `local=false` y llama al nuevo validator cuando `local=true`. No añadir propiedad opcional a raw-types ni deducir forma propia por `indMatHabilitada`.

- `local`: añadir solo `matriculaInfo` a `localHttpKeys`, validar con contrato propio; contenido procede obligatoriamente de `data.articulo`. El validator local nunca acepta el DTO heredado ni hace fallback.
- `mock`: mantener `mockResponses.matriculaInfo` exactamente compatible y sin fetch. El adaptador identifica la forma heredada y devuelve el artículo histórico local con las cinco descripciones previas (cronograma sin periodo). Extraer esas constantes de la pantalla a la capa de datos.
- `api` heredado: mantener validación previa de flags/perfil y `credentials:include`; únicamente una respuesta heredada válida puede usar la misma paráfrasis de respaldo. No interpretar esos flags ni agregar gates. Este modo se verifica con fetch sintético, nunca contra SUM.
- El adaptador distingue el DTO por propiedad `articulo` después de la validación del transporte. Para DTO local, devolver el artículo o null íntegro; para DTO heredado, devolver el respaldo histórico. No escoger un respaldo ante errores o `articulo:null`.
- Loader de ruta llama `sumApi.get('matriculaInfo', {signal:abortController.signal})` y pasa `response={Route.useLoaderData()}` a `EnrollmentInfo`. Declarar `pendingComponent: RoutePending` y `errorComponent: RouteError` explícitamente en esa ruta, importados del componente existente; conservar temporizadores predeterminados y no editar router/root. La pantalla recibe `response: ApiResponseMap['matriculaInfo']`, llama al adaptador de data y renderiza introducción y secciones; no conserva otra constante de cinco secciones.

## Aceptación y estado

Los escenarios obligatorios `MI-HTTP`, `MI-INVALID`, `MI-READONLY`, `MI-EMPTY`, `MI-UI`, `MI-LOADING`, `MI-RECOVERY`, `MI-MALFORMED`, `MI-MODES`, `MI-REGRESSION` y `MI-ENV` se definen en el [plan de ejecución](../../plans/matricula-informacion.md). HTTP real más UI real son necesarios para integración; un fetch simulado solo demuestra frontera/compatibilidad. Sin descarga CSV en este alcance. Fidelidad de texto exacto, flags académicos, reglas de habilitación y cambios estacionales SUM siguen `unverified`.
