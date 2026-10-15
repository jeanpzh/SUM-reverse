# Contrato de comportamiento y API propia

Leer para especificar comportamiento, servicios NestJS o integración. Completar documentos existentes equivalentes; no exigir un formato nuevo para evidencia suficiente.

## Escenarios

Por escenario: ID, actor sintético, precondiciones, estado inicial, acción/entrada, secuencia de estados, condición de espera, resultado visible, efecto y lectura posterior. Determinar si recarga/reinicio, permisos, duplicados, concurrencia o recuperación son pertinentes. Para cada afirmación enlazar fuente y categoría `observed`, `inferred`, `unverified` o `local-only`; una decisión local expresa puede ser implementable sin fidelidad SUM acreditada.

Un control visto no demuestra su acción. Un tipo no demuestra obligatoriedad ni reglas. No deducir éxito/error, validación o persistencia desde rótulos, POST o `unknown[]`.

## API NestJS independiente

Destino: `docs/reverse-engineering/contracts/local-api/<slug>.md`, enlazado desde la especificación del flujo. Separar claramente contratos candidatos SUM (`observed-api.md`) de la API que diseñamos. Elegir adaptación compatible con el cliente existente o un contrato propio con adaptador; no exigir rutas legacy por defecto.

Definir lo necesario para cada operación:

- ID y escenario/criterio que la requieren; lectura/escritura y frontera cliente/servicio.
- Método/ruta, query/path/body, DTO, campos requeridos/opcionales/nulos, serialización y validación.
- Respuesta/envelope, código HTTP, vacío, errores y recuperación; no copiar valores no observados como hechos.
- Reglas e invariantes, permisos si corresponden, efectos y aislamiento de actores sintéticos.
- Persistencia (memoria o almacenamiento elegido), seed/reset, duración y resultado de recarga/reinicio cuando requerido.
- Idempotencia/duplicados, atomicidad/concurrencia cuando requeridos; justificar el caso de matrícula/cupos antes de implementación.
- Política de integración local: origen/puerto o proxy local, configuración del adaptador, CORS/credentials si aplican. Nunca proxy ni sesión SUM.
- Por decisión: evidencia concreta o elección `local-only`, incertidumbre y comprobación de aceptación.

Un contrato propio está `lista` si sus requisitos obligatorios son explícitos, implementables y verificables con decisiones locales autorizadas o evidencia suficiente. La fidelidad funcional SUM es un gate separado. No inventar un contrato para una funcionalidad no solicitada ni certificar fidelidad donde solo hay fixtures.
