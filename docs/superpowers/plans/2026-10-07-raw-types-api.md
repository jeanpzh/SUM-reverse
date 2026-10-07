# Raw Types and API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar contratos de `raw-types`, mocks coherentes y las doce consultas documentadas con las pantallas existentes.

**Architecture:** Importar los contratos originales y derivar su representación JSON. Un registro de endpoints y un cliente configurable ofrecen la misma interfaz en modo mock y API. Los loaders de TanStack Router alimentan las pantallas y la identidad compartida mediante adaptadores de presentación.

**Tech Stack:** TypeScript, React 19, TanStack Router existente, Vite existente, Fetch, pruebas nativas de Node y verificación Playwright existente. No añadir dependencias.

**Spec:** [Especificación aprobada](../specs/2026-10-07-raw-types-api-design.md)

## Global Constraints

- Importar los tipos directamente de los módulos de `raw-types/`; no duplicarlos ni modificar los archivos de referencia.
- `VITE_SUM_DATA_MODE=mock|api`; ausencia de configuración equivale a `mock`.
- `VITE_SUM_API_BASE_URL` es obligatorio en modo `api`.
- En modo `mock` se devuelven respuestas asincrónicas sin efectuar `fetch`.
- No convertir errores de API en mocks silenciosamente.
- No generar cientos de filas únicamente para reproducir la altura observada.
- Durante el desarrollo no se consulta SUM real.
- Se conserva el diseño actual, incluido el bento grid de Inicio.
- Mantener las acciones de modificación deshabilitadas; no implementar autenticación ni escritura en SUM.
- Ejecutar build, lint, pruebas de datos y verificación local; reportar limitaciones reales del entorno.

## Review Focus

1. Base URL relativa o absoluta, con o sin barra final: producir exactamente la ruta y acción documentadas. Se cubre en Task 2.
2. HTTP exitoso con HTML de login, envelope erróneo o datos mínimos faltantes: mostrar error sin reemplazarlo por un mock. Se cubre en Tasks 2 y 5.
3. Cancelación durante fetch y modificación accidental de un mock: cancelar sin reutilizar señal abortada y aislar respuestas entre consultas. Se cubre en Tasks 1 y 2.
4. Listas vacías, deudas desconocidas y elementos no vacíos de tutorías/evaluaciones sin contrato: no inventar datos ni declarar ausencia de deuda. Se cubre en Tasks 4 y 5.
5. Navegación directa, atrás/adelante y descarga después de una carga: identidad, tablas y CSV deben compartir los datos cargados. Se cubre en Tasks 3 y 5.

## Estructura de archivos

- `client/src/data/contracts.ts`: imports de los doce dominios disponibles, `JsonValue<T>`, `ApiResponseMap`, `EndpointKey` y alias de alumno.
- `client/src/data/endpoints.ts`: registro central de ruta, acción y método por consulta.
- `client/src/data/mocks/student.ts`, `courses.ts`, `responses.ts`: alumno común, cursos/programación y envelopes de los endpoints.
- `client/src/data/config.ts`: interpretar y validar configuración sin depender de Vite.
- `client/src/data/transport.ts`: URL y errores HTTP/JSON/envelope, comprobaciones mínimas por dominio.
- `client/src/data/api.ts`: fábrica de cliente con fetch inyectable y selección de modo.
- `client/src/data/client.ts`: instancia de aplicación que lee `import.meta.env`.
- `client/src/data/adapters.ts`: alumno compartido, perfil y transformaciones de filas sin React.
- `client/src/data/useStudent.ts`: acceso tipado a datos de la ruta raíz sin importar su definición de ruta en componentes.
- `client/src/components/RouteStatus.tsx`: estados compartidos de carga/error y reintento mediante invalidación del router.
- `client/src/screens/TableScreens.tsx`, `Profile.tsx`, `EnrollmentInfo.tsx`, `StudentForms.tsx`: datos recibidos por props o loader raíz en vez de fixtures académicos locales.
- Modificar rutas de perfil, matrícula/información, programación, prematrícula, matrícula, horarios, evaluaciones, deudas, asistencias, tutoría y plan; raíz obtiene el formulario.
- Modificar Shell, Common e Inicio para consumir alumno derivado; `routes.ts` conserva navegación.
- `client/src/data/contracts.test.ts`, `api.test.ts`, `adapters.test.ts`: pruebas nativas de Node.
- Modificar `client/package.json`, `client/scripts/verify.mjs`, `client/README.md`; crear `client/.env.example`.

