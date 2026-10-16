# SS-PHOTO-1: foto base64 del estudiante

Fecha 2026-10-09. **Lista para implementación aislada Luna High** por petición expresa del usuario: componente reutilizable de imagen y hook que convierta `alumno.foto` base64. No depende del plan agregado ni añade backend/API.

Fuente única del campo: `raw-types/matricula-formulario-datos.ts` sanitizado declara `foto:string`. No se leyó un payload/foto privada ni se comprobó el formato en producción. Formatos/límite/fallback siguientes son decisiones locales explícitas, no comportamiento SUM verificado. Plan: [student-photo](../../plans/student-photo.md).

## Interfaces

- `StudentPhotoState = {status:'ready';src:string} | {status:'empty'|'invalid'}`, exportado desde `client/src/data/useStudentPhoto.ts`.
- `useStudentPhoto(photo:string|null|undefined):StudentPhotoState`.
- `StudentPhoto({photo,alt,className?})`, exportado desde `client/src/components/StudentPhoto.tsx`; `photo:string|null|undefined`, `alt:string` requerido, `className?:string`. CSS propio `StudentPhoto.css`.

Ausente o string vacío → empty. Ready produce únicamente URL Blob propia; estados empty/invalid no contienen src ni input. No log/copy/storage/cache/telemetría/servidor ni foto devuelta desde el hook como dato adicional.

## Formatos locales admitidos

Aceptar base64 estándar RFC4648 desnuda, sin whitespace ni alfabeto URL-safe, padding final opcional válido. Rechazar longitud módulo4=1, caracteres/padding/bits no canónicos; añadir padding solo para decodificación, sin alterar `foto` original. No extraer cadenas base64 de envoltorios desconocidos.

También admitir solo data URI `data:image/png;base64,...`, `data:image/jpeg;base64,...`, `data:image/gif;base64,...`, `data:image/webp;base64,...`, sin parámetros extra. Prohibido SVG, URL externa, urlFoto, mime genérico o MIME supuesto.

Decodificar y detectar MIME por firma: PNG ocho bytes `89 50 4E 47 0D 0A 1A 0A`; JPEG `FF D8 FF`; GIF `GIF87a`/`GIF89a`; WEBP `RIFF` y bytes8..11 `WEBP`. Firma desconocida/truncada → invalid. Data URI debe declarar el MIME detectado; no confiar únicamente en su etiqueta. Base64 desnuda recibe MIME solo por firma conocida.

Tope local **5 MiB decodificados**. Comprobar también longitud codificada máxima antes de decodificar; sobre límite → invalid, sin prints de la cadena. No resize/canvas/exportar ni modificar el JSON fuente. El decoder de imagen del navegador puede rechazar una imagen con firma válida: onError del componente usa fallback.

## Ciclo de recurso y presentación

Blob con MIME detectado. Crear URL mediante URL.createObjectURL en Effect, nunca durante render. Cleanup revoca exactamente esa URL cuando cambia input o se desmonta, incluido setup/cleanup extra de StrictMode. No revocar URLs ajenas ni mostrar src antiguo como foto del input nuevo.

Ready → img con alt recibido y className; empty/invalid/onError → icono de estudiante local existente con nombre accesible coherente. Alt vacío no permitido para este componente: usar texto genérico `Foto del estudiante` como fallback local de alt. CSS mínimo de tamaño adaptable/object-fit, sin cambios globales.

React Effect cleanup se consultó vía Context7 `/reactjs/react.dev`: deps nuevas/desmontaje/ciclo extra StrictMode. No acredita ningún formato de foto SUM.

## Integración delimitada

Esta unidad entrega hook/componente reusable, **sin modificar Profile/Shell** y sin exigir conexión al plan agregado. La integración posterior tiene dueño separado y depende de la entrega de estos exports.

Ubicación admisible propuesta: avatar de Profile, decisión propia autorizada por la petición; fuente exclusivamente Formulario validado `alumno.foto`, que también proporciona la identidad de ese contexto. Perfil no contiene foto en su propio endpoint. Si contexto falta usar fallback sin alumno/imagen inventados; no consultar backend adicional ni urlFoto. No integrar Shell sin requisito de esa ubicación/evidencia adicional. No se requiere esa integración para terminar esta unidad aislada.

## Aceptación y comprobaciones

| ID | Criterio |
| --- | --- |
| PHOTO-INPUT | Solo formatos/MIME/firmas/límite especificados; unknown/malformed/mismatch/too large invalid, null/empty empty |
| PHOTO-RESOURCE | URL propia creada por Effect y revocada en reemplazo/desmontaje/StrictMode; src anterior no aparece con input nuevo |
| PHOTO-UI | Imagen alt obligatorio/fallback accesible/error decoder; CSS propio reusable |
| PHOTO-PRIVACY | Sin input/foto en logs/docs/tests/fixtures privados, ningún request/storage/canvas/export/copy |
| PHOTO-STATIC | `pnpm --dir client build` y `pnpm --dir client lint` ejecutados realmente por implementador, resultados registrados |

No añadir/ejecutar tests, navegador, screenshots, servidores ni leer datos-reales/procesos/respuestas privados. Planificación no ejecutó build/lint; checks estáticos no verifican una imagen privada ni comportamiento runtime/producción. Nuevos formatos requieren decisión/tipo sanitizado, no inferencia desde un payload privado.
