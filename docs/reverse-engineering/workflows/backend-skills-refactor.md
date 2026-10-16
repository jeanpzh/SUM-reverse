# Actualización del backend usando skills instaladas

Fecha: 2026-10-08. Encargo explícito: actualizar código hecho hasta ahora con skills. Alcance actual backend Reportes, MiInformación y bootstrap; contexto petición previa de routing backend. Cliente y contratos HTTP permanecen como entradas de compatibilidad.

Fuente A local sintética y B notas históricas; sin producción. Complejidad media/alta por refactor compartido, incertidumbre baja con contratos fijados, impacto medio por consultas readonly. Ejecutar sum-implementer nativo LunaHigh `backend_skills_refactor`, sin nuevo planner de arquitectura al estar fronteras fijadas. Root posee workflow/evidencia; worker exclusivo backend/src implementación, README/diagnóstico y tsconfig solo justificado, no tests/AGENTS/skills/cliente/configraíz.

Reutilizar contratos reportes-api-v1/mi-informacion-api-v1 y resultados existentes. Cargar ANTES del refactor sum-nestjs-implement, nestjs-best-practices y reglas pertinentes, nodejs-backend-patterns, nodejs-best-practices, typescript-advanced-types y oxlint. Vitest fuera del alcance: no nuevas suites/tests solicitadas. No incorporar auth/ORM/telemetría ni dependencias por recomendaciones genéricas.

Objetivo: diagnóstico concreto y cambios trazables regla→problema→archivo; mantener exactas rutas, acciones, validación/errororden, envfixtures, valores/readonly y loopback. Comprobaciones estáticas build/lint; comparación local de respuestas contra snapshot anterior cuando procesos disponibles. Snapshot anterior fuentes temporal `/tmp/backend-before-skills.json` (no referencia SUM).

Context7 consultado por principal: `/nestjs/docs.nestjs.com` móduloscompartidos/shutdown, `/microsoft/typescript-website` genéricos indexed-access. Docs de módulos Nest y TypeScript sustentan singleton e inferenciakey→data sinany, no arquitectura privada SUM.

Estado: completado para refactor backend. Cambios reales: validador común, pipes específicos sin ruta obsoleta, mapas key→data tipados, controladores con claves literales y hooks de cierre. Se conserva provider singleton compartido actual, sin extracción cosmética de módulos/tipos ni dependencia nueva.

[Regla→problema→cambio](../../../backend/docs/skills-refactor.md), [archivos/huellas](../../../evidence/local/backend-skills-refactor/changed-files.json), [compatibilidad HTTP](../../../evidence/local/backend-skills-refactor/compatibility.json). Build/lint backend exit0, sin diagnósticos. Primer build falló por narrowing genérico; única reparación1 usando firma genérica pública e implementación unión. Tras reparación build/lint aprobaron.

Principal comparó9respuestas HTTP reales pobladas anterior/nueva contra procesos locales y status/JSON coincidieron exactamente. No nuevas suites de tests, verificación UI ni repetición actual de los escenarios empty/error. La conservación de esos escenarios se sustenta en contratos, revisión del validador copiado y resultados históricos; no se presentan como nuevas comprobaciones ejecutadas. Fixtures/config/readonly no cambiaron. La evidencia histórica conserva sus huellas anteriores, este registro identifica la nueva implementación.
