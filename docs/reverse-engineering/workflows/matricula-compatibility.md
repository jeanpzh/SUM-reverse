# Revisión de Matrícula y compatibilidad de datos

Encargo: verificar nuevamente con REA y corregir el flujo de extremo a extremo cuando las diferencias estén demostradas. Compatibilidad objetivo: JSON de lectura de Matrícula, Programación y reportes extraído por el operador de DevTools. Fecha: 2026-10-08, America/Lima.

## Fuentes y autorización

El solicitante declaró explícitamente que su cuenta está autorizada para consultar Matrícula, Programación y reportes, sólo lectura y metadatos de red. La autorización se aplicó al único target abierto en `https://sum.unmsm.edu.pe`, sin caducidad declarada. No se capturaron cuerpos HTTP, cabeceras, cookies, tokens ni filas personales. Se reutilizan los tipos proporcionados y las notas previas. El principal posee el navegador; los subagentes no inspeccionan producción.

Se descargaron únicamente los dos scripts frontend públicos cargados por las pantallas autorizadas; se analizan como artefactos estáticos, sin ejecutar los handlers ni invocar acciones candidatas. Las lecturas runtime se observaron con REA y se extrajeron sólo rótulos/estructura DOM sanitizados.

## Enrutamiento

Complejidad alta (contratos raw/local, transporte, repositorios y pantallas); incertidumbre alta (faltan snapshots y transacción de inscripción); impacto alto para conservar datos y no atribuir reglas locales al SUM. `matricula_compat_plan`, rol real `sum-planner`, GPT-6.1 Sol High, posee plan y contrato. El principal dirige REA y aceptación. Implementadores Luna High se despachan después de fijar el contrato.

## Hallazgos iniciales

- El backend local Información de Matrícula produce `{codSemestre, articulo}`; el tipo proporcionado contiene fechas, mensajes, flags, perfil y creditaje. La frontera local rechaza esa respuesta raw y el modo legacy sustituye su contenido por un artículo constante.
- REA observó GET/200 para seis consultas: formulario de datos, Información de Matrícula, Programación y reportes de prematrícula/matrícula/horarios. El catálogo previo asumía POST. Se mantendrá separada la API propia POST y la forma observada GET.
- Programación tiene ocho columnas, agrupación por ciclo y modal que utiliza `data.horarios` de la fila. Su apertura no originó una nueva petición de datos. El script declara exportación PDF; el CSV existente pertenece a la réplica.
- La validación de Programación agrega restricciones del fixture (claves exactas, valores positivos y coincidencias entre campos) que no establece el tipo. Faltan validadores completos para las formas conocidas de reportes y una entrada offline de snapshots.
- Los contratos presentes describen lecturas. No existe contrato suministrado de inscripción, selección/confirmación, escritura o resultado transaccional.

## REA ejecutado

Target único: `ev_ed9a5458607517869b380e444994d3b77fe02e7061a71db7a37a2f96dc0bc3ff`. Listener directo del botón formulario: `ev_b003cddbc31acecbcb9742ac7c1d1a413d0c0f4af687abedf3535d6519cd218f`; callback jQuery, sin causalidad app inferida.

Análisis estático inicial del JS público Información: `ev_6661efb996fd7c7e808ebab73cda8b80dc44ec94d39a4b2b978adbc24aeb168f`. Captura runtime inicial falló por un selector de ocho headers; un único retry con selector de botón de fila resolvió esa ambigüedad. Captura final `ev_29de9faf2926f7eb1a43b0f0d401934cc6ca8500944bee41ffc9bb496f81f13d`: quince pasos completados, incluyendo apertura visible de horarios y las cinco rutas. [Metadatos sanitizados](../../../evidence/sum/matricula-compatibility/rea-network.json) registran los seis GET/200. REA marca la completitud global `incomplete` para eventos; no acredita igualdad integral ni recupera actividad ausente.

## Estado

Plan y MC-CONTRACT-1 entregados por `matricula_compat_plan` (Sol High). `matricula_compat_backend` y `matricula_compat_client`, ambos rol nativo `sum-executor`, GPT-6 Luna High, completaron sus archivos disjuntos. Backend posee el validator puro compartido; cliente consume su interfaz fija. Ambos aplicaron las skills de su carpeta. La búsqueda Programación se añadió con evidencia REA de vacío/restauración sin nueva red.

Se implementaron validación estructural compartida de las cinco respuestas completas, lectura offline atómica al arranque, conservación de extras/campos opacos/fechas y transporte GET legacy separado de POST propio. Programación usa su propio alumno, ocho columnas, agrupación por ciclo, filtro en memoria, modal por fila y CSV explícitamente local. Información raw muestra fechas/mensajes y perfil condicional; el artículo previo permanece como orientación local señalada. No hay inscripción transaccional implementada.

Cliente: build/lint y test:data 27/27 aprobados en entrega. Backend: build/lint y pruebas enfocadas 9/9 aprobados tras diagnóstico root. El worker backend agotó su reparación automática con un fallo de ruta duplicada; root reprodujo y corrigió ese diagnóstico específico, sin reiniciar el contador. Root además comprobó que Date/Map/RegExp no eran JSON planos y que el cause nativo de JSON.parse podía exponer texto inválido; añadió regresiones y corrigió ambos límites. No se hizo otra reparación automática del worker.

Aceptación root: [216 campos requeridos independientes del AST](../../../evidence/local/matricula-compatibility/reference-types-check.json), [HTTP de cinco snapshots](../../../evidence/local/matricula-compatibility/http-snapshot-results.json) e [integración real NestJS/React](../../../evidence/local/matricula-compatibility/e2e-results.json). La integración comprobó igualdad archivo→Nest→parser, reinicio/lecturas concurrentes, vistas desde menú y directo, modal/filtro sin HTTP, CSV completo aun filtrado, calendario con segundos y errores 503/JSON incompleto con reintento. Ninguna solicitud externa en ese escenario sintético.

REA local `ev_478d807549f682c362ecbe15a9a59ee30dcce3670a0ac5c190f636d51d17dd91`: 16 acciones y navegación inicial completadas, seis consultas POST/200 propias, modal/vacío/restauración sin nuevas API. Su completitud local fue complete; la referencia sigue incomplete y usa GET. Esto acredita reproducción funcional acotada, no igualdad integral de producción. [Metadatos locales](../../../evidence/local/matricula-compatibility/rea-local.json).

Los cinco archivos reales pueden cargarse ahora según [README backend](../../../backend/README.md). Una futura aceptación con JSON real exige snapshots sanitizados aportados por el operador y pruebas contra ellos; los tipos y los fixtures sintéticos no permiten certificar por anticipado compatibilidad universal del 100%. Registro, selección, validación de escritura, confirmación, laboratorios y PDF permanecen sin reconstrucción verificada. Informe y reproducción: [verificación](../../../evidence/local/matricula-compatibility/fullstack-verification.md).
