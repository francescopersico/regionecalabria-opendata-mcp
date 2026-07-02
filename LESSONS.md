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
- This portal has only **one** CKAN organization (`regione-calabria`) — verified live via
  `organization_list`. `organization_list?all_fields=true` currently returns an HTTP 500 on this
  portal (works fine on other CKAN instances/on `group_list`). Conclusion: don't add
  `organization_list`/`organization_show` tools here, they'd add zero browsing value.
- In contrast, this portal has 17 well-populated CKAN "groups" used as thematic categories
  ("temi": Agricoltura, Ambiente, Cultura, Economia, ecc.), each with meaningful `package_count`
  (verified live via `group_list?all_fields=true`) — this is the real, useful categorization axis
  on this portal. Added `group_list` (list themes + counts) and `group_show` (one theme's details
  + a lightweight `{id, name, title}` list of its datasets) tools for this reason.
- `group_show?include_datasets=true` returns full, deeply-nested dataset dictionaries per package
  (redundant with `package_show`) plus the group's member/user list by default. Always reshape the
  response rather than passing it through raw, and pass `include_users=false`,
  `include_followers=false`, `include_extras=false`, `include_groups=false` explicitly to avoid
  fetching/exposing account data the tool doesn't need (data minimization).
- Before adding any new "browse by X" tool to a CKAN-backed MCP server, query the live portal's
  `X_list?all_fields=true` action first to check it's actually populated/meaningful for that
  specific instance — CKAN's generic API surface (organizations, groups, tags, licenses) is not
  equally useful on every deployment.

## Standalone HTML reports (reports/ folder)

- Pattern established by `reports/incidenti-stradali-dashboard.html` and followed for
  `reports/alberi-monumentali-dashboard.html`: a single self-contained HTML file, zero
  build step, libraries loaded from `cdn.jsdelivr.net` pinned to an exact version (checked
  via `npm view <pkg> version` before writing the `<script>`/`<link>` tag, even though the
  report itself has no npm dependency), and the dataset embedded as a static JS/JSON
  snapshot directly in the file (works offline, avoids CORS/live-availability concerns for
  a point-in-time report). Reuses the same visual language: light theme, card style
  (`border-radius:14px`, subtle box-shadow), `-apple-system/Segoe UI` font stack, accent
  `#3457d5`, muted text `#58607a`.
- For a map + table report over the same dataset (e.g. "alberi monumentali"): Leaflet
  1.9.4 + OpenStreetMap standard tiles (no API key) + Leaflet.markercluster 1.5.3 is a
  good default when the user has no strong preference — confirmed via the interview
  process, all defaults were accepted. Link the two views: clicking a table row calls
  `markerClusterGroup.zoomToShowLayer()` + opens the marker popup + scrolls/highlights the
  row; filtering (search/select) re-renders the table AND calls
  `clusterGroup.clearLayers()` + `addLayers()` with only the filtered markers.
- Dataset "Alberi monumentali" on the Regione Calabria portal: package name
  `alberi-monumentali` (id `90c1ea0f-e896-4f39-aca8-e1abd4e05697`), single CSV resource
  "Alberi monumentali.csv" (id `84de64fb-0d61-4c17-bb00-5f00840dba3b`), `datastore_active:
  true`, 119 records. Coordinates are duplicated in two forms: `Lat`/`Long` as
  degrees-minutes-seconds text, and `lat2`/`long2` as decimal strings using an
  **Italian comma decimal separator** (e.g. `"39,07335278"`) — always
  `parseFloat(str.replace(",", "."))` before using them as numbers/coordinates; prefer
  `lat2`/`long2` over parsing the DMS strings.
- Known data-quality quirks in that CSV worth normalizing at render time (not worth fixing
  at the source): the `CRITERI DI MONUMENTALITA` and `CONTESTO URBANO` columns contain a
  mojibake artifact `eta`` ` in place of `età` (encoding issue in the original file,
  cosmetic replace with `.replace(/eta\`/g, "età")` is safe); `CONTESTO URBANO` values are
  inconsistently `"no"`, `"sì"`, or `` "si`" `` (same mojibake) — normalize by testing
  `/^s/i` on the trimmed value rather than exact string match. Also two near-duplicate
  species labels exist verbatim in the data ("Eucalipto rostrato" vs "Eucalitto rostrato")
  — a genuine upstream typo, left as-is rather than silently merged, since altering
  published values without flagging it would misrepresent the source.
- CKAN dataset page URLs on this portal follow the standard CKAN pattern
  `https://dati.regione.calabria.it/opendata/dataset/<package-name>` even though the
  `package_show` result's own `url` field is empty and its resource `url` values point at
  an internal-only host (`http://10.2.174.5:5000/...`) — link to the public dataset page
  by pattern, never to the internal resource URL.

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

## Publishing to npm for `npx` usage (2026-07)

- To make a server runnable as `npx <name>`, it must be a published npm package (unscoped, and
  `private: true` removed from `package.json`) — `npx github:user/repo` also works without
  publishing, but is slower and doesn't get clean version pinning; the user chose the registry
  route here.
- `regionecalabria-opendata-mcp` was free/unavailable-check via `npm view <name>` returning 404
  (confirmed 2026-07-02) — always check name availability with `npm view`, not assumption.
- npm **trusted publishing** (OIDC, no long-lived `NPM_TOKEN`) requires npm CLI `>=11.5.1` and
  Node `>=22.14.0`; add an explicit `npm install -g npm@latest` step in CI since the bundled npm
  on a given `actions/setup-node` Node version can be older than that.
- Trusted publisher config lives on the *existing* npm package's Settings page on npmjs.com —
  you cannot configure it before the package exists. **First publish must be manual**
  (`npm login` + `npm publish --access public`, needs 2FA or a bypass-2FA granular token); only
  subsequent releases can go through the trusted-publishing GitHub Actions workflow.
- `package.json`'s `repository.url` must exactly (case-sensitive) match the GitHub repo the
  trusted-publishing workflow runs from, or the OIDC exchange fails at publish time (fails
  silently until you actually try — npm does not validate the config when you save it).
- Provenance attestations are generated automatically for trusted-publishing releases from a
  public repo/package — no `--provenance` flag needed, and it's *not* available for private
  repos even if the package itself is public.
- After confirming trusted publishing works, npm recommends locking the package's "Publishing
  access" to "Require two-factor authentication and disallow tokens" to fully retire
  token-based publish access.
- `npm pack --dry-run` is a safe, no-auth way to double check the exact tarball contents (files,
  size) before ever running a real `npm publish`.
- Don't push the very first release's `vX.Y.Z` tag before the manual first publish + trusted
  publisher setup are done: the tag-triggered workflow would fire immediately and fail
  (`ENEEDAUTH`) since OIDC trusted publishing isn't authorized yet for a package that doesn't
  exist. Once the package exists and trusted publishing is configured, it's still fine (and
  good practice) to tag that first version retroactively for git history — just make the
  workflow tolerant of "version already published" (check `npm view <name>@<version>` and skip
  instead of failing) so a re-triggered run on an already-published tag doesn't show as a
  failed Action.

