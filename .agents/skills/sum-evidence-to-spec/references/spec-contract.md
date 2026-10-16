# Contrato de especificación de interfaz y comportamiento

Leer al crear o evaluar una especificación. Este contrato complementa los documentos por pantalla; no contiene sus especificaciones ni exige reformatear un artefacto equivalente.

Para escenarios y backend propio leer también [behavior-contract.md](behavior-contract.md). Una especificación lista debe permitir determinar:

- Funcionalidad, ruta, estado observado y alcance autorizado; exclusiones explícitas de estados no observados.
- Fuentes concretas y su procedencia: observación SUM, inferencia, decisión de la réplica o resultado local. Para referencias visuales: archivo sanitizado, viewport, scroll, estado de interacción, recorte/origen y regiones enmascaradas. El tamaño de un recorte no es el viewport del navegador. Metadatos desconocidos se declaran; no se adivinan.
- Estructura, textos públicos, componentes y geometría sustentados por las fuentes. Referenciar tokens y componentes existentes en lugar de copiarlos.
- Interacciones y resultados efectivamente observados; datos sintéticos y efectos locales etiquetados. No interpretar `unknown[]` como un contrato de filas confirmado.
- Criterios con ID estable, resultado esperado, fuente y método de verificación local. Distinguir comprobación funcional de visual y requisitos obligatorios de opcionales.
- Incertidumbres y bloqueos, evidencia segura requerida para resolverlos y decisión de preparación por alcance.

Forma compacta para criterios:

| ID | Alcance/estado | Resultado esperado | Fuente | Comprobación local | Obligatorio |
| --- | --- | --- | --- | --- | --- |

La tabla es un formato sugerido; no añadir una fila ficticia para rellenarla. Una región enmascarada o un estado no observado queda fuera de la afirmación de fidelidad. Mocks de carga/error pueden ser decisiones locales útiles, pero no hechos atribuidos al SUM.

`Lista` significa que los requisitos obligatorios del alcance delimitado son implementables y verificables con evidencia existente o decisiones locales explícitas cuando el criterio sea de la réplica propia. Esto no acredita fidelidad SUM. `Bloqueada` significa que al menos uno requiere evidencia ausente o insegura. Registrar quién/cuándo revisó el gate y los artefactos considerados; no implica una aprobación institucional ni autorización para producción.
