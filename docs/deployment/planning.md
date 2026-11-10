# Programación académica con asistente

Versión de distribución: `planning-2026.11.10`. Requiere Docker Engine o
Docker Desktop con Compose 2.24+, Git y acceso a Internet para descargar las
imágenes y dependencias. No requiere Node, Python ni una cuenta de CopilotKit.

## Arranque

Clona el repositorio y entra en su carpeta. Configura una vez la API key de
Amazon Bedrock que te entregue el operador en tu terminal (no la guardes en Git).
En Bash puedes introducirla sin que quede en el historial:

```sh
read -rsp 'Bedrock API key: ' AWS_BEARER_TOKEN_BEDROCK; echo
export AWS_BEARER_TOKEN_BEDROCK
```

En PowerShell:

```powershell
$key = Read-Host 'Bedrock API key' -AsSecureString
$env:AWS_BEARER_TOKEN_BEDROCK = [System.Net.NetworkCredential]::new('', $key).Password
```

Después, un comando construye y arranca web, API y asistente:

```sh
docker compose -f compose.planning.yaml up --build -d --wait
```

Abre http://localhost:5180/local/programacion-academica.
Conserva esa terminal/configuración para posteriores comandos Compose. La clave
se monta únicamente en el motor como secreto; no se incorpora a imágenes,
argumentos de compilación ni al frontend. Compose rechaza el arranque si falta.
No imprimas ni compartas la clave o configuraciones de tu entorno.

Opcionales, antes del arranque: `SUM_PORT` cambia el puerto web, `AWS_REGION`
cambia la región (por defecto `us-east-1`) y `SUM_LLM_MODEL` el identificador de
modelo/perfil (por defecto `us.amazon.nova-lite-v1:0`). La clave debe tener acceso
al modelo y región elegidos. El perfil predeterminado puede usar inferencia
entre regiones de EE. UU. Las llamadas a Bedrock consumen la cuota de la clave.

## Uso y límites

La aplicación usa exclusivamente los escenarios sintéticos incorporados. No
monta snapshots, directorios personales ni archivos privados. No es un despliegue
público con autenticación: la web se publica solo en loopback; API y motor no
publican puertos en el host. Las pantallas y reglas existentes se conservan.

El consejero combina simulación determinista con el proveedor configurado. El
chat normativo usa el corpus público parcial revisado y conserva sus reglas de
abstención. Este paquete no configura pgvector ni indexación: la recuperación
normativa permanece léxica y puede devolver «no determinado». Las mejoras de
RAG/GenUI están en pausa. Tener una clave no elimina esos límites. Si Bedrock
falla, se conserva el fallback explícito, sin inventar respuestas o fuentes.

## Operación

```sh
# Ver estado y diagnóstico (no contienen intencionalmente la clave)
docker compose -f compose.planning.yaml ps
docker compose -f compose.planning.yaml logs --tail 100 backend engine
# Parar conservando borradores y publicaciones
docker compose -f compose.planning.yaml down
# Actualizar al código descargado con git pull
docker compose -f compose.planning.yaml up --build -d --wait
```

Los borradores y publicaciones guardados explícitamente persisten en el volumen
`sum-planning_academic-drafts`. El chat sigue siendo estado local de la sesión.
`down` conserva el volumen; `down -v` lo elimina y pierde los datos guardados.
Para rotar la clave, actualiza la variable y recrea el motor:
`docker compose -f compose.planning.yaml up -d --force-recreate engine`.
No cambies los otros Compose: el simulador y el modo operador son independientes.

Decisión de red: Python comparte el espacio de red de la API, preservando el
contrato de conexión a loopback; nginx sigue enviando `/api` a NestJS.
Referencias: [secretos Compose](https://docs.docker.com/compose/how-tos/use-secrets/)
y [network_mode](https://docs.docker.com/reference/compose-file/services/#network_mode).
