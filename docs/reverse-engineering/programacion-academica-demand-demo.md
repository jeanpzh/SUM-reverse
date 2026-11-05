# Demanda potencial E1 · demostración sintética

2026-11-02. Prototipo local, no cifra institucional ni predicción de matrícula.
Diseño: `plans/programacion-academica-demand-demo.md`; análisis previo:
`plans/programacion-academica-demand-findings.md`.

## Qué calcula

Por curso, personas únicas del plan que no tienen aprobado/reconocido el curso y
cumplen todos los prerrequisitos conocidos al corte. La base es **eligible**, y
**retakeEligible** es un subconjunto de ella. No sumar ambos. Las personas restantes
se clasifican como no elegibles o información insuficiente, con causas agregadas.
Los tres grupos principales suman la población única declarada por fuente.
Los intentos fallidos repetidos cuentan una sola persona y una aprobación posterior
conocida excluye al alumno. No se predicen notas ni intención de inscripción.

Una equivalencia se considera únicamente si está expresamente reconocida en la
fuente y su conocimiento está confirmado. No se infieren equivalencias por nombres,
créditos ni similitud. La demo no importa un mapa institucional de convalidaciones.
La lista prerequisiteIds sigue la conjunción sencilla del modelo sintético actual;
no afirma resolver toda semántica de grupos, créditos previos o electivos oficiales.

La capacidad objetivo produce `ceil(base/capacidad)` con section-sizing.ts existente.
La demanda final es otra cantidad editable que se envía al generador ya existente,
que calcula sus secciones sin cambios. La cifra base no reserva plazas ni actualiza
matrícula. No se descarta necesidad por deuda, ventana de matrícula, cupos, cruces o
carga actual: son restricciones de otro problema, no prueba de intención futura.

## Fuentes y supuestos explícitos

Todas se restringen al plan sintético de Sistemas SYN-SIS-PLAN, objetivo2027-I y
resultados al corte2026-1. No se proyectan resultados del2026-II. El periodo no se
toma de una configuración institucional ni de documentos privados.

1. **existing-regular-v1:** se construyen los bundles sintéticos integrados, pero se
   selecciona solo el escenario regular y sus dos perfiles de Sistemas. No sumar los
   nueve escenarios ni contar el runId como otra persona. Se reutilizan historial,
   catálogo y traducción scenarioData.courseCodes sin modificar los originales.
   Equivalencias conocidas vacías según el supuesto del fixture existente.
2. **independent-120-v1:** identidades internas120, sin nombres, documentos ni
   contactos. Historias nuevas construidas por fórmula, no clonadas de los alumnos
   A/B; se reutiliza solamente la proyección del plan/catálogo existente. La
   distribución está orientada a casos avanzados de demostración, no es una muestra
   representativa. Revisión de fuente DEMAND-SYN-1. Se repiten12 registros idénticos
   intencionalmente:132 registros de entrada siguen siendo120 personas únicas.

La fórmula usa `grupo = índice % 10`, con12 personas en cada grupo. Para ERP20118104
y prerrequisito20118095, grupos0–2 tienen el prerrequisito aprobado;3–4 además tienen
dos intentos fallidos del curso en periodos distintos (prerrequisito aprobado antes);
5 ya aprobó el curso;6 carece del prerrequisito;7 tiene reconocimiento sintético
explícito del curso;8 tiene historial desconocido;9 equivalencias desconocidas.
Otros antecedentes se construyen sobre el mismo catálogo, no otro catálogo ficticio.
Fechas/resultados son casos de prueba fabricados y etiquetados, no datos históricos
de la facultad. No se introducen tasas probabilísticas ni se escala una muestra de2
personas para simular demanda real.

La deduplicación compara identidad estable/escuela/plan/periodo. Copias con los mismos
hechos aunque estén reordenados cuentan1; versiones contradictorias no fusionan sus
aprobaciones y quedan como información insuficiente. Campos/códigos inválidos,
prerrequisitos sin correspondencia, ciclos del grafo o datos desconocidos no producen
una falsa elegibilidad. No se leen exports, snapshots privados ni servicios del
operador; las fuentes son constantes/builders sintéticos locales.

## Ejemplo verificado

Para ERP20118104 y capacidad45:

| Fuente | Personas únicas | Elegibles/base | Repitentes incluidos | No elegibles | Información insuficiente | Secciones base |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Regular Sistemas | 2 | 0 | 0 | 2 | 0 | 0 |
| Independiente | 120 | 60 | 24 | 36 | 24 | 2 |

Los dos perfiles regulares no cumplen el prerrequisito al corte; eso no significa
que la demanda institucional del curso sea cero. En la población independiente,
60+36+24=120 y los24 repitentes ya están dentro de60. Hay24 personas sin información
suficiente: no se convierten en cero ni se suman como elegibles. Las2 secciones son
solo la base conocida de esta fuente. Con demanda final manual180/capacidad45,
el generador crea4 secciones; no suma automáticamente60+24 ni sustituye180 por60.

## Flujo de la interfaz

1. Reconstruir con `docker compose -f compose.local.yaml up --build` y abrir
   http://localhost:5180/local/programacion-academica.
2. Seleccionar cursos, demanda final y capacidad objetivo. En Paso1 elegir fuente
   sintética y pulsar Estimar demanda potencial. No se envían alumnos al servidor.
3. Revisar agregados, tamaño/revisión/corte de fuente y límites. Expandir causas
   cuando sea necesario. No se muestran identidades ni historiales de estudiantes.
4. Reestimar mantiene cualquier valor final manual, incluso si cambia la fuente.
   Usar base requiere una acción explícita por curso y está deshabilitado si hay
   información insuficiente. En ese caso sigue disponible escribir demanda manual.
5. Cambiar selección, capacidad o fuente invalida la base obsoleta; respuestas
   antiguas no la restauran. Editar demanda final conserva la base, pero invalida la
   propuesta de horarios anterior. Secciones finales sugeridas se actualizan según
   el valor final/capacidad. No persiste después de recargar la pantalla.
6. Configurar recursos/generar/revisar horario conserva el flujo E1 anterior.

API nueva de lectura calculada:
POST `/api/local/programacion-academica/v1/demanda/estimar`.
Request exacto con revisión, fuente, periodo y hasta32 cursos/capacidades. No recibe
alumnos, calificaciones, listas de equivalencias ni autoridad del cliente. Respuesta
solo agregada, validada en servidor y cliente. Controles locales/público/origen
idénticos a la API E1 existente. No existe almacenamiento de estimaciones ni una
nueva API de matrícula o reservas.

## Qué haría falta para una estimación institucional

Padrón autorizado y deduplicado con continuidad prevista, escuela/plan/periodo y corte
oficiales; resultados conciliados, equivalencias/convalidaciones vigentes y reglas
exactas de prerrequisitos/grupos/créditos. Además, electivos, reingresos, reservas,
egresados, cursos en progreso y condiciones de tutoría/autorización según acuerdos
de la escuela. Para predecir matrícula real harían falta datos históricos y señales
de intención verificables, no solo habilitación; E2 podría aportar intención en una
etapa posterior, pero no está implementada aquí. Incluso con datos reales debe
distinguirse base académica, incertidumbre y ajuste de planificación de la escuela.

No se implementaron E2/E3, aprobación, publicación, persistencia, integración SUM ni
datos privados. No cambios de matrícula, vacantes, oferta o algoritmo de horarios.