### Task 1: Contratos de transporte y mocks coherentes

**Interfaces:**
- Produce `JsonValue<T>`: transformación recursiva de `Date` a `string`, preservando arrays, null y uniones.
- Produce `ApiResponseMap` con claves `perfil`, `formulario`, `matriculaInfo`, `programacion`, `prematricula`, `matricula`, `horarios`, `evaluaciones`, `deudas`, `asistencias`, `tutoria`, `plan`. `deudas` es `unknown`; las restantes importan contratos originales.
- Produce `EndpointKey = keyof ApiResponseMap` y `StudentRecord = ApiResponseMap['formulario']['data']['alumno']`.
- Produce `mockResponses` que satisface `ApiResponseMap`; fechas JSON como strings y respuestas ficticias consistentes.

- [ ] Escribir `contracts.test.ts` con invariantes: fecha ISO es string; tres cursos matriculados aparecen en programación, prematrícula, horarios y asistencia; presentes+tardanzas+faltas=numClases; porcentajes calculados; cupos no excedidos; evaluaciones/tutorías vacías; deuda desconocida no incluye campos inventados.
- [ ] Añadir script `test:data` con `node --experimental-strip-types --test src/data/*.test.ts`; usar imports `.ts` en módulos de datos necesarios para Node, sin introducir herramientas nuevas. Tests no importan la instancia que lee `import.meta.env`.
- [ ] Ejecutar las pruebas y confirmar fallo por módulos ausentes.
- [ ] Implementar los tres módulos de fixtures y contratos con todos los campos requeridos, alumno/cursos compartidos y `satisfies`, sin assertions para llenar fixtures.
- [ ] Ejecutar `pnpm --dir client test:data` y build. Revisar también los contratos con nombre duplicado y el literal `codPlan: '2018  '`.

### Task 2: Configuración, registro de endpoints y cliente API

**Interfaces:**
- Consume `ApiResponseMap`, `EndpointKey`, `mockResponses`.
- Produce `DataConfig = { mode: 'mock' | 'api'; baseUrl?: string }` y `readDataConfig(values: { mode?: string; baseUrl?: string }): DataConfig`.
- Produce `endpoints`, registro con los doce valores exactos de la tabla de la especificación. Método POST en todos, supuesto documentado para los ocho no especificados.
- Produce `buildEndpointUrl(baseUrl: string, key: EndpointKey): string`; admite URL HTTP(S) o prefijo relativo, incorpora `/alumnoWebSum/v2`, conserva query de base si existe y añade `accion` sin concatenaciones ambiguas.
- Produce `parseResponse<K extends EndpointKey>(key: K, value: unknown): ApiResponseMap[K]` con comprobaciones mínimas de envelope, null/errores y campos que leen los adaptadores. Deudas permanece desconocido; no validar forma de elementos desconocidos.
- Produce `createSumApi(config: DataConfig, fetchImpl?: typeof fetch)` con método `get<K extends EndpointKey>(key: K, options?: { signal?: AbortSignal }): Promise<ApiResponseMap[K]>`.
- Produce `sumApi` en `client.ts`, única instancia que lee variables de Vite.

