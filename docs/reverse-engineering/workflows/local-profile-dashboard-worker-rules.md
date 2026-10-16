# Reglas comunes de los workers de dashboard

Encargo autorizado: integrar perfiles sintéticos y la sesión local en el dashboard. Antes de implementar, leer el brief de tarea, el contrato fijado por raíz, `AGENTS.md`, las instrucciones de la carpeta asignada y su skill propia. No delegar. No revertir cambios ajenos ni modificar archivos fuera de ownership; los demás workers trabajan en paralelo.

## Fuente y CodeGraph

Solo código existente, evidencia sanitizada y fixtures construidos independientemente. Nunca acceder a `datos-reales/`, tampoco indirectamente mediante aplicaciones, respuestas, logs, exportadores o capturas. No iniciar AppModule del operador ni servicios con snapshots privados. No producción ni exportadores.

Usar CodeGraph antes de localizar/leer código. Si falta índice/configuración local, comprobar `codegraph.json`: exclusiones explícitas de privados, `datos-reales/`, dependencias, entornos y symlinks ajenos; después ejecutar `codegraph init` y registrar resultado. Los enlaces `client/node_modules` y `backend/node_modules` apuntan a dependencias instaladas y están excluidos. El encargo incluye únicamente los metadatos locales seguros de CodeGraph necesarios.

## Implementación y entrega

- Usar `backend/.agents/skills/sum-nestjs-implement/SKILL.md` o `client/.agents/skills/sum-react-implement/SKILL.md`, según asignación.
- Contrato y aceptación fijados antes de implementar; no cambiar spec/plan/contrato arbitrariamente. Preguntas concretas por `orchestration ask` con autoridad inyectada.
- Reutilizar componentes, DTOs y validadores; sin dependencias nuevas ni autenticación SUM inventada. Marcar decisiones `local-only`.
- Frontend y backend poseen archivos disjuntos. Navegador solo si el coordinador asigna propiedad explícita; build/data/HTTP pueden ejecutarse sin navegador.
- El baseline contiene código previamente no committeado. No realizar `git add .`, commits, reset/clean, despliegue ni publicación. Entregar lista exacta de archivos modificados y reporte.
- Pruebas sintéticas requeridas: build/lint del proyecto y tests específicos del brief; frontend `test:data` cuando afecte datos. No ejecutar suites desconocidas que puedan usar snapshots privados.
- Reportar criterio → escenario → resultado esperado/real, comandos y códigos de salida. Un check planeado o fallido no es aceptación.
- Como máximo un ciclo automático de reparación; luego diagnóstico y consulta concreta al coordinador, sin repetir a ciegas.
- Leer inbox antes de cada archivo/tras tests y antes de `worker_done`; usar IDs/ejecutable exactos del preámbulo vigente. `worker_done` una sola vez con outcome explícito y reporte real; luego quedar idle. El coordinador libera recursos tras settlement.

## Inbox completo y acknowledgment

No truncar la salida del inbox a1000 tokens ni leer solo la primera fila: una entrega FIFO se repite hasta ack. Usar el helper asignado `python evidence/local/local-profile-dashboard/orca-inbox.py --terminal <tu_handle>` (stdin cerrado para WSL; imprime todos los cuerpos sin duplicar payload). Procesar todos los mensajes; luego `python .../orca-inbox.py --terminal <tu_handle> --ack <deliveryId>`. El ack puede devolver otra entrega, que también debe procesarse antes de continuar. Usar exclusivamente tu handle/IDs del preámbulo. No auto-ack antes de leer/procesar ni enviar worker_done con una instrucción de transferencia pendiente.
