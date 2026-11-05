# Guardar propuestas E1 en el entorno local

Diseño local de demostración, 2026-11-04. Plan/contrato:
`plans/programacion-academica-persistence.md`. No aprobación/publicación oficial.

## Uso

1. Ejecutar `docker compose -f compose.local.yaml up --build` y abrir
   http://localhost:5180/local/programacion-academica.
2. Seleccionar cursos y configurar demanda final, capacidad, patrón, docentes,
   disponibilidad y ambientes. La base potencial sintética sigue siendo una cifra
   separada de la demanda final; ambas se conservan cuando existe una estimación.
3. Dar un nombre y pulsar **Guardar propuesta**. Se puede guardar solo configuración
   válida antes de generar horarios, o guardar un resultado generado y ajustado.
4. Elegir **Lista para revisión** solo cuando existe un horario completo y no vacío;
   guardar el estado. Significa preparación para revisión de la escuela, no aprobación.
5. Después de cerrar el navegador o reiniciar contenedores, abrir **Mis propuestas**,
   desplegar una fila y pulsar **Continuar edición**. Se restauran selección, demanda,
   patrones/modos, recursos/cargas/preferencias/disponibilidades, base y horarios con
   ajustes. Se puede editar y actualizar el mismo registro guardado.
6. Cambiar demanda o recursos retira el resultado anterior y vuelve a Borrador. Guardar
   entonces conserva la configuración nueva sin presentar horarios obsoletos como
   válidos. Generar de nuevo produce un resultado correspondiente a esa configuración.

No hay autosave. El aviso Cambios sin guardar distingue lo editado de lo confirmado
por el servidor. Si se escribe durante un guardado, se conserva el texto nuevo y
permanece pendiente de guardar; no se sustituye por la captura anterior. Antes de
abrir otro trabajo se pide confirmar el descarte cuando hay cambios locales.

## Dónde se guarda y qué sobrevive

Un archivo JSON por propuesta, con ID UUID estable y versión incremental, en un
volumen Docker nombrado **academic-drafts**, separado de cualquier oferta o dataset
de matrícula. Compose añade el prefijo del proyecto al nombre efectivo del volumen.
El backend lo monta en `/app/backend/var/academic-drafts`; esa ruta se habilita por
SUM_ACADEMIC_DRAFT_DIR. No se guarda en localStorage ni en el sistema de archivos
efímero del contenedor. No hay base de datos, migraciones ni dependencias nuevas.

Cerrar navegador, reiniciar, recrear o ejecutar down/up conservando el volumen mantiene
los archivos. Eliminar ese volumen borra el trabajo; esta etapa no implementa copia
de seguridad, exportación ni papelera. Los borradores guardados no tienen caducidad.
La sesión temporal de horarios sin guardar conserva el límite previo de15min/20
propuestas en memoria. Guardar periódicamente; si una sesión temporal expiró antes
de guardar sus cambios, la copia confiable no se reemplaza por datos del navegador.
Continuar edición desde un archivo guardado crea una sesión temporal nueva sin
volver a ejecutar el generador. El ID del trabajo guardado se conserva; el ID interno
de sesión del horario puede cambiar para no pisar otras pestañas.

Sin la variable de directorio las acciones de persistencia devuelven503 y las otras
funcionalidades E1 siguen operativas. El simulador público no recibe ni la variable
ni el volumen. Las propuestas son compartidas por esta instancia local: **Mis
propuestas no autentica ni separa cuentas administrativas**.

## Integridad y sobrescritura

El navegador envía configuración y referencia/versionado del horario que ya conserva
el servidor. No envía asignaciones o autoridad para reemplazarla. El backend verifica
que la configuración corresponda al resultado y conserva entrada/recursos originales,
resultado automático y ajustes. La base potencial se obtiene desde la fuente sintética
autorizada, sin confiar en totales escritos por el cliente.

Cada guardado usa escritura temporal exclusiva, sync y renombrado atómico. Una cola
serializa actualizaciones en **una sola instancia backend**. Si dos pestañas parten
de la versión1, la primera guarda versión2 y la segunda recibe conflicto409; no pisa
el archivo y conserva su edición local. Consultar la lista actualizada antes de
continuar; no hay fusión automática de cambios.

Al recuperar se comprueban checksum, formato/versionado, catálogo, configuración,
cobertura, nombres y recursos, disponibilidad/conflictos, tipos/duraciones de sesiones,
pendientes y ajustes con los validadores existentes. No se regenera el horario.
Archivos corruptos/incompatibles se cuentan como no disponibles y se conservan sin
sobrescribir. Checksum detecta corrupción accidental, no es una firma contra un
administrador que pueda modificar el volumen. No se promete coordinación entre
varios backends ni durabilidad absoluta ante un fallo físico del disco.

## Alcance y siguientes pasos

Se conserva el perfil de demostración Sistemas/2027-I y datos sintéticos; no se
guardan identidades/historias estudiantiles, datos del PDF ni snapshots privados.
Hasta50 propuestas y2MiB por archivo. Solo se guardan configuraciones estructuralmente
válidas, no formularios incompletos/inválidos. Un catálogo/formato incompatible se
rechaza al recuperar; los archivos no se migran automáticamente ni se borran.

Quedan para una fase posterior: respaldos/exportación, migración explícita de versiones
de catálogo/formato, autenticación/propiedad y colaboración multiusuario, si el equipo
las necesita. No se implementan E2/E3, aprobación docente ni publicación institucional.