- [ ] Escribir `api.test.ts`: recorrer las doce claves y verificar método/ruta/query, aceptar bases absoluta y relativa con/sin barra, validar configuración y ausencia de URL base en API.
- [ ] Añadir pruebas: mock no invoca fetch incluso con URL base; dos respuestas mock pueden modificarse sin contaminar la siguiente; señal abortada antes y durante llamada; error HTTP; HTML de login; JSON inválido; `codError` no nulo; `data` faltante; estructura mínima incorrecta; no fallback de errores a mocks.
- [ ] Confirmar fallo de las pruebas por implementación ausente.
- [ ] Implementar registro, configuración y transporte. Fetch envía `Accept: application/json`, `credentials: 'include'`, método registrado y señal, sin inventar body. Clonar mocks por consulta con `structuredClone` y comprobar la señal.
- [ ] Implementar comprobaciones de respuesta y errores claros; mantener la frontera de tipado de JSON aislada, sin prometer validación exhaustiva. Crear instancia Vite separada.
- [ ] Ejecutar pruebas, build y lint. Documentar el supuesto POST y la representación de fechas en comentarios junto a los registros correspondientes.

### Task 3: Identidad compartida y carga por rutas

**Interfaces:**
- Consume `sumApi.get('formulario')` y `StudentRecord`.
- Produce `toStudentSummary(alumno: StudentRecord)` con `name`, `code`, `period`, `faculty`, `program`, `specialty`, `plan` derivados exclusivamente del alumno.
- Produce `useStudent()` que devuelve ese modelo desde `getRouteApi('__root__').useLoaderData()`; evita ciclos importando la definición de ruta raíz en componentes.
- Ruta raíz `loader` devuelve la respuesta de formulario; formulario usa esta misma respuesta, sin repetir consulta.
- La ruta de formulario personal carga además `sumApi.get('perfil')` y pasa esa respuesta a `StudentForms`; la ficha socioeconómica usa únicamente la identidad raíz y sus fixtures representativos.
- Cada ruta documentada carga su consulta correspondiente y pasa `Route.useLoaderData()` a su pantalla. Señales de `abortController` se propagan al API.

- [ ] Antes de modificar loaders, consultar Context7 para TanStack Router sobre datos raíz, loaders, cancelación y error/pending; leer skills locales de data-loading y react-router aplicables.
- [ ] Escribir prueba de `toStudentSummary`: nombres/identidad/periodo cambian al cambiar alumno y no dependen de constantes de navegación.
- [ ] Confirmar fallo; implementar adaptador, loader raíz, hook y componentes de estado. Reintento debe invalidar el router y volver a consultar.
- [ ] Reemplazar imports estáticos de `student` en Shell, Common, Inicio, Perfil, historial y formularios. Eliminar `student` de `routes.ts` cuando ya no tenga consumidores.
- [ ] Agregar loaders a las once rutas restantes documentadas, manteniendo el formulario en la raíz. Perfil y EnrollmentInfo reciben sus respuestas tipadas.
- [ ] Ejecutar pruebas, build y lint; los estados de error de la raíz deben funcionar aunque no exista alumno cargado.

### Task 4: Adaptadores y pantallas alimentadas por respuestas

**Interfaces:**
- Consume respuestas de `ApiResponseMap` y alumno compartido.
- Produce funciones de filas `toPlanRows`, `toPrematriculaRows`, `toMatriculaRows`, `toAttendanceRows`, `toProgrammingRows` con parámetro `ApiResponseMap[clave]['data']` y retorno `(string | number)[][]` en el orden de encabezados existentes.
- Produce `toProfileRows(profile: ApiResponseMap['perfil']['data'], alumno: StudentRecord): string[][]` para pantalla y CSV.
- `TableScreen` recibe una unión discriminada por `id` con su respuesta correspondiente; historial conserva un caso sin respuesta API. Acciones visuales se agregan después del adaptador, sin mezclarlas en CSV.

