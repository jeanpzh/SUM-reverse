# Glosario

Términos del dominio de la programación académica interna (`/local/programacion-academica`). Son distintos del SUM del alumno: el sistema interno escribe sus Borradores y Publicaciones; el SUM solo lee la Publicación mediante el esquema SQL acordado (PA-SQL-1).

**Propuesta**: horario generado por el motor determinista a partir de un workspace. Vive en el servidor hasta guardarse como Borrador; los ajustes se aceptan o rechazan en el servidor.

**Borrador**: versión guardada de un workspace y su Propuesta, con número de versión para control optimista (CAS). Pasa por revisión docente y aprobación; una versión aprobada o publicada es inmutable y corregirla abre un nuevo Borrador.

**Publicación**: Borrador aprobado y publicado; consultable e inmutable. Publicar es una confirmación distinta de aprobar.

**Pendiente**: sección o componente que el motor no pudo cubrir, con la causa que el motor devuelve. Un límite de búsqueda no prueba que no exista solución.

**Sesión de programación**: módulo del cliente dueño del recorrido Preparación → Horario → Revisión docente → Aprobación. Contiene el workspace, la Propuesta, el Borrador, los cambios sin guardar, las operaciones en curso y sus errores, y expone órdenes del dominio (generar, ajustar, guardar, retomar, enviar a revisión, aprobar, publicar).

**Acción principal**: la única acción destacada que la Sesión de programación calcula para la etapa actual según el estado (decisión local, `local-only`).

**Etapa**: Preparación, Horario, Revisión docente o Aprobación. Preparación tiene las vistas Resumen, Cursos y Recursos.

**Consejero de planificación**: diagnóstico asistido sobre una **Propuesta** con **Pendientes** que explica cuellos de botella de recursos o política y sugiere **Recomendaciones** sin asignar horarios por su cuenta.
_Evitar_: generador IA, solver IA, copiloto de horarios

**Recomendación**: ajuste candidato y verificable sobre el workspace (carga docente, habilitación de curso, excepción horaria o modalidad de entrega) que el planificador confirma para que el motor determinista regenere la **Propuesta**.
_Evitar_: auto-corrección, asignación automática IA
