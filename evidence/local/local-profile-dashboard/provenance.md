# Procedencia y preparación — dashboard local

Fecha: 2026-10-14. Estado: preparación, todavía sin aceptación funcional.

Fuente de la ampliación: encargo explícito del usuario, clasificado como diseño local-only. Reutilización prevista: factories independientes de matrícula regular para Sistemas/Software y proyecciones sintéticas propias; no se importan exportaciones ni snapshots del operador. La ausencia de archivos privados en un worktree no acredita por sí sola las respuestas de un servidor: la verificación deberá crear su propio módulo/harness aislado.

Orca creó ../sum-dashboard-api y ../sum-dashboard-ui como hijos del checkout REA. Los manifiestos api-baseline.json y ui-baseline.json registran SHA256 del código y documentos permitidos transferidos, sin seguir symlinks ni copiar .env privados, datos-reales, compilados o dependencias. La comparación determinista inicial aprobó 606 archivos por worktree; codegraph.json tiene exclusiones ampliadas deliberadamente y no forma parte de esa igualdad.

Los únicos enlaces nuevos apuntan a client/node_modules y backend/node_modules existentes, ambos excluidos del índice. Las consolas fallback vacías fueron cerradas con ptyKilled:true antes de iniciar implementadores. No se borraron worktrees históricos ni sus entregas.

Los puertos de aceptación se elegirán para procesos propios y se abortará ante ocupación sin inspeccionar el servicio desconocido. No se usará AppModule del operador ni se acreditará integración con el interceptor auxiliar SYN-SHELL-001. El resultado final requerirá React → proxy local → NestJS real → estado sintético propio.

Comprobaciones ya ejecutadas: manifests con exclusión de privados, hashes de baseline, exclusiones de CodeGraph y git diff --check de documentos; todas aprobaron. Pruebas de aplicación de esta ampliación: aún pendientes.
