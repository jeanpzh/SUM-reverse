# Información de Matrícula: Sol High → Luna High

Fecha: 2026-10-08. Modo ejecutar. Encargo explícito: implementar Información de Matrícula, precedido de especificaciones exactas de un modelo High para ejecutarlas con Luna High.

## Despacho efectivo y propiedad

Planificador nativo `matricula_info_plan`, agent_type `sum-planner`, perfil GPT-6.1 Sol High. Propiedad exclusiva: `plans/matricula-informacion.md`, `contracts/local-api/matricula-informacion.md`, `screens/matricula-informacion.md` bajo docs/reverse-engineering. No código ni navegador. Principal conserva este workflow, configuración de routing y verificación/evidencia. No se despacha implementación antes del handoff listo.

Fuentes existentes: evidencia/sum/matricula-informacion estructura/interacciones/medidas y tipo candidato raw-types/matricula-info.ts. Fuente B histórica sanitizada y A futura verificación local. No producción. El artículo observado tiene cinco secciones, sin formulario ni acción de matrícula. Tipos/flags candidatos no prueban reglas académicas; el plan debe separar contenido y contrato propios de evidencia SUM.

Complejidad media por integración nueva y compatibilidad; incertidumbre media por artículo estático/candidato sin contenido; impacto medio para lectura sintética. Sol High decide interfaz precisa y criterios. Skills propias de backend/frontend se cargarán antes de código por los workers.

| Etapa | Salida requerida | Estado |
| --- | --- | --- |
| Plan Sol High | MI-CONTRACT-1, tareas MI-B1..3/MI-C1..3 y11criterios MI-* | listo; entregado por matricula_info_plan |
| Backend Luna High | matricula_info_backend ejecuta MI-B1..3; skillsbackend/CodeGraph | implementado; build/lint aprobados según entrega del worker |
| Cliente Luna High | matricula_info_client ejecuta MI-C1..3; skillscliente/CodeGraph | implementado; build/lint aprobados según entrega del worker |
| Verificación raíz | HTTP, navegador local y criterios del plan | 11/11 escenarios aprobados posteriormente |

Cambio de workflow por preferencia del usuario: nuevas funcionalidades requieren plan Sol High (o reutilizar uno suficiente de esa etapa) antes de Luna High. Actualizados AGENTS raíz, sum-workflow/model-routing y roles implementadores; los planes existentes no se rehacen sin necesidad.

## CodeGraph solicitado durante planificación

CodeGraph1.5.0 ya instalado. Las instrucciones globales `/home/jeanpzh/.codex/AGENTS.md` ya contienen la regla CodeGraph-first para repos indexados; se conservó ese bloque. Se ejecutó `codegraph init .`:105archivos,1071nodos,1970aristas, estado complete/sin cambios pendientes. `codegraph explore EnrollmentInfo --max-files 2` devolvió componente, ruta dependiente y usos de navegación. Índice `.codegraph/` excluido de Git. Workers usarán CodeGraph antes de buscar/leer código; root sincronizará al terminar implementación.

Handoff real consumido antes del código: [plan Sol High](../plans/matricula-informacion.md) y [contrato exacto](../contracts/local-api/matricula-informacion.md). El principal revisó el handoff listo antes de lanzar dos roles nativos sum-implementer LunaHigh con propiedad disjunta. DecisiónSol: contenido propio nullable sin interpretar flagsacadémicos candidatos; uniónlegacy/local para modos actuales. No es una especificación redactada por el implementador ni una selección de modelo solo en texto.

## Sincronización CodeGraph

`codegraph sync .` incorporó 17 archivos cambiados (10 nuevos, 7 modificados). `codegraph status`: 115 archivos, 1169 nodos, 2183 relaciones, índice actualizado. Consulta real de `MatriculaInformacionController` y `validateMatriculaInformacion` recuperó fuente y dependencias. Instrucción global ya vigente en `/home/jeanpzh/.codex/AGENTS.md`; no fue necesario duplicarla.

La integración HTTP/UI nueva sigue sin verificar. Las pruebas descritas por el plan son escenarios propuestos: el plan de un agente no constituye autorización del usuario para ejecutarlas. No se ejecutará el harness temporal ni una nueva suite en esta continuación.

## Diagnóstico de entrega del cliente

El worker reportó cuatro TS18047 en la fixture de `matriculaInformacion.test.ts`, después de su único ciclo automático. Se escaló al rol real `sum-planner` Sol High (`matricula_diagnostico`), que identificó la anotación nullable y decidió conservar el tipo concreto con `satisfies MatriculaInformacionLocalData`. La decisión se entregó al mismo implementador Luna High para corrección delimitada; el DTO mantiene `articulo:null`. No se reinicia el contador de reparaciones ni se repite la suite.

## Cierre de implementación

Corrección diagnosticada aplicada por Luna High; build y lint del cliente nuevamente exit 0. Backend: build y lint exit 0 según entrega del implementador. Servidor propio reiniciado con el build actualizado; Nest registró el POST de Información de Matrícula y completó arranque (sesión 91195, PID 306920). Esto acredita arranque, no aceptación HTTP/UI. No se ejecutaron nuevas pruebas ni REA/CDP para esta ampliación; se reutiliza evidencia histórica con sus límites. Código entregado; MI-V1 permanece sin verificar.

## Verificación integrada posterior

Se ejecutó MI-V1 con NestJS propio y React/Vite locales: 11/11 escenarios aprobados, incluidos vacío, fallo, recuperación y regresión de los diez endpoints anteriores. `pnpm --dir client test:data`: 21/21 aprobadas. El detalle está en `evidence/local/matricula-informacion/integracion/fullstack-verification.md`. Este resultado acredita integración local, no fidelidad de referencia SUM.