- [ ] Escribir `adapters.test.ts`: campos/códigos/créditos/docentes de cada dominio llegan a las columnas esperadas; listas vacías devuelven cero filas; nombre de alumno y datos personales se reflejan en perfil/CSV; no tratar `null` como texto visible; cantidades derivadas de datos.
- [ ] Confirmar fallo; implementar adaptadores y eliminar generadores de filas académicas locales de TableScreens. Historial conserva su fixture separado e identificado como no documentado.
- [ ] Renderizar horarios con `dia`/`numDia`, inicio y fin de cada registro; validar rango de día/hora antes de presentar eventos. Calendar conserva estructura semanal y evita posiciones fuera de rango.
- [ ] Integrar información de matrícula con cronograma, habilitación y perfil cargados, conservando explicaciones existentes.
- [ ] En formulario, usar alumno y flags de completitud conocidos y la prop de perfil cargada por su ruta para documento, fecha, contacto y dirección. No mapear arbitrariamente claves del objeto `formulario`. Ficha socioeconómica conserva fixtures representativos, con identidad cargada y sin prop de perfil.
- [ ] Tutorías y evaluaciones: listas vacías muestran estado vacío; listas no vacías desconocidas muestran que el contrato no permite interpretar los registros. Deudas muestra datos no disponibles sin afirmar que no existen deudas.
- [ ] CSV se genera de las mismas filas de la pantalla. Renombrar `downloadFixture` a `downloadCsv` y ajustar consumidores; conservar sufijo `-demo` en mock y omitirlo en API.
- [ ] Ejecutar pruebas, build y lint. No habilitar controles de modificación ni destinos no observados.

### Task 5: Verificación de integración y documentación

**Interfaces:**
- Consume el cliente integrado, los scripts existentes y las pruebas de datos.
- Produce instrucciones reproducibles de modo mock/API y evidencia local de verificación cuando el entorno permita ejecutar navegador.

- [ ] Actualizar `verify.mjs`: espera explícita a contenidos después de loaders; bento de Inicio se verifica por ocho tiles, columnas adaptables y ausencia de overflow, reemplazando x/y/width antiguos.
- [ ] Añadir aserciones de nombres/cursos compartidos entre rutas, filas y contenido real del CSV, historial de navegación y listas desconocidas/vacías. Mantener bloqueo de HTTP externo.
- [ ] Simular respuesta HTTP fallida en modo API usando un servidor/interceptor local y comprobar mensaje/reintento; simular HTML de login y confirmar que no aparecen mocks silenciosamente. Nunca usar host SUM.
- [ ] Crear `.env.example` con modo mock y base API vacía comentada. Actualizar README: doce endpoints, contratos importados, métodos asumidos, fechas JSON, mocks por defecto, configuración, proxy/CORS y limitaciones de deudas/evaluaciones/tutorías.
- [ ] Ejecutar `pnpm --dir client test:data`, `pnpm --dir client build`, `pnpm --dir client lint` y `pnpm --dir client verify`; ante bloqueo del sandbox solicitar autorización específica para la verificación local. Inspeccionar capturas locales relevantes sin compararlas contra geometría que el rediseño aprobado ya reemplazó.
- [ ] Revisar diff final: archivos de referencia intactos, ningún dato real, ninguna URL externa predeterminada, ninguna petición modificadora y ningún cambio de diseño ajeno al alcance.
- [ ] Informar resultados de validación y limitaciones de conexión real; commits solo si permisos del workspace lo permiten y sin incluir cambios ajenos.

## Auto-revisión del plan

- Todos los requisitos de la especificación se asignan a las cinco tareas anteriores.
- Las doce claves del API y rutas se mantienen en un registro común; los consumidores usan la misma interfaz genérica.
- Las fechas JSON, deuda sin contrato, unknown arrays, identidad raíz, formularios opacos, CSV y ausencia de red en mock tienen tratamiento explícito.
- Los cinco focos de revisión tienen comprobaciones asignadas; build/lint y navegador cubren integración además de pruebas de datos.
- No se requieren dependencias nuevas ni acciones sobre SUM real.
