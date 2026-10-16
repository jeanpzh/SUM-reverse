# Plan aislado: componente y hook de foto

- **ID:** `SS-PHOTO-2026-10-09`, revisión1. **Contrato fijo:** [SS-PHOTO-1](../contracts/local-api/student-photo.md).
- **Estado:** listo para Luna High, sin dependencia de SUM_SNAPSHOT_DIR, backend o plan general.
- **Planner real:** `sum-planner`, GPT-6.1 Sol High; solo documentación, sin delegación/código/pruebas/datos privados.
- **Objetivo:** producir StudentPhoto/useStudentPhoto reusable desde string base64 sin registro/copia de foto.
- **Decisión Sol:** el tipo solo declara foto:string; whitelists/MIME detectado/límite5MiB son reglas locales. Desconocido → fallback, nunca MIME inventado. BlobURL es un recurso propio con cleanup simétrico.

## PHOTO-P1 — Implementación aislada

**Rol:** sum-implementer o sum-executor **GPT-6 Luna High**. Sin subdelegación. **Dependencia:** leer SS-PHOTO-1, `client/AGENTS.md`, `client/.agents/skills/sum-react-implement/SKILL.md`. No depende de tareas B/C del plan general.

**Archivos exclusivos:** crear `client/src/data/useStudentPhoto.ts`, `client/src/components/StudentPhoto.tsx`, `client/src/components/StudentPhoto.css`. No tocar Profile/Shell/Common/App.css/contratos/backend. No revertir cambios ajenos. Puede ejecutar paralelo con backend o cliente existente porque posee solo estos tres archivos nuevos, respetando máximo dos workers.

**Consume:** input string/null/undefined y alt; ningún payload privado. **Produce:** StudentPhotoState/useStudentPhoto/StudentPhoto con firmas exactas del contrato.

- [ ] Parser local base64/dataURI estricto, MIME por firmas raster, coincidencia etiqueta/firma, límite5MiB; input sin transformación en origen.
- [ ] Estado empty/invalid/ready; BlobURL propia desde Effect, cleanup/change/unmount/StrictMode y guard para no devolver foto anterior con input nuevo.
- [ ] Componente img/alt/fallback/onError y CSS reusable mínimo, usando icono existente por import sin editar Common. Sin logs/red/storage/export/copy.
- [ ] Ejecutar `pnpm --dir client build` y `pnpm --dir client lint` al terminar archivos; registrar resultados reales/archivos/limitaciones. No tests, verify, servidores ni browser.

**Aceptación:** PHOTO-INPUT/RESOURCE/UI/PRIVACY/STATIC del contrato. Se comprueba cobertura de condiciones mediante revisión estática/build/lint; no afirmar validación runtime de foto privada.

## PHOTO-R1 — Entrega y uso posterior

**Propiedad root:** registrar entrega/estado/checks. **Dependencia:** PHOTO-P1. Worker P termina y libera propiedad antes de cualquier edición de sus archivos.

- [ ] Confirmar exports/firmas, resultados build/lint y ausencia de raw/log/private access.
- [ ] Entregar componente a dueño exclusivo de Profile si se asigna integración; este hook/componente no queda bloqueado por esa integración posterior.

Integración propuesta futura: solo avatar Profile desde Formulario validado `alumno.foto`, con fallback si contexto falta. Root asigna `client/src/screens/Profile.tsx` a un único worker después de PHOTO-P1; P no lo modifica. Shell no se integra en esta unidad.

## Invariantes y límites

Datos-reales/procesos/API/browser privados no son entradas. Fuente documental es campo foto:string del tipo sanitizado. No imágenes/copias/logs ni muestras privadas; no nueva dependencia/framework. Recurso Blob propio revocado correctamente; formato sin firma conocida inválido. Reparación nueva0/1; fallo persistente se diagnostica, no se solventa adivinando MIME. Producción/imagen privada/integración de Profile sin verificar.
