# Aprobación y publicación E1 — simulación local

Fuente: requisitos del usuario,2026-11-04. No procedimiento/aprobación oficial de
UNMSM. Se mantiene la pantalla existente, datos académicos sintéticos y separación
absoluta de matrícula. No correos, servicios externos ni autenticación real.

## Flujo

1. Abrir http://localhost:5180/local/programacion-academica después de
   `docker compose -f compose.local.yaml up --build`.
2. Completar la propuesta, guardarla y obtener todas las conformidades docentes
   vigentes. Si hay pendientes/observaciones/cambios, resolver con editor, guardar
   y reenviar. Se requiere horario completo no vacío y validado por servidor.
3. Abrir el panel de aprobación/publicación simuladas y consultar la vista previa
   de la versión guardada. Se muestran datos mínimos de escuela/periodo y bloques
   con código, nombre, ciclo, sección, capacidad, docente, ambiente y componentes.
4. **Aprobar** es una acción distinta de **Publicar**. La aprobación congela esa
   propuesta y registra su versión de origen. Antes de publicar consultar de nuevo
   la vista previa de la versión aprobada y confirmar publicación.
5. Consultar el historial de publicaciones. La de mayor número es vigente en esta
   demostración; las anteriores continúan consultables en solo lectura.
6. Para modificar un trabajo aprobado/publicado, crear **Nuevo borrador**. Copia
   la configuración y horarios con otro ID; no conserva conformidades ni aprobación.
   Revisar, ajustar, guardar y realizar de nuevo revisión/aprobación/publicación.
   La versión anterior permanece intacta.

No se publican automáticamente cambios de un borrador. No se habilita una oferta de
matrícula ni vacantes al publicar. Las acciones locales las puede simular cualquier
usuario de esta instancia: no identifican ni autorizan una autoridad académica real.

## Versiones y almacenamiento

Hay tres números distintos: versión de archivo propuesta, versión exacta que se
aprobó y número consecutivo de publicación. El ID de una publicación es el de la
propuesta congelada. Futuro E2 deberá consultar ID y número de publicación explícitos,
en lugar de asumir que vigente no cambia durante una operación.

Se reutiliza el mismo registro JSON, checksum, cola y volumen academic-drafts.
Publicar actualiza un solo archivo mediante renombrado atómico, sin otro índice de
estado. La versión vigente se deriva del historial. Se verifica tanto la versión
del archivo como la publicación vigente esperada para evitar reemplazos accidentales
desde otra pestaña. Una versión publicada no se sobrescribe desde las rutas del módulo.

El checksum detecta corrupción accidental, no es firma digital ni defensa contra
un administrador que edite el volumen. Una instancia backend escritora; límite50
registros/2MiB incluye publicaciones. Sin borrado automático, respaldo o revocación.
Eliminar el volumen pierde los archivos. Un archivo corrupto que impida determinar
la vigente provoca error, sin presentar silenciosamente una anterior como actual.
Cambios incompatibles del catálogo/formato requieren migración explícita futura;
no se regeneran ni reinterpretan silenciosamente versiones guardadas.

Si falla la escritura de una copia después de crear su sesión temporal, esa sesión
puede ocupar una plaza de RAM hasta su caducidad previa de 15 minutos. El archivo
origen permanece intacto y no se guarda un borrador incompleto.

## Contrato para el futuro

GET /api/local/programacion-academica/v1/publicaciones
lista ID/versión/fechas y currentId; GET /publicaciones/vigente o /publicaciones/:id
devuelve contrato **PA-PUBLICATION-1**, con escuela/periodo, catálogo mínimo de los
cursos con secciones efectivas y sections/assignments existentes. No expone alumnos,
demanda individual, observaciones, configuración de recursos o autoridad interna.
Estos GET siguen siendo locales, deshabilitados en simulador público.

Antes de E2 institucional faltan identidad/roles reales, autorización y procedimiento
de aprobación, políticas de vigencia y cambios, respaldo/auditoría y reglas de
prematrícula. Esta etapa deja solo la fuente de lectura; no implementa E2/E3 ni conecta
con oferta vigente de matrícula.

Plan: plans/programacion-academica-publication.md. Contrato:
contracts/local-api/programacion-academica-demo.md. Resultados y archivos en
evidence/local/programacion-academica-publication/fullstack-verification.md desde raíz.
