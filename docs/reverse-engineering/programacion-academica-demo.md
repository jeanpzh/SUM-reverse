# Abrir el prototipo local de programación académica

Este prototipo PA-DEMO-1 utiliza datos construidos independientemente, no datos
reales de FISI. No usa credenciales SUM ni publica oferta de matrícula.
Abrir el repositorio en VS Code y trabajar desde su raíz, rama schedule-pt1.

## Terminal 1: API dedicada

```powershell
pnpm --dir backend build
$env:SUM_ACADEMIC_SCHEDULING='1'
$env:SIMULATOR_DEPLOYMENT='local'
$env:PORT='3210'
node backend/dist/programacion-academica/local-main.js
```

La API se enlaza exclusivamente a 127.0.0.1. Este arranque solo carga el módulo
nuevo, no los repositorios del dashboard. Si detecta una variable *_SNAPSHOT_DIR
no vacía, se niega a arrancar: usar una terminal sin fuentes snapshot configuradas.
No cambiar ni abrir esos archivos. Si el puerto está ocupado, detener este intento
y elegir otro puerto para ambos procesos, sin inspeccionar el servicio existente.

## Terminal 2: React

```powershell
$env:VITE_SUM_DATA_MODE='local'
$env:VITE_SUM_API_BASE_URL='/api'
$env:VITE_SUM_API_PROXY_TARGET='http://127.0.0.1:3210'
$env:VITE_SUM_ACADEMIC_SCHEDULING='1'
$env:VITE_SUM_SIMULATOR='0'
$env:VITE_SUM_LOCAL_PROFILE='synthetic-actors'
pnpm --dir client dev --host 127.0.0.1 --port 5176 --strictPort
```

Abrir http://127.0.0.1:5176/local/programacion-academica . No se necesita iniciar
sesión como estudiante para esa única ruta. Las demás rutas conservan su control
de sesión. Este servidor API dedicado no sirve el dashboard estudiantil.

Si Node/pnpm no están en PATH, el runtime ya utilizado en esta máquina permite:

```powershell
$runtime='C:\Users\Felipe\.cache\codex-runtimes\codex-primary-runtime\dependencies'
$env:PATH="$runtime\node\bin;$env:PATH"
& "$runtime\bin\fallback\pnpm.cmd" --dir backend build
```

Usar el mismo prefijo `& "$runtime\bin\fallback\pnpm.cmd"` en lugar de `pnpm`
en las órdenes anteriores; estas variables solo afectan a esa terminal.

## Demostración al equipo

Los editores ahora muestran un solo docente y un solo ambiente a la vez. La lista
compacta de incorporados permite cambiar de selección sin perder configuraciones;
el selector de referencia agrega o selecciona uno existente, sin duplicarlo. Buscar
asignaturas por código/nombre, marcar varias y establecer máximos de secciones por
asignatura si se necesitan. Disponibilidad y carga son obligatorias; preferencias
semanales orientan la búsqueda y permiten fallback. La política se elige en Paso3;
el reparto menos concentrado es opcional y no garantiza equidad/óptimo global.

Caso reproducible ERP20118104, ciclo10: seleccionar patrón120+120, demanda180,
capacidad45 y continuo. Configurar dos docentes autorizados de referencia, habilitar
ERP para ambos, carga480min/máximo2secciones cada uno. Dar disponibilidad lunes-jueves
18:00-22:00; preferencias del primero lunes/martes y del segundo miércoles/jueves.
Seleccionar101AP (45plazas) u otro ambiente de referencia disponible en esas franjas.
Resultado:4secciones,8componentes,4bloques de4h; dos secciones por docente.
Retirar un docente deja carga480frente a960necesarios: se conservan2secciones/4componentes
válidos y2secciones pendientes. Si al docente restante se le permite960min/máximo4,
puede cubrir las4secciones; dos quedan fuera de sus preferencias, con advertencia
blanda. Estos parámetros son sintéticos, no confirmación institucional.

La tabla y calendario muestran bloques completos, con componentes internos y
duración total. La razón de terminación y cobertura se leen separadamente: una
búsqueda inconclusa puede conservar parciales válidas, sin ser una programación
definitiva. La configuración se conserva en estado al cambiar de selección, no al
recargar página ni al reiniciar procesos. No se agrega persistencia.

Las secciones usan **Bloque continuo** por defecto: componentes consecutivos del
patrón en el mismo día y con un docente responsable. Elegir **Sesiones divididas
(excepción)** permite separarlos manteniendo el mismo docente. Tabla/calendario
conservan tipos y duraciones de teoría/práctica/laboratorio.

Prueba guiada de4horas: seleccionar INO201 con patrón120+120, demanda1 y capacidad
objetivo45. Habilitar un docente para ese curso, carga mínima240min y disponibilidad
lunes18:00-22:00; configurar un ambiente45plazas disponible en esa franja. Generar:
debe resultar un bloque18:00-22:00, conservando sus dos componentes. Para6horas,
seleccionar un patrón que sume360min (por ejemplo INO104 con120+240), demanda1,
docente habilitado/carga mínima360 y ambiente disponible martes08:00-14:00.
Los parámetros de esta prueba son sintéticos, no confirmación de ese docente.

