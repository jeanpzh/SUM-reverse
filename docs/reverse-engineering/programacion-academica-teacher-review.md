# Revisión docente E1: demostración local

Diseño local sintético,2026-11-04. Referencia funcional: petición del usuario;
no acredita un procedimiento oficial de la universidad. No hay notificaciones,
correos ni autenticación real. Se reutiliza la pantalla administrativa y el volumen
de propuestas; no se crea un portal separado.

## Uso previsto

1. Abrir http://localhost:5180/local/programacion-academica después de
   `docker compose -f compose.local.yaml up --build`.
2. Generar o recuperar una propuesta, ajustar si hace falta y **Guardar propuesta**.
3. En Revisión docente, seleccionar **Escuela (simulada)** y enviar el horario
   guardado completo a revisión. Los cambios sin guardar deben guardarse primero.
4. Seleccionar **Docente (simulado)** y un docente asignado. El panel reúne sus
   bloques. Registrar conformidad o solicitar cambios con una observación.
5. La escuela consulta pendientes y observaciones en el mismo selector. Para
   atenderlas usa **Editar horario** en la tabla existente, guarda y reenvía.
6. El docente revisa la nueva ronda y responde. Con todas las conformidades
   vigentes aparece **Lista para aprobación**: todavía no es aprobación ni publicación.
7. Mis propuestas → Continuar edición recupera revisión e historial después de
   cerrar el navegador o reiniciar el backend, junto con el resto de configuración.

## Qué significa la versión

Cada envío, respuesta o guardado incrementa la versión persistente y comprueba la
versión esperada. Dos pestañas no pueden sobrescribirse silenciosamente. La ronda
identifica el envío; cada decisión conserva la versión concreta donde se registró.
Se puede modificar una respuesta en la misma ronda; la anterior queda en historial.

La conformidad abarca todas las asignaciones de ese docente. Se conserva si su
huella no cambia, aunque otra parte de la propuesta avance de versión. Se invalida
si cambian sus bloques/componentes, docente, capacidad o recursos relevantes.
Una asignación transferida afecta al docente anterior y al nuevo. El historial
retiene las decisiones anteriores y la invalidación; no las convierte en vigentes.
La nueva ronda solicita respuesta a los afectados y conserva conformidades idénticas.

Cambiar demanda/recursos puede retirar todo el resultado hasta regenerar: no se
presenta una conformidad guardada como validación del trabajo local modificado.
Sin horario completo no se puede enviar ni declararlo listo para aprobación.

## Límites de esta etapa

- Selector de rol **solo simula** la interacción, no identifica ni autoriza personas.
  Cualquiera con acceso a esta instancia local puede simular ambos roles.
- Misma persistencia de una instancia backend; archivos previos sin revisión siguen
  compatibles. Sin migraciones ni servicios nuevos. Máximo200 eventos por propuesta:
  se rechazan nuevas operaciones antes de descartar historia.
- No hay aprobación académica, firma, publicación, control institucional de cuentas,
  correo, auditoría inmutable, E2/E3 ni modificación de la oferta de matrícula.
- Reutilizar una conformidad por huella es una decisión de demostración explícita;
  la universidad debe definir quién revisa, qué cambios exigen ratificación y cuál
  es el procedimiento real antes de un uso institucional.

Plan/contrato: plans/programacion-academica-teacher-review.md y
contracts/local-api/programacion-academica-demo.md. La aceptación real y sus límites
se registran en evidence/local/programacion-academica-teacher-review/ desde la raíz.
