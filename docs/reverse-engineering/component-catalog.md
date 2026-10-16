# Catálogo de componentes reutilizables

Los componentes “observados” describen patrones visibles; los archivos locales indican dónde se implementaron. No implican que SUM use React ni la misma arquitectura.

| Componente/patrón | Observación SUM | Implementación local | Confianza / pendientes |
| --- | --- | --- | --- |
| Shell de estudiante | Sidebar fija, barra superior, área principal; se repite en todas las notas. | `client/src/components/Shell.tsx` | Alta en estructura desktop; menú colapsado, overlays y móvil parcialmente desconocidos. |
| Elemento de navegación | Icono, etiqueta, grupos expandibles y destinos directos. | `Shell.tsx`, `client/src/data/routes.ts` | Media-alta; accesibilidad, estados hover y destinos de tarjetas no verificados. |
| Resumen académico | Panel con periodo/facultad/programa/especialidad/plan en varias pantallas; valores omitidos. | `client/src/components/Common.tsx` | Media; geometría cambia por pantalla y no siempre comparte contenido. |
| Título de página | Bloque superior alineado en páginas interiores. | `Common.tsx` | Alta en repetición, media en medidas globales por variaciones de main. |
| Tabla de datos | Encabezados agrupados o simples, filas, descarga y, en ciertos casos, estado vacío. | `Common.tsx`, `client/src/screens/TableScreens.tsx` | Alta para encabezados documentados; paginación/orden/filtrado no observados. |
| Acción de descarga | Enlaces/botones “Descargar” en reportes y perfil/formularios. | `client/src/data/download.ts` crea CSV local. | SUM no se activó; PDF/CSV de origen y formato final desconocidos. |
| Tarjeta de acceso rápido | Ocho tarjetas verticales anotadas en la página observada. | `client/src/screens/Home.tsx` implementa bento grid. | Media en contenido, baja en resultados; bento es cambio local intencional según especificación. |
| Pestañas de perfil | Información Personal, Información Académica, Cambio de Contraseña; solo estado inicial observado. | `client/src/screens/Profile.tsx` | Media; panel académico sin observar; pestaña de contraseña queda fuera del alcance seguro. |
| Navegador de secciones de formulario | Columna de anclas y formularios largos con datos deshabilitados. | `client/src/screens/StudentForms.tsx` | Media en secciones; los conteos locales no coinciden con fuente. |
| Calendario semanal | Cabecera de días y cuadrícula; horarios observados como layout. | `TableScreens.tsx` | Media; posicionamiento y estados sin cursos no confirmados. |
| Modal Horarios | Imagen suministrada muestra overlay, encabezado azul, cierre y tabla de cinco columnas. | `client/src/components/CourseScheduleModal.tsx` | Media; referencia no persistida por contener identificadores; acción de producción no se ejecutó. |
| Tarjeta de tutorial | Lista de nueve recursos con título/descripción/fecha/etiqueta. | `client/src/screens/Manuals.tsx` | Alta en forma visual (imagen sanitaria), baja en enlaces porque no se abrieron. |
| Estado vacío de tutorías | Tabla de seis columnas y mensaje de cero tutorías. | `TableScreens.tsx` | Alta para estado vacío con referencia sanitizada; estado poblado desconocido. |
| Formulario de error/carga | No descrito por observación SUM. | `client/src/components/RouteStatus.tsx` | Es decisión de resiliencia local; no atribuir al sitio real. |

## Reutilización propuesta

Mantener `Shell`, título, tabla, resumen, recurso de tutorial, sección de formulario y estado vacío como patrones separados. No unificar tarjetas o tablas solo por semejanza visual si las notas registran jerarquías/medidas distintas. Los datos personales y académicos de ejemplos deben ser sintéticos.

