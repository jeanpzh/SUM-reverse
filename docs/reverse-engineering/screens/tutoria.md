# Mi Tutoría

- **Ruta:** `/alumnoWebSum/v2/tutoria`.
- **Interfaz observada:** resumen, tabla Docente/Cód. Asignatura/Resolución/Fecha/Observación/Acción y mensaje de estado vacío.
- **Interacciones:** no había filas/acciones disponibles en la captura.
- **Evidencia:** `evidence/sum/tutoria/{structure,interactions,measurements}.md`, `evidence/sum/tutoria/reference.png`; tipo candidato `raw-types/tutoria.ts` declara `unknown[]`.
- **Límite:** la referencia sanitizada cubre el estado vacío; no permite inferir el estado poblado. No hay forma conocida de elementos.
- **Confianza:** alta para layout/estado vacío; baja para contrato y estado con tutorías.

