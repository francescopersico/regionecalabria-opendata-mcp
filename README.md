# regionecalabria-opendata-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server, scaffolded with the official
[TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) (`@modelcontextprotocol/sdk` v1, stable).

Exposes the following tools:

| Tool             | Description                                                                                   | Input                                    | Output                                       |
| ---------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| `get_version`    | Returns this server's own `name` and `version`, read from `package.json`.                        | none                                        | `{ name: string, version: string }`               |
| `package_list`   | Lists dataset names/identifiers from the [Regione Calabria open data portal](https://dati.regione.calabria.it/) (CKAN `package_list`). | `{ limit?: number, offset?: number }`      | `{ names: string[] }`                             |
| `package_show`   | Returns the full metadata + resources of one dataset by id/name (CKAN `package_show`).           | `{ id: string }`                            | `{ dataset: object }` (raw CKAN dataset dict)       |
| `package_search` | Full-text search over datasets (CKAN `package_search`); preferred over `package_list` for browsing/filtering. | `{ q?: string, rows?: number, start?: number, sort?: string }` | `{ count: number, results: object[] }` (raw CKAN dataset dicts) |
| `datastore_search` | Queries the actual data rows inside a DataStore-enabled resource (CKAN `datastore_search`), not just dataset metadata. Requires a `resource_id` with `datastore_active: true`, found via `package_show`. | `{ resourceId: string, q?: string, filters?: object, fields?: string[], sort?: string, limit?: number, offset?: number }` | `{ total?: number, fields: object[], records: object[] }` |

No other tools, resources, or prompts are registered. This is intentional scaffolding — new
capabilities should be added deliberately in follow-up work.

`datastore_search` only works against resources that have CKAN's DataStore extension enabled for
them (`datastore_active: true` in `package_show`'s `resources` array); this portal has DataStore
enabled and most CSV/XLSX resources are queryable this way. `limit` is capped at 1000 rows per
call regardless of the value requested, to keep responses a reasonable size to return to a model.

`package_show` and `package_search` return CKAN's dataset dictionaries as-is (loosely typed).
This portal uses the Italian DCAT-AP_IT metadata profile, whose fields vary between datasets and
sometimes contain JSON-encoded strings (e.g. `theme`, `creator`), so no strict schema is enforced
on dataset shape.

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

| Variable        | Default                                                    | Description                                                   |
| ---------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `PORT`          | `3000`                                                      | TCP port to listen on.                                          |
| `HOST`          | `127.0.0.1`                                                 | Host to bind to. Also used for DNS-rebinding host validation.    |
| `CKAN_BASE_URL` | `https://dati.regione.calabria.it/opendata/api/3/action`      | Base URL of the CKAN Action API used by the `package_*` tools. Override to point at another CKAN portal. |

The HTTP transport is served in **stateless** mode (no session tracking) via `POST /mcp`, since a
single side-effect-free tool doesn't need session state, resumability, or server-initiated
notifications. `GET`/`DELETE /mcp` return `405 Method Not Allowed`.

DNS-rebinding protection is enabled via the SDK's `createMcpExpressApp()` helper, which validates
the `Host` header against the configured `HOST`. Do not bind `HOST=0.0.0.0` without adding your own
host/CORS validation in front of it.

### Testing in VS Code Copilot Chat

This repo includes a workspace [`.vscode/mcp.json`](./.vscode/mcp.json) that registers this server
(over stdio, running the compiled `build/stdio.js`) for Copilot Chat:

1. `pnpm run build` (re-run after any change to `src/`, since `mcp.json` runs the compiled output).
2. Open the Chat view, and start the `regionecalabria-opendata-mcp` server from the MCP Servers UI
   (or run **MCP: List Servers** from the Command Palette) — confirm the trust prompt.
3. Ask Copilot to use `get_version`, `package_list`, `package_show`, `package_search`, or
   `datastore_search`, e.g. *"Use package_search to find Calabria open datasets about acque"*.

## Project structure

```
src/
  server.ts               # createServer(): builds an McpServer and registers all tools
  package-metadata.ts      # reads name/version from package.json
  ckan-client.ts           # shared CKAN Action API client (callCkanAction, getCkanBaseUrl)
  tools/
    version-tool.ts          # the get_version tool
    package-list-tool.ts     # the package_list tool
    package-show-tool.ts     # the package_show tool
    package-search-tool.ts   # the package_search tool
    datastore-search-tool.ts # the datastore_search tool
  stdio.ts                 # stdio transport entrypoint
  http.ts                  # Streamable HTTP transport entrypoint (stateless)
test/
  version-tool.test.ts             # end-to-end test via an in-memory client/server pair
  ckan-client.test.ts              # unit tests for the CKAN client (mocked fetch)
  package-tools.test.ts            # end-to-end tool tests (mocked fetch)
  datastore-search-tool.test.ts    # end-to-end datastore_search tool tests (mocked fetch)
  package-show.integration.test.ts # live network sanity check against the real portal
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
- [x] `get_version`, `package_list`, `package_show`, `package_search`, `datastore_search` are the
      only tools registered; no other tools/resources/prompts exist.
- [x] Both stdio and Streamable HTTP entrypoints start and respond correctly.
- [x] DNS-rebinding protection is enabled on the HTTP transport.
- [x] `.gitignore` excludes `node_modules/`, `build/`, and local env files.
- [x] `package_*` tools call the real Regione Calabria CKAN API (base URL overridable via
      `CKAN_BASE_URL`) and surface CKAN/network errors as tool errors instead of throwing.
- [x] Unit tests mock `fetch` for determinism; one live integration test confirms the real
      portal's `package_show` response still matches our assumptions.

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
