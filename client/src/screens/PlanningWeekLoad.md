# Horario: carga general y detalle por recurso

Decisión local aprobada por el usuario el 2026-11-16: opción A de la exploración
sobre horarios densos. Se aplica exclusivamente a Horario en
`/local/programacion-academica`, respetando `docs/design-direction.md` y la
presentación v2. No es una observación sobre SUM.

El prototipo A/B/C está archivado en la rama `prototype/week-load-density`,
commit `3d896f0`, archivo
`client/src/screens/prototypes/PlanningWeekDensity.prototype.html` (abrir como
HTML; `?variant=A|B|C`). Se eligió A porque mantiene la visión semanal sin
comprimir cada bloque y permite llegar al detalle por franja. La aplicación
reutiliza el calendario, agregación de bloques, formulario de ajuste y contratos
existentes; no importa el prototipo ni introduce componentes de alumno paralelos.
La corrección e integración se realizaron directamente por el agente principal.

## Comportamiento

- Todos los docentes y todas las aulas: mapa de bloques por franjas de dos horas.
  Se cuentan intersecciones de intervalos `[inicio, fin)`. Un bloque largo puede
  aparecer en más de una franja: los recuentos de celdas no se suman para obtener
  secciones ni indican simultaneidad exacta, utilización porcentual o conflictos.
- Seleccionar una celda muestra todos sus bloques en una lista con curso, sección,
  tipo, docente, aulas y horario. Su altura está limitada y permite desplazamiento.
- Seleccionar un bloque abre el editor existente. Durante el ajuste se muestran
  ubicación actual y propuesta; el backend conserva su autoridad de validación.
- Filtrar docente o aula muestra la semana detallada. Cada carril reserva al menos
  164 px; la región puede desplazarse horizontalmente. El filtro de aula conserva
  el bloque continuo agregado si cualquiera de sus sesiones usa el aula.
- Tabla conserva selección, búsqueda y ambos filtros; sigue mostrando todos los
  componentes de las secciones coincidentes, como hacía el filtro docente.
- Las secciones sin ningún bloque asignado se abren en la Tabla ya existente.
  Las parcialmente programadas siguen tratándose en el flujo de pendientes actual.
- En móvil, el mapa muestra un día seleccionable; el detalle por recurso conserva
  la agenda diaria. Los días configurados, incluso fines de semana, son accesibles.
- La densidad usa tonos neutros y cifras. Las franjas sin disponibilidad configurada
  se rayan; una franja parcialmente disponible no representa disponibilidad completa.

## Validación reproducible (solo datos sintéticos independientes)

```sh
pnpm --dir client build
pnpm --dir client lint
pnpm --dir client test:data
SUM_ASSISTANT_CASES=week-load-overview-detail-and-resource-filters,week-load-recounts-after-valid-move \
SUM_REDESIGN_EVIDENCE=/tmp/week-load-acceptance \
node client/scripts/verify-planning-redesign-stack.mjs verify-planning-comprehensive.mjs
```

El runner inicia sus propios procesos React/NestJS/Python, usa el catálogo sintético
incorporado, un directorio nuevo de borradores en `/tmp`, LLM desactivado y entorno
controlado sin snapshots. No se conecta a un servidor del operador. Requiere las
dependencias ya declaradas y el build del backend.

| Criterio | Escenario/check | Resultado esperado |
| --- | --- | --- |
| Recuentos exactos y sin tarjetas comprimidas | Propuesta densa generada por la API; comparar todas las celdas con bloques agregados | Celdas iguales a las intersecciones; ninguna tarjeta de calendario en el mapa |
| Teclado y retorno | Enter en franja, cerrar lista | Lista completa; foco devuelto a la celda |
| Editor y rechazo | Abrir bloque del mapa; enviar inicio 00:00 | HTTP 422, error explícito, GET de propuesta idéntico |
| Aceptación sin cambio | Reenviar ubicación original | HTTP 200; misma propuesta y versión (no-op deliberado) |
| Traslado real | Propuesta aislada de un curso; mover a otro día con disponibilidad configurada | HTTP 200; versión +1; origen pierde un bloque y destino gana uno; GET coincide |
| Recursos y vistas | Filtrar docente, luego aula y alternar Tabla/Semana | Carriles ≥150 px útiles; bloques/secciones coincidentes, filtro conservado |
| Vacío | Buscar un término inexistente | Celdas cero y mensaje explícito |
| Reflujo | Viewports 1440, 720, 390 y 320 px | Sin desborde horizontal del documento; un solo día del mapa en móvil |
| Temas | Mismo mapa en claro y oscuro | Tokens locales existentes, sin errores JavaScript ni peticiones externas |
| Bordes y densidad | Tests de planningWeekLayout | Extremos adyacentes excluidos, bloques parciales/largos, domingo, vacío, 200 bloques en una franja |

La comprobación de 720 px cubre el ancho efectivo de un viewport de 1440 px al
200%; no acredita por sí sola una auditoría de zoom nativo ni accesibilidad completa.
No se cambian contratos, reglas académicas, backend ni pantallas del alumno.

## Resultados ejecutados (2026-11-16)

- `build` y `lint`: correctos; `test:data`: 305 pruebas, cero fallos.
- Escenario denso: correcto con 166 secciones, 108 bloques, 35 celdas contrastadas
  y 58 secciones sin horario. El ancho mínimo medido de los bloques filtrados
  fue 213.8 px. Pasaron filtros compartidos, vacío, teclado, reflujo y tema oscuro.
- Editor desde el mapa: HTTP 422 y conservación exacta de la propuesta; HTTP 200
  al reenviar la ubicación original sin incremento de versión.
- Traslado real aislado: correcto, HTTP 200, versión incrementada y recuentos
  del mapa actualizados en origen y destino; GET de NestJS coincide con la respuesta.
- Ambos escenarios terminaron sin errores JavaScript ni solicitudes externas.
- Referencias de ejecución: `/tmp/week-load-acceptance/acceptance.json`
  (escenario denso aprobado en la ejecución con ambos escenarios; el primer intento
  del segundo caso falló en su preparación de recursos) y
  `/tmp/week-load-move-acceptance/acceptance.json` (traslado aprobado).
  Las pruebas anteriores fallaron por suposiciones del test sobre no-op y por
  un localizador que excluía la celda de origen al quedar vacía; se corrigieron
  las pruebas tras revisar el contrato y el efecto real del servidor.

No se acredita despliegue en la URL de otra instancia ni paridad con SUM.
Los procesos sintéticos de aceptación se detuvieron al finalizar.

## Simplificación de Horario (2026-11-16)

Por decisión del usuario se retira «Detalles de búsqueda», incluido su componente
sin otros consumidores y sus estilos exclusivos. El resumen de estado, «Ver
avisos» y la revisión de pendientes conservan sus controles actuales; se omiten
las estadísticas técnicas del motor que mostraba el bloque retirado.

Aceptación: el bloque no aparece tras generar una propuesta; «Ver avisos» sigue
abriendo «Avisos de la generación»; buscar, filtrar y ajustar bloques funciona
como antes. El escenario `week-load-overview-detail-and-resource-filters` comprueba
la ausencia del bloque y la apertura de avisos antes de recorrer el horario.
