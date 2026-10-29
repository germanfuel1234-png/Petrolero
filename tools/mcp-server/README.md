# Servidor MCP — Petrolero

Servidor [Model Context Protocol](https://modelcontextprotocol.io) de solo lectura para este
repo. Expone dos herramientas pensadas para que **cualquier cliente MCP** (no solo Claude Code,
que ya tiene Bash) pueda recuperar contexto del proyecto sin leer archivo por archivo:

| Herramienta | Qué hace |
|---|---|
| `buscar_memoria` | Búsqueda semántica sobre `.ai/*.md` y el código fuente clave, delegando en el RAG local (`tools/ai-rag/rag_engine.py`). |
| `supuestos_pendientes` | Devuelve en JSON las decisiones de negocio tomadas sin confirmación del cliente (`packages/shared/src/supuestos.ts`): qué se asumió, qué falta preguntar y en qué archivos impacta. |

## Por qué no hay una herramienta de consulta a la base de datos

Se evaluó y **se descartó a propósito** para esta primera versión: exponer consultas SQL (aunque
sean de solo lectura) implica decidir credenciales, qué tablas son seguras de exponer y cómo
evitar que un cliente MCP mal configurado dispare una query pesada contra la base de desarrollo.
Nada de eso está definido todavía. Si hace falta en el futuro (por ejemplo, un tool
`pozos_en_falla` de solo lectura), agregarlo como una herramienta nueva en `src/index.js` que use
`@prisma/client` en modo lectura, con su propio usuario de base de datos restringido — no
reusar el usuario de escritura de `DATABASE_URL`.

## Setup

```bash
cd tools/mcp-server
npm install
```

`buscar_memoria` necesita el RAG local funcionando (ver `tools/ai-rag/README.md`: Ollama
corriendo + índice construido). `supuestos_pendientes` necesita `packages/shared` compilado:

```bash
npm run build --workspace=@petrolero/shared
```

## Registrarlo en un cliente MCP

### Claude Code (este proyecto)

Ya está registrado en [`.mcp.json`](../../.mcp.json) en la raíz del repo, con alcance de
proyecto. Al reiniciar Claude Code en este directorio, va a pedir aprobar el servidor nuevo la
primera vez.

### Cline / otros clientes con `mcp_config.json` o `cline_mcp_settings.json`

Agregar esta entrada (ajustando la ruta absoluta si el repo está en otra ubicación):

```json
{
  "mcpServers": {
    "petrolero": {
      "command": "node",
      "args": ["/home/german/Escritorio/petrolero/tools/mcp-server/src/index.js"]
    }
  }
}
```

### Claude Desktop

Mismo formato, en `claude_desktop_config.json` (`~/Library/Application Support/Claude/` en
macOS, `%APPDATA%\Claude\` en Windows).

## Prueba manual

```bash
cd tools/mcp-server
node src/index.js
```

Queda esperando mensajes JSON-RPC por stdin (es el protocolo MCP sobre stdio) — no está colgado,
así se conecta cualquier cliente MCP. Para probarlo sin un cliente completo, usar el `Client` del
SDK (`@modelcontextprotocol/sdk/client/index.js`) con `StdioClientTransport` apuntando a este
script.
