# E2 — cierre de implementación y verificación

5 de noviembre de 2026, Lima. Rama `schedule-pt1`. Los resultados corresponden al Compose sintético `sum-academic-acceptance` en `127.0.0.1:5280`, con Chrome y la API NestJS a través del proxy local.

El código de registro, actualización, historial y agregación ya estaba implementado al reanudar. Se conservó y se amplió únicamente el verificador para comprobar la versión recuperada y el bloqueo de un registro repetido en la interfaz estudiantil.

| Criterio | Resultado |
| --- | --- |
| Guardado independiente | Guardar el borrador dejó el conteo en cero antes del primer registro. Guardar un cambio de sección mantuvo el conteo de la intención anterior. |
| Registro y actualización | El servidor verificó el borrador guardado, su publicación, el contexto académico y las versiones. La actualización conservó el historial y movió el conteo de sección sin duplicar al estudiante. |
| Validaciones | Las pruebas de servicio cubrieron selección vacía, incumplimientos e información insuficiente. La decisión local bloquea los tres casos y permite seguir guardando borradores. |
| Aislamiento y versiones | A y B tuvieron documentos propios. Un intento de escritura cruzada devolvió 403 y una versión obsoleta devolvió 409. |
| Deduplicación y publicación | Dos estudiantes sumaron dos intenciones. Tras el registro explícito de A en otra publicación, quedó uno en cada publicación. Los borradores y las revisiones anteriores quedaron fuera del conteo. |
| Persistencia | Después de reiniciar el backend, se recuperaron ambas intenciones. La pantalla estudiantil mostró la versión recuperada y deshabilitó el registro repetido. |
| Escuela | La respuesta entregó solo agregados. La pantalla mostró totales 1, 1 y 0 para registradas, contadas y excluidas, con separación visual entre etiquetas y cifras. Las tres columnas distinguen potencial E1, intención E2 y demanda final. |
| Borrador E1 | El botón creó un borrador independiente a partir de la publicación y conservó la demanda de origen. Se compararon las publicaciones completas antes y después. |
| Matrícula | Las comparaciones de oferta completa, que incluye capacidad y ocupaciones, y del reporte de matrícula confirmada dieron igualdad antes y después de registrar y actualizar. La regresión de matrícula sintética e idempotencia también pasó. |

Capturas en esta carpeta. `intencion-recuperada.png` muestra el estado estudiantil después del reinicio. `demanda-agregada.png` muestra el resumen escolar con los estilos finales. `synthetic-intentions.json` contiene referencias de la prueba sintética, sin credenciales de sesión.

## Pruebas

- `pnpm --dir backend test prematricula programacion-academica test/matricula-regular-regression.spec.ts test/enrollment-scenarios.spec.ts --maxWorkers=2`. Pasaron 375 pruebas en 21 archivos.
- `pnpm --dir client test:data`. Pasaron 208 pruebas.
- `node --test` sobre los contratos de prematrícula, intención y programación académica, más `scripts/academic-compose-config.test.mjs`. Pasaron 32 pruebas.
- `client/scripts/verify-e2-intention.mjs`. Pasaron las fases `save` y `resume`, con un reinicio de backend entre ambas.
- `client/scripts/verify-academic-manual.mjs` y `client/scripts/verify-academic-compose.mjs`. Pasaron en el mismo proyecto sintético.
- Las compilaciones de Docker con el código final y las comprobaciones de fuente y lint pasaron antes de la reanudación. El chequeo general de tipos del backend que incluye pruebas devolvió 104 diagnósticos fuera de los archivos de intención. Lint del backend mantiene cuatro avisos previos en las pruebas de sesión.

El verificador anterior requirió corregir el cierre de sesión al alternar perfiles y el selector del desplegable escolar. La revisión visual anterior corrigió el ancho heredado de las etiquetas en los dos paneles mediante CSS local. Las ejecuciones de cierre usaron esas correcciones.

La demo cubre dos perfiles sintéticos de Sistemas en el escenario Regular y el periodo 2027-I. El historial admite hasta 100 revisiones por intención y el almacenamiento local usa un backend escritor. Para una futura conexión E2 → E3 quedan por definir identidad institucional, vigencia y retiro de intenciones, reglas académicas aplicables y comprobación definitiva de cupos al matricular.
