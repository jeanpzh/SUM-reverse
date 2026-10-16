# Contrato de la funcionalidad

**Revisión fijada:** `MR-CONTRACT-2`, 2026-10-11; diseño no implementado.

La autoridad única HTTP/DTO/errores/efectos es
[matricula-regular.md](../../../docs/reverse-engineering/contracts/local-api/matricula-regular.md).
No se duplica su definición aquí. Este contrato amplía la API propia local; MC/MI/RI y
reportes readonly existentes se conservan. No es contrato del SUM productivo.

El [modelo](../data-model.md), [plan revisión4](../plan.md) y [guía futura](../quickstart.md)
consumen esa misma revisión. Frontend/backend futuros no la modifican en paralelo.

Interfaz de usuario local: entrada demostrativa por actor synthetic, indicador permanente
«Simulación local» y origin synthetic visible cuando aplica; comprobar prematrícula/calendario
antes de iniciar elección. Todas las causas conocidas se muestran juntas, sin precedencia SUM;
gaps producen pendiente con consulta documental habilitada y cero escritura. Solo seleccionables en intersección completa según L-05; forzado-known fuera de lista
rechaza con causa propia. Cupo/cruce se evalúan al enviar en variante local; no disabled al seleccionar ni polling, ni nuevo panel de vacantes actualizadas. El cupo se decide al procesar
contra el estado actual, no por la lectura previa. Todo rechazo académico definitivo retorna al registro y reinicia elección; incertidumbre de transporte conserva solo la identidad del intento para
consultar/repetir manualmente, no se trata como rechazo. RouteError.invalidate se usa solo
para lecturas; nunca reenvía un comando.

Aceptación conocida muestra aviso local, con M-01 como referencia del manual; acción
«Ver reporte local» navega a reporte propio del enrollmentId, sin timeout de redirección. Su contenido procede de commit propio, no seed. Modal error con
icono/causas es inferencia local autorizada, sin literal SUM. Sesión15min es simulación,
sin implementar login/cookies/tokens. Nueva entrada tras expiración reinicia elección salvo
identidad incierta consultable. Navegación/rutas locales propuestas constan en el plan.

ACC-01–ACC-10 y protocolo de foco al abrir/cerrar modal y cambiar ruta están fijados en [catálogo](../acceptance-catalog.md), solo para feature local, sin certificación WCAG AA integral.

Cuando D1 espera «Ver reporte local», su texto es veraz y local-only; no copiar el literal
M-01 ni el indicador REDIRECCIONANDO como si ya hubiera navegación en curso. M-01 permanece
referencia documental/visual, no una obligación de texto para ese estado local.
