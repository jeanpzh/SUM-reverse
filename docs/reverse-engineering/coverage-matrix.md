# Matriz de cobertura

Confianza: **alta** = evidencia visual sanitizada y estructura coincidente; **media** = notas directas de estructura/medición o captura pasiva acotada; **baja** = hipótesis o comportamiento no ejercitado. Para todas las filas, la cobertura aplica solo al estado disponible en la cuenta; no implica conocer backend.

| Pantalla | Ruta observada | Estructura | Interacciones | Referencia SUM persistida | Confianza / falta principal |
| --- | --- | --- | --- | --- | --- |
| Inicio | `/alumnoWebSum/v2/inicio` | Notas + REA | Parcial | No | Media; shortcuts y estado superior sin resultado; captura REA con scroll/viewport distinto. |
| Mi Perfil | `/alumnoWebSum/v2/informacion/perfil` | Notas + medidas | Inicial | No | Media; dos pestañas no observadas; descarga sin probar. |
| Historial Académico | `/alumnoWebSum/v2/informacion/historial` | Notas + medidas | Parcial | No | Media; filas y estado vacío/error sin observar. |
| Formulario de Datos Personales | `/alumnoWebSum/v2/informacion/formularioDatos` | Notas + conteos | Inicial, read-only | No | Media; mapa de campos incompleto en réplica; no editar/descargar. |
| Ficha Socioeconómica | `/alumnoWebSum/v2/informacion/fichaSocioeconomica` | Notas + conteos | Inicial, read-only | No | Media; faltan referencias sanitizadas y concordancia de controles. |
| Información de Matrícula | `/alumnoWebSum/v2/matricula/informacion` | Notas + medidas | Contenido estático | No | Media-alta en estructura; scroll, enlace a programación y cambios de período sin verificar. |
| Programación de Asignaturas | `/alumnoWebSum/v2/matricula/programacion` | Notas + medidas | Acciones no ejecutadas | No | Media; modal se describe desde imagen suministrada por operador no retenida; no abrir filas. |
| Reporte de Prematrícula | `/alumnoWebSum/v2/reportes/prematricula` | Notas + medidas | Descarga no activada | No | Media; datos/estados alternativos omitidos. |
| Reporte de Matrícula | `/alumnoWebSum/v2/reportes/matricula` | Notas + medidas | Descarga no activada | No | Media; período/filas no retenidos. |
| Reporte de Horarios | `/alumnoWebSum/v2/reportes/horarios` | Notas + medidas | Rejilla estática | No | Media; eventos, navegación semanal y ausencia de horario desconocidos. |
| Reporte de Evaluaciones | `/alumnoWebSum/v2/reportes/evaluaciones` | Notas + medidas | Sin controles visibles | No | Media; existe una fila observada pero contrato declarado es `unknown[]`. |
| Reporte de Deudas | `/alumnoWebSum/v2/reportes/deudas` | Notas + medidas | Sin controles visibles | No | Media; una fila observada; contrato de tipos vacío/ausente. |
| Mis Asistencias | `/alumnoWebSum/v2/asistencia` | Notas + medidas | Descarga/acciones sin activar | No | Media; enlaces de calendario sin resultado y captura en scroll. |
| Mi Tutoría | `/alumnoWebSum/v2/tutoria` | Notas + medidas | Estado vacío | Sí | Alta en layout de estado vacío; estado con filas no conocido. |
| Plan de Estudios | `/alumnoWebSum/v2/planEstudios` | Notas + medidas | Descarga no activada | No | Media; solo una captura estructural y valores omitidos. |
| Manuales y Tutoriales | `/alumnoWebSum/v2/manuales` | Notas + medidas | Recursos sin abrir | Sí | Alta en layout visible; destino y contenido de enlaces no verificados. |

## Cobertura funcional común

| Funcionalidad | Evidencia actual | Próximo criterio de verificación segura |
| --- | --- | --- |
| Shell y navegación | Shell descrito en pantallas y rutas históricas cargadas. | En réplica, probar vínculos, active state, back/forward y colapso local; comparar solo con referencias sanitizadas. |
| Tablas y estados | Encabezados y algunas filas/empty states documentados sin valores. | Fixtures sintéticos: tabla poblada, vacía, error y overflow; comprobar accesibilidad y CSV generado. |
| Formularios | Secciones y conteos; campos fuente omitidos. | Comparar etiquetas/cantidad con transcripción sanitizada si el operador la aporta; probar solo navegación local y controles deshabilitados. |
| Endpoints/API | README y tipos declarados; no hay tráfico crudo. | Interceptores locales para URL, método asumido, envelope, errores y cancelación; sin petición real a SUM. |
| Responsive/hover | Algunas reglas locales, no referencia SUM. | Especificar un viewport de referencia sanitizado antes de certificar; no presentar estilos locales como observación. |

## Orden sugerido de implementación

1. **Shell compartido + Tutoría y Manuales:** el shell aparece en toda la navegación y estas dos pantallas son las únicas con imágenes SUM sanitizadas para comparar. Mantener Tutoría en estado vacío hasta disponer de fixture poblado autorizado.
2. **Información de Matrícula:** artículo sin controles mutadores y estructura descrita con bastante detalle; fácil de validar sin datos de cuenta.
3. **Familia de tablas/reportes:** prematrícula, matrícula, horarios, evaluaciones, deudas, asistencia, plan y programación, usando datos sintéticos y componentes compartidos. No reutilizar tipos desconocidos como si estuvieran confirmados.
4. **Inicio:** priorizar después de decidir si se conserva la cuadrícula bento local o se vuelve al apilado observado. La navegación principal es importante, pero falta una referencia superior sanitaria comparable.
5. **Perfil e historial; luego formularios:** requieren mayor cuidado con identidad/datos y presentan pestañas, campos y estados aún sin evidencia completa. Mantener edición/contraseña fuera de alcance.

El orden maximiza evidencia visual y reutilización; no representa el orden real de uso ni una prioridad institucional.

## Revisión incremental de Inicio — 2026-10-08

No hubo observación nueva de la aplicación en este pase: no hay entorno sintético autorizado ni artefacto fuente sanitizado. La pestaña conocida es SUM autenticado y los contratos de snapshot/DOM/screenshot pueden devolver contenido de cuenta; esas operaciones no se ejecutaron. El estado de cobertura de Inicio permanece sin cambios. Véase el registro en `screens/inicio.md`.

