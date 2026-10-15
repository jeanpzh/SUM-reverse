# Backend Agent Instructions

Estas instrucciones aplican a `backend/` y complementan el `AGENTS.md` raíz, que prevalece en caso de conflicto. El backend NestJS vive en `backend/` (no `server/`); el scaffold y el módulo actual de Reportes son la referencia para comandos y convenciones.

## Skills propias

Para trabajo en esta carpeta, cargar las skills locales pertinentes. La raíz coordina el handoff, contrato compartido e integración; la ejecución backend usa estas instrucciones:

| Tarea / condición | Skill local | Uso |
| --- | --- | --- |
| Implementar o modificar un contrato SUM propio | [sum-nestjs-implement](.agents/skills/sum-nestjs-implement/SKILL.md) | Entrada principal: contrato, archivos asignados, validación, datos sintéticos y entrega. |
| Verificar consultas HTTP, fixtures o repetibilidad | [sum-nestjs-verify](.agents/skills/sum-nestjs-verify/SKILL.md) | Entrada de verificación backend; distingue build/lint, HTTP e integración. |
| Escribir, revisar o refactorizar módulos, controllers/providers o inyección NestJS | [nestjs-best-practices](.agents/skills/nestjs-best-practices/SKILL.md) | Complementa la implementación con patrones NestJS aplicables; consultar solo reglas pertinentes. |
| Diseñar manejo de errores, middleware o fronteras de API Node | [nodejs-backend-patterns](.agents/skills/nodejs-backend-patterns/SKILL.md) | Apoyo cuando la tarea aborda estos patrones; mantener NestJS y el contrato vigente. |
| Decidir sobre runtime Node, asincronía, configuración o recursos | [nodejs-best-practices](.agents/skills/nodejs-best-practices/SKILL.md) | Apoyo para decisiones Node específicas de la tarea. |
| Resolver genéricos, tipos condicionales/mapeados o utilidades de tipos complejas | [typescript-advanced-types](.agents/skills/typescript-advanced-types/SKILL.md) | Cargar ante una necesidad real del sistema de tipos; tipos simples siguen el patrón existente. |
| Ejecutar/configurar lint, ajustar reglas o corregir diagnósticos Oxlint | [oxlint](.agents/skills/oxlint/SKILL.md) | Este proyecto usa Oxlint; conservar el comando lint vigente. |
| Escribir/ejecutar pruebas autorizadas, mocks, cobertura o configuración Vitest | [vitest](.agents/skills/vitest/SKILL.md) | Solo cuando las pruebas estén solicitadas/autorizadas; la existencia de la skill no autoriza pruebas. |

### Cómo seleccionar y combinar

1. Leer el encargo y contrato; elegir `sum-nestjs-implement` o `sum-nestjs-verify` como entrada para tareas SUM.
2. Cargar las skills de apoyo de la tabla según los archivos y problemas reales. Para código NestJS cargar `nestjs-best-practices`; para lint cargar `oxlint`. Leer las referencias internas que la skill indique para el caso concreto.
3. Skills Node y TypeScript complementan al framework. No cambian el alcance, no sustituyen NestJS por Express/Fastify ni agregan auth/ORM/infraestructura sin requisito explícito.
4. Instrucciones del usuario, AGENTS raíz, AGENTS backend y contrato local delimitan el trabajo. Las recomendaciones genéricas de producción se adaptan al backend sintético solicitado; no convierten un fixture readonly en un sistema de producción.
5. La raíz conserva planificación, contratos compartidos y aceptación integrada. El worker backend usa las skills de esta carpeta y no copia skills frontend. Registrar en la entrega las skills efectivamente aplicadas cuando cambien una decisión relevante.

Implementadores: `sum-implementer` o `sum-executor`, ambos GPT-6 Luna High. No delegar desde un trabajador.

## Alcance y fuentes

- Implementa únicamente el backend local expresamente asignado. No edites `client/`, contratos compartidos, evidencia ni configuración raíz sin asignación.
- Antes de cambiar comportamiento, reutiliza `docs/reverse-engineering/contracts/local-api/` y evidencia local pertinente. Separa lo observado en SUM de contratos, datos y decisiones `local-only`; no conviertas hipótesis en hechos de SUM.
- Implementa exclusivamente API local con datos sintéticos. No llames, proxifiques ni dependas de endpoints SUM; no añadas autenticación, persistencia externa, pagos, reglas académicas, sesión de navegador ni telemetría sin requisito explícito.
- Respeta los límites de autorización y seguridad del `AGENTS.md` raíz. No inspecciones SUM de producción ni uses REA/Playwright para ello.

## Diseño y estilo

- Sigue el patrón NestJS existente: módulos, controladores/DTO y validación runtime en el límite HTTP, servicio para consultas/reglas locales y repositorio explícito para fixtures/persistencia.
- TypeScript estricto, dos espacios, comillas simples y sin punto y coma. Conserva imports `.js` cuando corresponda al proyecto ESM.
- Los tipos TypeScript no sustituyen validación runtime. Define errores HTTP y envelopes conforme al contrato local; no aceptes parámetros de identidad/periodo/escenario no especificados.
- Fixtures deben ser sintéticos, coherentes con el contrato, de solo lectura y devueltos como copias si los consumidores podrían mutarlos. Define claramente el alcance y duración de cualquier persistencia.
- No agregues dependencias para validaciones pequeñas cuando el contrato indique validación propia. No edites código de cliente para completar una tarea backend.
- Si una tarea depende de documentación actual de NestJS, TypeScript u otra biblioteca, consulta Context7 según las instrucciones raíz.

## Comprobaciones

Los scripts existentes están en `backend/package.json`. Para cambios backend, usa los comandos pertinentes disponibles:

```sh
pnpm --dir backend build
pnpm --dir backend lint
```

Ejecuta pruebas solo cuando la tarea o el workflow aplicable las solicite o autorice. Compilación/lint prueban condiciones estáticas, no escenarios funcionales ni integración; informa cada nivel por separado y reporta comandos/resultados reales.
