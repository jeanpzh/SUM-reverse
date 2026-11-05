# Primera integración E2 → E3

Decisión local solicitada por el usuario. Preservar fidelidad visual e interacción SUM. Solo añadir la acción de carga a la pantalla local existente y reutilizar su selección, confirmación y recuperación.

POST /api/local/prematricula/v1/intencion/traslado recibe el mismo {identity} que contexto E2 y devuelve E3IntentionImport, definido en shared/matricula-intention-import. Solo lectura, misma protección E2, sin cambios públicos. El servidor recupera la última intención, la publicación exacta y la oferta del perfil activo, revalidando sesión y contexto después de esperas. El resultado queda asociado a runId, actorId y profileRevision. El cliente descarta resultados de un contexto distinto y protege ediciones durante la consulta. Una lista vacía nunca borra la selección.

La correspondencia de cursos usa courseCodes del actor y el plan. Un origen de sección explícito, almacenado fuera de la proyección HTTP de oferta, enlaza publicación ID/versión, curso/sección de origen y destino. Solo coincidencias únicas, admitidas y con horario idéntico y cupo aparente se precargan. Una sección llena o con horario distinto queda pendiente de elección manual. Fecha de corte académica y periodo objetivo son conceptos distintos.

Reglas: conservar vía histórica, incluir una política explícita en EnrollmentProfile para reutilizar el evaluador y constantes existentes en un perfil futuro del mismo ámbito. La política se resuelve en servidor con findProfile, jamás se toma del cliente. Para perfiles futuros la falta de conocimiento obligatorio produce brechas; conservar excepciones y reglas históricas. Reutilizar criterio actual de turnos sobre fechas del perfil. Ningún perfil u oferta 2027-I se instala por defecto.

Backend exclusivo: prematricula service/controller, matricula-regular rules/profile types/service/windows/context si necesario, pruebas nuevas. Frontend exclusivo: RegularEnrollment, adaptador de lectura y pruebas propias. Contrato, plan y aceptación de la raíz. Preservar configuración y escenario vigentes. Usar solo contexto aislado en pruebas positivas. Verificar regresión, Docker y navegador de forma secuencial en el proyecto sintético.
