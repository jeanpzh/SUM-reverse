# Excepciones de carga regladas y prelación docente lexicográfica

El motor de programación trata el reglamento docente (R.R. 001380-2026-R/UNMSM, con el art. 9
modificado por la R.R. 005348-2026-R/UNMSM) como restricción dura y no como preferencia. El
horario generado solo usa la carga que cada docente tiene autorizada hoy. La ampliación de 12 a
20 horas lectivas y la autorización del VRAP por encima de 20 se muestran como decisiones
posibles con su impacto calculado, y solo entran en el horario cuando el operador registra la
evidencia correspondiente. La prelación (nombrados de la facultad, interfacultativos, contrato;
luego categoría y régimen) se optimiza por niveles estrictos, fijando el valor óptimo de cada
nivel y no las asignaciones.

El conocimiento del reglamento vive en un único módulo, el **Perfil normativo**, versionado por
vigencia. El motor recibe topes y niveles ya resueltos y no conoce artículos.

## Opciones consideradas

- **Relajar la carga docente con una penalización**: rechazado. La ampliación nace de una
  solicitud voluntaria del docente con declaración jurada; el planificador no puede decidirla, y
  la aprobación en la interfaz no sustituye esa autorización.
- **Prelación como pesos en un único objetivo**: rechazado. «Únicamente si no hubiera se
  solicitará el contrato de docentes» no admite compensarse con una mejor franja horaria.
- **Asignar por etapas y congelar cada etapa**: rechazado. Una elección temprana puede dejar sin
  cubrir un curso que una reasignación global sí cubre.
- **Codificar los topes en el motor Python**: rechazado. Backend e interfaz también necesitan
  explicar cada límite y bloquear la publicación; dos copias del reglamento divergirían.

## Consecuencias

- Una propuesta con una autorización obligatoria sin registrar no puede publicarse.
- La duración de la hora lectiva (45, 50 o 60 minutos, art. 8) es un parámetro obligatorio del
  perfil; sin él no se calculan topes.
- Los criterios de FISI sin norma localizada (turnos de ciclos superiores, cursos de tesis,
  180/90 alumnos, 45 por sección) siguen siendo parámetros configurables con su procedencia
  visible, no reglas del perfil normativo.
- El reglamento solo cubre docentes ordinarios; los topes de los contratados quedan como brecha.
