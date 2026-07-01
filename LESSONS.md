# Lessons Learned

This file collects reusable, non-sensitive lessons discovered while working on this
repository. Read it at the start of every session before making changes.

## MCP TypeScript SDK

- As of 2026-07-01: `@modelcontextprotocol/sdk` v1.29.0 is the stable, production-ready
  package (`import ... from '@modelcontextprotocol/sdk/...'`). A v2 split (`@modelcontextprotocol/server`
  + `@modelcontextprotocol/client`) exists as a beta (`2.0.0-beta.x`) implementing the
  2026-07-28 spec; not recommended for production until it stabilizes. Always check
  `npm view @modelcontextprotocol/sdk version` and the GitHub README banner before
  assuming which major line is current — this changes quickly.
- `express` is already a direct dependency of `@modelcontextprotocol/sdk` (used internally
  for `createMcpExpressApp`), but it is **not** a peer dependency. When using pnpm (which
  forbids phantom/transitive dependency access), you must still add `express` and
  `@types/express` as explicit dependencies of your own package to import their types.
- `@modelcontextprotocol/sdk/server/express.js` exports `createMcpExpressApp()`, which adds
  DNS-rebinding protection (Host header validation) automatically based on the `host` you
  pass in. Prefer it over building your own Express app for any Streamable HTTP transport.
- For a stateless Streamable HTTP MCP server (no sessions needed), use
  `new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` and create a new
  `McpServer` + transport pair per request, closing both on `res.on('close', ...)`.
- For testing tools end-to-end without spinning up a real transport, use
  `InMemoryTransport.createLinkedPair()` from `@modelcontextprotocol/sdk/inMemory.js` together
  with the `Client` class from `@modelcontextprotocol/sdk/client/index.js`.
- Reading a server's own `package.json` version reliably in ESM: resolve the path with
  `dirname(fileURLToPath(import.meta.url))` and `readFileSync` + `JSON.parse`, rather than
  relying on `import ... with { type: 'json' }` (less portable across TS/Node version combos
  at project scaffold time).

## TypeScript configuration

- `exactOptionalPropertyTypes: true` frequently breaks compatibility with third-party
  libraries (including `@modelcontextprotocol/sdk`) whose optional properties are typed as
  `foo?: T` instead of `foo?: T | undefined`. Passing `undefined` explicitly (e.g.
  `{ sessionIdGenerator: undefined }`) then fails to type-check. Avoid this flag unless the
  entire dependency graph explicitly supports it.
- Prefer `module`/`moduleResolution: "NodeNext"` over the legacy `"Node16"` alias for new
  TypeScript projects (TypeScript 6.x).

## Tooling

- `@biomejs/biome` v2.x generates `biome.json` via `pnpm exec biome init` (or `npx @biomejs/biome init`)
  — prefer generating it with the actual installed version rather than hand-writing the
  schema, since the v2 config shape (`vcs`, `assist`, `files.includes` with `!!` force-ignore
  patterns) changed significantly from v1.
- Use the `!!` force-ignore glob prefix in `files.includes` for build/output directories
  (e.g. `"!!**/build"`) so Biome's scanner never indexes generated code.
- pnpm blocks dependency postinstall/build scripts by default (supply-chain protection).
  After `pnpm install`, if you see `[ERR_PNPM_IGNORED_BUILDS]`, run `pnpm approve-builds`
  (interactive) and approve only the packages you recognize/need (e.g. `esbuild`, needed by
  `vitest`/`tsx`).
- `pnpm approve-builds` is interactive (space to select, `a` for all, then y/N to confirm) —
  when running through an automated terminal, it must be driven step-by-step, not piped.

## Workflow

- This user always wants: LESSONS.md read first, no unrequested features, deep official-docs
  research before scaffolding, latest verified tool/library versions (checked via `npm view`,
  not assumed), an explicit interview via the questions tool before writing code, a defined
  Definition of Done, and a detailed final report.
- `vscode_askQuestions` messages have a hard 200-character limit; if an explanation is longer,
  ask a short question first and use a follow-up question to give the detailed option
  breakdown once the user asks for it.

## Regione Calabria open data portal (dati.regione.calabria.it)

- It's a CKAN 2.9.5 instance (with the `dcatapit_*` extensions for the Italian DCAT-AP_IT
  metadata profile) reachable at `https://dati.regione.calabria.it/opendata/api/3/action/`.
  The public "Sviluppatori" page (`/624-2/`) documents this base URL and gives working example
  calls for `package_list` and `package_show`.
- CKAN dataset dicts from this portal are irregular: several DCAT-AP_IT fields (`theme`,
  `creator`, `conforms_to`, `alternate_identifier`, ...) are stringified JSON arrays/objects
  rather than native JSON, and the field set can differ between datasets. Prefer a loose/
  passthrough zod schema (`z.record(z.string(), z.unknown())`) over a strict per-field schema
  for `package_show`/`package_search` results.
- CKAN Action API responses always have the shape
  `{ success: boolean, result?: T, error?: { message, __type }, help }`; check `success`
  (not just HTTP status) before trusting `result`, since CKAN can return HTTP 200 with
  `success: false` for some error classes.
- The DataStore extension (`datastore_search`, `datastore_search_sql`) is **enabled** on this
  portal — verified live: many resources have `datastore_active: true` in `package_show`, and
  both `GET .../datastore_search?resource_id=...` and `GET .../datastore_search_sql?sql=...`
  return real data (confirmed against resource id `41e4af40-acb2-4f64-8acd-ade356df03d8`, a
  "persone giuridiche" CSV). This lets tools query actual row-level data, not just dataset
  metadata. `_table_metadata` (via `datastore_search`) lists all DataStore-backed resources.
- CKAN Action API functions outside `ckan.logic.action.get` (e.g. `datastore_search`, which
  lives in `ckanext.datastore.logic.action`) are still GET-able the same way: simple params as
  plain query-string values, complex params (objects/arrays, e.g. `filters`, `fields`) as a
  JSON-stringified (or comma-separated, for `fields`) query-string value.
- `datastore_search_sql` requires the `ckan.datastore.sqlsearch.enabled` config option and CKAN
  validates the query is a single `SELECT` server-side; decided (with user) not to expose it as
  an MCP tool for now to avoid an unnecessary SQL-shaped surface, keeping only `datastore_search`
  (structured filters/full-text) for querying resource data.

## Zod v4 / testing notes

- Zod v4's `z.record()` requires two args, `z.record(keySchema, valueSchema)` (e.g.
  `z.record(z.string(), z.unknown())`); the old Zod v3 single-arg form
  (`z.record(valueSchema)`, implicit string keys) throws/misbehaves.
- Node 22's built-in global `fetch` + `AbortSignal.timeout(ms)` is sufficient for simple
  outbound HTTP calls in an MCP server; no need for `node-fetch`/`axios`/`undici` as a direct
  dependency.
- To unit-test code that calls global `fetch`, use `vi.stubGlobal("fetch", vi.fn())` in
  `beforeEach` and `vi.unstubAllGlobals()` in `afterEach`, resolving the mock with a real
  `new Response(JSON.stringify(body), { status, headers })` so `.json()`/`.ok` behave exactly
  like a real fetch response.
