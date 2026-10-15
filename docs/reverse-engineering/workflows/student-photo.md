# Foto del estudiante

- Fecha: 2026-10-09.
- Plan reutilizado: [all-snapshots](../plans/all-snapshots.md), SS-P1 y alcance de foto de SS-C3.
- Contrato: [SS-CONTRACT-1](../contracts/local-api/all-snapshots.md), sección Foto del estudiante.
- Planner real: sum-planner, GPT-6.1 Sol High. Implementador: sum-executor, GPT-6 Luna High, tarea student_photo_component.
- Fuente: tipo sanitizado `raw-types/matricula-formulario-datos.ts`; declara `alumno.foto: string`. No se inspeccionaron imágenes privadas ni el SUM.

## Resultado local

Implementados `useStudentPhoto`, `StudentPhoto` y CSS propio. El hook admite Base64 estándar y data URI PNG/JPEG/GIF/WebP; valida firma/MIME y límite de 5 MiB, crea una URL Blob propia y la revoca al reemplazo/desmontaje. El componente proporciona alt y fallback accesible.

Integración mínima en `Profile.tsx`: el avatar utiliza `alumno.foto` del formulario cargado mediante el hook existente. No requiere completar la ingestión agregada de otros módulos para consumir el formulario disponible. El formato admitido y la ubicación de la foto son decisiones locales. La extensión de fuentes y el contexto opcional del plan general permanecen fuera de esta entrega.

Ampliación solicitada por el usuario: reutilizar el componente en los avatares existentes, incluido Inicio. Inspección estática con CodeGraph y búsqueda acotada en `client/src/` identificó únicamente los avatares de Home y Profile; los iconos de navegación no representan fotos. Se reutiliza el contrato sin añadir comportamiento nuevo: Home consume la misma foto validada y conserva su wrapper; el CSS del componente hereda el radio del contenedor. Esta petición amplía la ubicación previamente delimitada a Profile. Se asignaron únicamente `Home.tsx` y `StudentPhoto.css` al mismo implementador Luna High, como sustitución aislada.

## Comprobaciones

El implementador ejecutó `pnpm --dir client build` y `pnpm --dir client lint` después de crear el componente y después de integrarlo: ambos pasaron. Root revisó estáticamente la integración con CodeGraph y ejecutó `git diff --check -- client/src/screens/Profile.tsx`: pasó.

La reutilización en Inicio quedó implementada. El implementador repitió build/lint y `git diff --check -- client/src/screens/Home.tsx client/src/components/StudentPhoto.css`: pasaron. Root revisó la conexión a `formulario.data.alumno.foto` y el CSS compartido. Home y Profile utilizan el mismo componente y conservan sus contenedores y tamaños.

No se ejecutaron pruebas de navegador, servidores ni consultas HTTP con snapshots privados. La visualización de la foto real debe comprobarla el operador en su proceso local; build/lint no acreditan fidelidad SUM ni compatibilidad con una imagen privada concreta.