En recursos, abrir el catálogo de49ambientes de referencia AP/NP y usar
**Ambiente de referencia** para añadir un aula o laboratorio. Todos parten de45
plazas de referencia; disponibilidad editable y no confirmada. Se pueden configurar
hasta32ambientes activos por propuesta; el listado de49no se recorta. Las franjas
generales sintéticas ahora llegan a22:00 para permitir ejemplos nocturnos.

La pantalla sigue el orden selección → recursos → generación → resultados.
Se puede filtrar por ciclos1..10 sin perder las selecciones de otros ciclos.
En recursos, añadir un docente de referencia o de demostración, editar nombre/ID,
habilitar varias asignaturas, establecer carga máxima en minutos y añadir/quitar
disponibilidad semanal. Configurar aulas/laboratorios con nombre, capacidad y
disponibilidad. Los nombres de referencia proceden del seed sintético autorizado;
no confirman participación ni disponibilidad para el semestre nuevo. Los resultados
señalan docentes asignados propuestos, con nombres en tabla y calendario (nombre
completo también en el tooltip/etiqueta accesible del evento).

El catálogo inicia con hasta ocho docentes de referencia y parámetros sintéticos.
No todos los cursos tienen necesariamente un docente habilitado por defecto:
configurar habilitaciones expresamente antes de generar. Las disponibilidades se
intersectan con las franjas generales visibles (lunes-viernes08:00-22:00).
Tipo laboratorio es una etiqueta de recurso; no impone equipamiento por sesión.
Editar cualquier recurso invalida el resultado visible. Una propuesta ya retenida
conserva su configuración original y sus nombres. Recargar restablece defaults;
la configuración no se guarda en disco ni en la oferta de matrícula.

1. Consultar las 56 asignaturas agrupadas a partir de las 165 filas del seed
   explícitamente sintético. Revisar ciclo, créditos y referencia de secciones/sesiones.
2. Seleccionar dos asignaturas; introducir demanda 31/20 y capacidad 30.
   Elegir el patrón semanal presentado: sus duraciones se usan como requisitos,
   sus días/horas históricos no se copian a la nueva propuesta.
3. Generar horarios: comprobar secciones, sesiones completas, tabla y calendario.
4. Cambiar capacidad o demanda: desaparece el resultado anterior hasta regenerar.
5. Probar capacidad 0 (entrada inválida), demanda muy grande (invalid-input) y
   capacidad superior a las aulas sintéticas (impossible con diagnósticos).

search-limit se muestra si vence un presupuesto; no se promete provocarlo con
estos datos pequeños. Los límites temporales son cooperativos, no cancelación.
Demanda, capacidad y recursos son editables; el patrón semanal se elige entre los
disponibles. Disponibilidad/carga/habilitación configuradas son parámetros de demo,
no inferencias ni confirmaciones institucionales. No se copia el bloque alumno.
Los nombres docentes autorizados pueden reutilizarse manteniendo IDs locales y la
distinción entre referencia histórica y configuración del periodo nuevo.
La demanda inicial es cero y no procede del número de matriculados.

Las propuestas duran 15 minutos, máximo 20 en memoria; después pueden consultarse
por GET /local/programacion-academica/v1/propuestas/:id mientras sigan retenidas.
Al reiniciar la API se eliminan. No existe aprobación institucional ni publicación.

## Repetir la verificación integrada

Con puertos 3210 y 5176 libres, backend compilado y Chrome instalado:

```powershell
node client/scripts/verify-academic-scheduling.mjs
```

El script arranca y detiene sus propios servidores sintéticos, prueba el flujo,
guarda capturas y un resumen bajo evidence/local/programacion-academica-demo/.
No se adjunta a servidores existentes. Se puede seleccionar el ejecutable de
Chromium existente mediante PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, sin descargarlo.

## Docker y cierre

La ejecución principal local habilita el módulo y conserva el proxy existente:
`docker compose -f compose.local.yaml up --build`.
Abrir http://localhost:5180: el selector `/local/modulos` separa Estudiante de
Escuela · Programación académica. Acceso directo administrativo:
http://localhost:5180/local/programacion-academica. No se agrega al menú estudiantil.
La composición pública no habilita esta función; el argumento de imagen está
desactivado por defecto. No ejecutar compose.yaml para esta demo.
La aceptación aislada usa 5280 cuando 5180 está ocupado, sin inspeccionar ese servidor.
Para repetirla en una instancia propia recién creada y exclusivamente sintética:
`SUM_ACADEMIC_COMPOSE_SYNTHETIC=1 node client/scripts/verify-academic-compose.mjs`
(en PowerShell asignar la variable mediante `$env:SUM_ACADEMIC_COMPOSE_SYNTHETIC='1'`).
Cerrar cada proceso con Ctrl+C. No borrar .pnpm-store/, node_modules ni dist.
