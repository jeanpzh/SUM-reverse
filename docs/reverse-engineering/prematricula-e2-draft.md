# Mi propuesta de prematrícula — E2 local

Demo sintética del 2026-11-04. Propuesta del usuario; no procedimiento institucional.
Se amplía la pantalla habitual /alumnoWebSum/v2/reportes/prematricula conservando
su reporte de asignaturas pendientes. No se cambia matrícula, oferta o publicaciones.

## Uso

1. Ejecutar `docker compose -f compose.local.yaml up --build`, entrar como Estudiante
   en http://localhost:5180, escoger escenario **Regular** y perfil **SYN-SIS-A** o
   **SYN-SIS-B**. Los demás perfiles/modos conservan el funcionamiento previo.
2. Abrir Reportes → Prematrícula; desplegar **Mi propuesta de prematrícula**.
3. Consultar una publicación E1: escuela Sistemas, periodo2027-I y número de versión.
   Si no existe, la escuela debe generar, revisar, aprobar y publicar una demo E1 primero.
   No se sustituye por la oferta vigente de matrícula.
4. Elegir, reemplazar o retirar secciones mediante los controles existentes. Una
   sección por asignatura. El calendario muestra la propuesta, no matrícula confirmada.
5. Revisar créditos y diagnósticos. Guardar un borrador vacío, parcial o con requisitos
   pendientes está permitido; el aviso no lo convierte en una selección académica válida.
6. Recuperar el propio borrador; cerrar navegador/reiniciar requiere ingresar de nuevo,
   pero el documento conserva propietario, publicación, selección y versión.

La elegibilidad depende del historial sintético: un curso publicado no necesariamente
está pendiente para ambos perfiles. La primera demo de publicación de un curso ya
aprobado puede mostrar ese diagnóstico correctamente; no se alteran historiales para
forzar habilitación. Las pruebas integradas preparan una publicación compatible con
los datos de los actores existentes.

## Reglas y límites

- Se reutilizan correspondencia académica y clasificación del estimador E1: aprobados,
  prerrequisitos y equivalencias conocidas, con información insuficiente diferenciada.
  La fuente regular declara equivalencias conocidas/vacías, no una tabla institucional.
  Corte académico disponible: 2026-1; no predice cursos en progreso o aprobación futura.
- Se suman créditos una vez por asignatura y se comprueban cruces entre componentes.
  No se aplica mínimo de 12 ni máximo de 26 créditos, turno de matrícula, deuda, prioridad administrativa
  o autorización de repitencia no acordada para E2.
- Capacidad planificada no significa vacantes disponibles. No se reserva nada y no
  se llama al servicio de ejecución de matrícula. No hay Registrar intención o agregados.
- La publicación ID+número y sectionId originales quedan fijados; una nueva vigente
  no cambia el borrador. Cambiar de publicación es explícito y limpia selección local;
  el archivo anterior permanece hasta guardar la nueva configuración.

## Propiedad, integridad y persistencia

La sesión actual autoriza las operaciones; la identidad duradera es perfil+fuente
regular+escuela/plan/periodo, no runId. No se suman nueve escenarios ni se crean cuentas
desde los 120 perfiles del estimador. Un borrador por estudiante en esta demo.
Dos pestañas con versiones distintas no pueden pisarse: se devuelve conflicto y se
conserva la edición. El backend comprueba publicación, versión y contexto académico;
no confía en créditos/historial/diagnósticos enviados por navegador.

El mismo volumen durable de E1 tiene un namespace separado **e2-prematricula**. Se
reutiliza escritura atómica/checksum/CAS mediante store genérico, sin otro mecanismo,
base de datos, migraciones o dependencias. Los JSON E2 no se mezclan con los de E1.
Sin respaldo ni autenticación institucional; un operador que borre el volumen pierde
los documentos. La demo permite simular ambos perfiles, no acredita identidad real.

## Fuera de alcance

Registro formal de intención, conteos agregados, reservas, matrícula definitiva,
publicación institucional y simulador público. Futuras ampliaciones deben definir
qué intenciones cuentan y cómo se retiran/actualizan, sin mutar publicaciones E1 ni
reservar cupos de E3. Contrato: contracts/local-api/prematricula-e2.md.

## Verificación

Se comprobó React → NestJS → volumen durable en un Compose propio sintético en 5280,
sin acceder al servicio del operador. Pasaron aislamiento A/B, reemplazo/retiro,
calendario, créditos, cruces, borrador vacío, CAS y recuperación tras reiniciar.
La publicación nueva no sustituye la guardada. Oferta, ocupaciones y reporte de
matrícula no cambian al guardar E2. La ejecución habitual en 5180 usa el mismo Compose.

[Informe con archivos, pruebas y límites](../../evidence/local/prematricula-e2-draft/fullstack-verification.md).
