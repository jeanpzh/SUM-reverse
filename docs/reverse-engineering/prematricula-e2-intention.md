# E2: registrar intención y consultar demanda

Demostración local sintética de Sistemas, periodo de planificación2027-I. Fuente:
requisito explícito del usuario (2026-11-04); no procedimiento institucional aprobado.
Se mantiene la interfaz estudiantil SUM y el reporte anterior de prematrícula.

## Estudiante

1. Ejecutar `docker compose -f compose.local.yaml up --build` y abrir
   `http://localhost:5180`. Elegir Estudiante, escenario Regular, SIS-A o SIS-B.
2. En Reportes → Prematrícula, desplegar «Mi propuesta de prematrícula».
3. Consultar una publicación E1 y elegir las secciones. Revisar horario y diagnósticos.
4. «Guardar borrador» conserva el trabajo; no registra una intención.
5. Con el borrador guardado, sin cambios pendientes y selección válida conocida,
   pulsar «Registrar intención». Posteriores cambios requieren guardar y pulsar
   «Actualizar intención». Se conserva el historial propio de versiones.

La intención anterior sigue activa mientras solo se edita o guarda otro borrador.
Registrar sobre otra publicación sustituye explícitamente la intención anterior
para ese estudiante y periodo; no suma otra persona. Una nueva publicación vigente
no migra automáticamente intenciones ni borradores.

## Política de validación de esta demo

Se vuelve a comprobar en el servidor la publicación exacta, propiedad/sesión,
versión guardada, contexto académico, cursos aprobados, prerrequisitos, equivalencias
conocidas y cruces. No se aceptan créditos, historial o aprobación del cliente.

- Requisito incumplido: bloquea el registro.
- Información insuficiente o verificación pendiente: también bloquea. No se presenta
  como requisito cumplido y no hay excepciones institucionales simuladas.
- Selección vacía: permite guardar borrador, pero no registrar intención.
- Advertencias de alcance: solo se validan datos/reglas conocidos; no equivale a una
  validación institucional completa. No se inventan mínimos o máximos de créditos.

Registrar no reserva vacantes, no confirma matrícula y no garantiza una sección.
La falta de inscripción real o de cupos todavía no forma parte de este flujo E2.

## Escuela

Abrir `http://localhost:5180/local/programacion-academica` y desplegar
«Intenciones de prematrícula». Seleccionar publicación y consultar. Se muestran
periodo/versión, participantes registrados, contados y excluidos, y conteos por
asignatura/sección. No aparecen identidades ni historiales individuales.

El conteo toma solamente la última intención de cada uno de los dos perfiles
regulares de Sistemas. Los borradores y las revisiones previas no cuentan; los120
perfiles del estimador no son cuentas. Una intención cuyo contexto cambió o no
puede revalidarse queda fuera del conteo válido y se indica como excluida.

Tres cifras distintas: potencial estimado por E1, intención registrada por E2 y
demanda final decidida por la escuela. No se suman ni se sustituyen automáticamente.
«Crear borrador E1 de esta publicación» reutiliza el fork existente: la publicación
permanece inmutable y la escuela revisa manualmente las demandas del nuevo borrador.

## Persistencia y límites

Mismo volumen y namespace E2 existentes, sin otra base de datos o migración. El
documento conserva borrador e historial independiente de intención; las propuestas
anteriores sin intención siguen siendo compatibles. Control de versión para evitar
sobrescrituras, checksum y escritura atómica, con un solo backend escritor.
Hasta100 revisiones por intención en la demo; no se descarta historial silenciosamente.
Después de reiniciar, ingresar nuevamente permite recuperar los documentos.

Roles y sesiones son simulados; no hay autenticación institucional. Solo escenario
Regular local, con flags E1/E2 habilitados; no se activa en simulador público.
No hay retiro formal de intención, auditoría institucional ni integración E2→E3.
Para esa integración faltan políticas y autorización sobre identidad real, vigencia,
retiro, equivalencias completas, reglas académicas y nueva validación de cupos.

Plan: plans/prematricula-e2-intention.md. Contrato: contracts/local-api/prematricula-intention.md.
