# Backend local de SUM (Reportes, Mi Información y consultas de matrícula)

API NestJS local con fixtures sintéticos de solo lectura. No se conecta a SUM y no
usa autenticación, base de datos ni telemetría. El endpoint raíz `GET /` conserva
el Hello World del scaffold.

## Ejecución local

En una terminal:

```sh
pnpm --dir backend start:dev
```

El servidor escucha en `127.0.0.1:3000`. `PORT` permite elegir otro puerto.

En otra terminal, ejecutar el cliente con su perfil local:

```sh
pnpm --dir client dev:local
```

Las variables de fixture se configuran en el proceso backend:

```sh
REPORTES_FIXTURE=empty MI_INFORMACION_FIXTURE=empty ASISTENCIAS_FIXTURE=empty PROGRAMACION_FIXTURE=empty PLAN_ESTUDIOS_FIXTURE=empty pnpm --dir backend start:dev
```

Para `REPORTES_FIXTURE`, el valor omitido o `populated` usa el catálogo completo.
`empty` vacía las filas de Pre-Matrícula, Matrícula, Horarios, Evaluaciones y
Deudas; conserva resumen y metadatos de Matrícula. Para `MI_INFORMACION_FIXTURE`,
el valor omitido o `populated` selecciona los datos sintéticos completos; `empty`
conserva la identidad, el perfil y las estructuras del formulario, y vacía
historial, familiares y los otros valores de formulario. Cualquier valor distinto
aborta el arranque. Las consultas son de solo lectura y devuelven copias; los
datos duran la vida del proceso y vuelven al modo elegido al reiniciar.

## API local de Mis Asistencias

`POST /alumnoWebSum/v2/asistencia?accion=obtenerResumenAsistencia` acepta un cuerpo
ausente o un objeto JSON vacío y responde HTTP 200 con
`{message:null,codError:null,data}`. La consulta comparte la validación de solo
lectura existente y la identidad sintética de Reportes.

`ASISTENCIAS_FIXTURE` omitido o `populated` genera tres filas sintéticas de
asistencia; `empty` devuelve una lista vacía. Otros valores abortan el arranque.
Los porcentajes se calculan localmente y se redondean a dos decimales; una fila
sin clases tiene conteos y porcentajes en cero. Los datos viven en memoria durante
el proceso y cada consulta devuelve copias.

## API local de Mi Información

Las cuatro rutas aceptan `POST`, `?accion=<acción literal>` y un cuerpo ausente
o un objeto JSON vacío. Responden con HTTP 200 y `{message:null,codError:null,data}`:

| Ruta | `accion` |
| --- | --- |
| `/alumnoWebSum/v2/informacion/perfil` | `obtenerInformacionAlumno` |
| `/alumnoWebSum/v2/informacion/historial` | `obtenerHistorialAcademico` |
| `/alumnoWebSum/v2/informacion/formularioDatos` | `obtenerFormularioDatosMatricula` |
| `/alumnoWebSum/v2/informacion/fichaSocioeconomica` | `obtenerFichaSocioeconomica` |

Son contratos de la réplica local con datos sintéticos. La ruta `formularioDatos`
se sirve una sola vez desde el módulo Mi Información y conserva los campos/flags
existentes de Reportes, agregando las ocho secciones de campos.

## API local de Información de Matrícula

`POST /alumnoWebSum/v2/matricula/informacion?accion=obtenerInformacion` acepta
un cuerpo ausente o un objeto JSON vacío y responde HTTP 200 con
`{message:null,codError:null,data}`. El artículo readonly contiene cinco secciones
sintéticas y usa el periodo del formulario de alumno que sirve Reportes.

`MATRICULA_INFORMACION_FIXTURE` omitido o `populated` devuelve el artículo;
`empty` devuelve `articulo: null` con el mismo periodo. Cualquier otro valor,
incluida la cadena vacía, aborta el arranque. Los datos son locales, readonly y
se reconstruyen por lectura; no se guardan entre procesos.

## API local de Programación, Plan de Estudios y Tutoría

Las tres consultas aceptan `POST`, `?accion=<acción literal>` y un cuerpo ausente o
un objeto JSON vacío. Responden HTTP 200 con `{message:null,codError:null,data}`.

| Ruta | `accion` | Respuesta |
| --- | --- | --- |
| `/alumnoWebSum/v2/matricula/programacion` | `obtenerProgramacionAsignaturas` | `{alumno,programacion}` con el alumno compartido y ocho cursos o una lista vacía |
| `/alumnoWebSum/v2/planEstudios` | `obtenerPlanEstudios` | ocho filas o una lista vacía |
| `/alumnoWebSum/v2/tutoria` | `obtenerListaAsignaturaTutoria` | lista vacía |

`PROGRAMACION_FIXTURE` y `PLAN_ESTUDIOS_FIXTURE` omitidos o `populated` usan
datos sintéticos completos; `empty` vacía las filas y conserva el alumno de
Programación. Cualquier otro valor, incluida la cadena vacía, aborta el arranque.
Tutoría siempre devuelve `[]` y no requiere variable de fixture. Las consultas
son locales, readonly, en memoria y cada lectura entrega copias.

## Snapshots offline de Matrícula

Para reproducir lecturas completas desde JSON locales ya sanitizados, configura
`MATRICULA_SNAPSHOT_DIR` con la ruta absoluta a un directorio que contenga estos
cinco archivos fijos:

```text
matricula-info.json
programacion-asignaturas.json
reporte-pre-matricula.json
reporte-matricula.json
reporte-horario.json
```

Ejemplo de inicio:

```sh
MATRICULA_SNAPSHOT_DIR=/absolute/path/to/sanitized-matricula-snapshots pnpm --dir backend start:dev
```

El backend carga y valida los cinco envelopes al arrancar; si falta un archivo,
el JSON o esquema es inválido, o se combina esta variable con
`REPORTES_FIXTURE`, `PROGRAMACION_FIXTURE` o `MATRICULA_INFORMACION_FIXTURE`, el
proceso falla sin servir un conjunto parcial. Sin `MATRICULA_SNAPSHOT_DIR` se
conservan los fixtures sintéticos anteriores. Los snapshots quedan readonly en
memoria durante la vida del proceso y cada lectura devuelve una copia del
envelope íntegro, incluidos `message` y campos adicionales. Para tomar cambios
en los archivos hay que reiniciar el backend. Esta función reproduce archivos
offline proporcionados por el operador; no descarga ni sanitiza datos y no
trasplanta el alumno del snapshot a otros módulos.

Para datos privados del operador, usar `datos-reales/` en la raíz, excluida de
los agentes, Git y CodeGraph. El operador inicia el backend fuera del sandbox
de los agentes. Los archivos privados y su configuración local no deben
compartirse ni incluirse en commits; este repositorio distribuye fixtures sintéticos.

## Build y lint

```sh
pnpm --dir backend build
pnpm --dir backend lint
pnpm --dir backend start:prod
```
