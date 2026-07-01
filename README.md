# regionecalabria-opendata-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server, scaffolded with the official
[TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) (`@modelcontextprotocol/sdk` v1, stable).

Currently exposes a single tool:

| Tool          | Description                                                              | Input | Output                          |
| ------------- | ------------------------------------------------------------------------- | ----- | -------------------------------- |
| `get_version` | Returns this server's own `name` and `version`, read from `package.json`. | none  | `{ name: string, version: string }` |

No other tools, resources, or prompts are registered. This is intentional scaffolding — new
capabilities should be added deliberately in follow-up work.

## Requirements

- Node.js `>=22` (LTS)
- [pnpm](https://pnpm.io/) (project package manager)

## Getting started

```bash
pnpm install
pnpm run build
```

### Run over stdio (for MCP clients that spawn a process, e.g. Claude Desktop, VS Code)

```bash
pnpm run start
# or, during development, without a build step:
pnpm run dev
```

### Run over Streamable HTTP (for remote/networked clients)

```bash
pnpm run start:http
# or, during development:
pnpm run dev:http
```

Environment variables:

| Variable | Default     | Description                                   |
| -------- | ----------- | ---------------------------------------------- |
| `PORT`   | `3000`      | TCP port to listen on.                          |
| `HOST`   | `127.0.0.1` | Host to bind to. Also used for DNS-rebinding host validation. |

The HTTP transport is served in **stateless** mode (no session tracking) via `POST /mcp`, since a
single side-effect-free tool doesn't need session state, resumability, or server-initiated
notifications. `GET`/`DELETE /mcp` return `405 Method Not Allowed`.

DNS-rebinding protection is enabled via the SDK's `createMcpExpressApp()` helper, which validates
the `Host` header against the configured `HOST`. Do not bind `HOST=0.0.0.0` without adding your own
host/CORS validation in front of it.

## Project structure

```
src/
  server.ts             # createServer(): builds an McpServer and registers all tools
  package-metadata.ts    # reads name/version from package.json
  tools/
    version-tool.ts      # the get_version tool
  stdio.ts               # stdio transport entrypoint
  http.ts                # Streamable HTTP transport entrypoint (stateless)
test/
  version-tool.test.ts   # end-to-end test via an in-memory client/server pair
```

## Development scripts

| Script               | Purpose                                              |
| --------------------- | ----------------------------------------------------- |
| `pnpm run build`      | Type-check and compile `src/` to `build/`.            |
| `pnpm run typecheck`  | Type-check only, no output.                            |
| `pnpm run lint`       | Lint + check formatting with Biome.                    |
| `pnpm run lint:fix`   | Lint and auto-fix + format with Biome.                 |
| `pnpm run test`       | Run the Vitest test suite once.                        |
| `pnpm run test:watch` | Run Vitest in watch mode.                              |
| `pnpm run verify`     | Typecheck + lint + test + build (local "definition of done" check). |

## Definition of Done for this scaffold

- [x] `pnpm run verify` passes (typecheck, lint, tests, build all green).
- [x] `get_version` is the only tool registered; no other tools/resources/prompts exist.
- [x] Both stdio and Streamable HTTP entrypoints start and respond correctly.
- [x] DNS-rebinding protection is enabled on the HTTP transport.
- [x] `.gitignore` excludes `node_modules/`, `build/`, and local env files.

## Connecting an MCP client (stdio)

Example client configuration (paths are absolute):

```json
{
  "mcpServers": {
    "regionecalabria-opendata-mcp": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/regionecalabria-opendata-mcp/build/stdio.js"]
    }
  }
}
```

## License

MIT — see [LICENSE](./LICENSE).
