# Probar el dashboard con perfiles sintéticos

Desde la raíz del repositorio:

```sh
node scripts/start-local-profile-dashboard.mjs
```

El comando compila el backend, inicia únicamente la composición sintética propia y Vite, e imprime las dos direcciones de loopback. Abrir la dirección **Frontend (Vite)** y entrar con uno de los cuatro perfiles: SYN-SIS-A, SYN-SIS-B, SYN-SOFT-A o SYN-SOFT-B. No se necesita contraseña. Ctrl-C cierra los procesos creados por este comando.

Para elegir puertos disponibles de forma explícita:

```sh
node scripts/start-local-profile-dashboard.mjs --frontend-port=5741 --backend-port=5742
```

Si un puerto está ocupado, el comando aborta sin conectarse al servicio existente. Sin opciones elige puertos dinámicos. `--skip-build` permite reutilizar una compilación vigente; la factory rechaza una compilación ausente o desactualizada. Node instalado debe soportar TypeScript nativo (22.18+; verificado con 24.18).

## Recorrido

1. Elegir el perfil y pulsar Ingresar. Se inicia una sesión demostrativa de 15 minutos y se comparte su identidad al navegar por el dashboard.
2. Consultar Matrícula Vía Internet y usar Ver matrícula. Habilitación de prematrícula, ventana y condiciones académicas siguen sus propias reglas; tener o descargar un reporte no otorga permiso.
3. Elegir cursos/secciones y solicitar matrícula. Solo una aceptación genera el reporte y sus horarios; un rechazo no registra cursos parcialmente.
4. Usar Renovar sesión local para renovar explícitamente. Salir limpia el acceso local; recargar el navegador vuelve al selector. Las consultas y la navegación no renuevan.

Los perfiles y sus datos son sintéticos independientes; los datos personales ausentes se muestran como no disponibles. No constituyen cuentas SUM ni acreditan requisitos institucionales. La fecha académica demostrativa avanza desde 2026-08-11T14:00Z, con una ventana sintética de 2 horas por proceso. Reiniciar crea otro run y restablece el estado; no hay persistencia en disco. Una solicitud de resultado incierto se consulta por su identidad, sin reenvío automático.

Esta entrada usa el config dedicado sintético y no cambia el modo local del operador ni sus snapshots. La aceptación real de la feature se registra en [verification.md](../../evidence/local/local-profile-dashboard/verification.md); las 9 tareas pendientes de001 son un alcance separado.
