# Validación de distribución — planning-2026.11.10

Fecha: 2026-11-10. Fuente `observed`, entorno local propio y exclusivamente
sintético. Proyecto Compose `sum-planning-acceptance`, puerto 5680, volumen nuevo,
clave ficticia y `SUM_LLM_PROVIDER=disabled`. No se inspeccionaron servicios del
operador ni se invocó Bedrock. Los resultados no acreditan comportamiento SUM.

| Criterio → escenario/check | Esperado | Resultado |
| --- | --- | --- |
| Distribución → build backend, engine, frontend | Tres imágenes construibles | PASS |
| Un comando → Compose up --wait | API y motor saludables; web disponible | PASS |
| Contratos de red/privacidad → tres tests Compose | Web loopback, sin puertos API/motor, secreto solo Python y sin bind mounts | 3/3 PASS |
| Interfaz existente → verify-planning-redesign sobre Docker propio | Generación, tablas/Semana, selección, panel asistente, temas, seis vistas, menú móvil; sin errores ni peticiones externas del navegador | 9/9 PASS |
| Integración asistente → verify-planning-docker.mjs | Web → nginx → NestJS → Python; corpus parcial con citas y abstención honesta; consulta vacía 400 | PASS |
| Persistencia → guardar desde React, down, up --no-build, listar | Mismo ID, título y versión | PASS |
| Cliente → build/lint/test:data | Compilar y conservar comportamiento | PASS; 302 tests |
| Backend → build/lint/test sin tres archivos browser separados | Compilar y conservar contratos | PASS; 785 tests |
| Python → pytest completo con LLM desactivado | Reglas, solver, contratos y adaptadores con mocks | 71 PASS, 2 skipped (integraciones opt-in) |
| Contratos Node / componentes de chat | Validación, fallback y render seguro | 10/10 y 6/6 PASS |

Incidencias de validación: la primera ejecución Python concurrente con
compilaciones superó un límite temporal; la repetición completa pasó. Dos
compilaciones Docker se detuvieron por falta de disco; se limpiaron cachés de
dependencias/compilación y se evitó duplicar la caché uv dentro de la imagen.
La construcción final pasó. Dos assertions SSR antiguas esperaban textos técnicos
que ahora están plegados; se actualizaron para comprobar el estado inicial actual,
sin cambiar la UI ni el RAG. Se mantienen los checks de enlaces y markdown seguro.

Avisos conservados: cuatro warnings unbound-method existentes en backend,
chunks cliente >500 kB y deprecación upstream de langchain-community.

Límites: no se comprobó una clave real, permisos Bedrock, facturación ni una base
vectorial. Este paquete distribuye el RAG léxico existente; la conexión de
embeddings y GenUI siguen en pausa. El despliegue es local, sin autenticación para
Internet. Los borradores/publicaciones persistidos no incluyen el historial local
del chat. No se afirma paridad visual SUM a partir de pruebas del producto interno.
