# Datos ampliados de escenarios

2026-10-16. Implementación directa por el principal, conforme a la petición de no delegar. Procedencia: confirmación previa del operador de que datos-sinteticos/ es íntegramente sintético. Sin acceso a datos-reales/, producción ni servidores existentes.

- Semilla incorporada: `backend/src/matricula-regular/scenario-reference.seed.ts`; hashes SHA-256 de plan y programación incluidos. Originales intactos.
- Plan: 97 filas, 85 asignaturas, nombres/créditos/ciclos/prerrequisitos conservados. Software adapta escuela únicamente como supuesto local.
- Programación: 165 filas. Solo primera sección de ocho asignaturas varía horario/cupo para sostener escenarios; las lecturas reflejan la ocupación actual del repositorio.
- Historial A: 64 intentos, 60 aprobadas. B: 65 intentos, 58 aprobadas y dos repitencias pendientes. Nueve periodos por perfil, ponderados calculados y fallos históricos posteriormente aprobados.
- Perfil personal ficticio, formulario y ficha enriquecidos, usando las pantallas y contratos existentes. No se añadieron registros ficticios a matrícula/horarios antes de una aceptación.
- El formulario original tiene JSON inválido en línea20 columna27. No se modificó ni consumió como fuente; se usó la estructura local existente.

## Criterio → comprobación → resultado

- Integridad de catálogos e historial/coherencia de prerrequisitos → `expanded-scenarios.spec.ts` → pasó.
- Mismos resultados de los 36 casos ampliados, lecturas HTTP de perfil/formulario/historial/plan/programación → prueba HTTP ampliada → pasó.
- Compatibilidad de casos anteriores, reset y consultas → seis suites backend, 26 pruebas → pasaron.
- Contratos cliente y representaciones nuevas → `pnpm --dir client test:data`, 177 pruebas → pasaron.
- Build backend/client y lint backend/client → pasaron; backend conserva cinco advertencias preexistentes ajenas al cambio.
- Docker local aislado `sum-expanded-check`, puerto46027, sin montajes → build y servicios saludables.
- Chromium nuevo contra ese Docker: selector, plan97, programación165, perfil, historial desde2022, matrícula aceptada, rechazo por tutoría, horario pendiente, cambio de modo y móvil → pasó. Resultado en browser-results.json; capturas expanded-plan/programming/history.png.
- Generador actualizado produce los nueve paquetes completos incorporados, sin leer datos privados ni requerirse para arrancar.

Se corrigieron expectativas antiguas de pruebas que exigían perfil null/tres cursos para el escenario reducido; las representaciones completas y cuatro cursos ahora están expresamente aceptados. Una ejecución de pruebas coincidió con la limpieza de dist del build; se repitió secuencialmente con build terminado y pasó. La evidencia es local-only, sin afirmar fidelidad de reglas oficiales ni paridad visual con producción.
