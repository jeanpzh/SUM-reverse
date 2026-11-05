# Ejecución: persistencia local E1

Fecha2026-11-04, rama schedule-pt1. Autor de plan, contratos y aceptación: principal.
Alcance autorizado: guardar/listar/continuar propuestas E1 sintéticas, sin modificar
generador, matrícula ni pantallas estudiantiles. Preservar fidelidad de pantallas SUM;
solo la pantalla administrativa local tiene autorizada la barra compacta nueva.

Plan reutilizable: ../plans/programacion-academica-persistence.md.
Contrato: ../contracts/local-api/programacion-academica-demo.md.
Guía: ../programacion-academica-persistence.md.
Resultados reales: evidence/local/programacion-academica-persistence/fullstack-verification.md
desde la raíz del repositorio.

Se consultaron sum-workflow y las instrucciones/skills propios de backend y cliente;
aceptación integrada con sum-fullstack-verify. Principal definió contratos antes del
handoff y modificó shared, Docker local, pruebas de configuración y documentación.
Dos workers con archivos disjuntos implementaron backend y cliente, sin subdelegar:
persist_backend y persist_frontend, ambos gpt-6-luna/high reales. No había TOML de
perfil disponible; se usó ese fallback explícito, sin fingir otro perfil.

Backend: store/servicio durable, retención confiable y rutas locales; se amplió
asignación a demo-module.ts para registrar provider. Cliente: barra/estado de
propuesta, adaptadores y prueba secuencial de navegador. Principal revisó contratos,
autoridad, comparaciones de configuración, corrupción y errores de almacenamiento;
ajustes se hicieron en el mismo ciclo de implementación. Corrigió dos supuestos
del verificador nuevo durante aceptación, sin alterar lógica del generador.

CodeGraph no inicializado: CLI/índice no demostrados y configuración sin salvaguardas
suficientes para dependencias/symlinks. No se indexaron datos privados. Ningún worker
tuvo acceso a documentos privados; la procedencia sintética se comprobó en código.

Build/lint/tipos y pruebas de capas no se usaron como sustituto de integración:
principal lanzó Compose propio5280, Chrome nuevo para guardar, reinició solo backend
propio y lanzó otro Chrome para recuperar. También ejecutó revisión ERP y flujo de
matrícula idempotente. El servicio del operador5180 no fue inspeccionado/interrumpido.
No commits, push, cambio de rama, migraciones o instalaciones.
