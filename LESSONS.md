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
