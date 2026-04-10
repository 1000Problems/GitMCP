# TASK: Add LightRAG Tools to GitMCP

> Add three MCP tools — `lightrag_query`, `lightrag_index`, `lightrag_status` — that proxy LightRAG API calls from the host machine, enabling Cowork to reach localhost:9621 through GitMCP instead of the unreachable sandbox.

## Context

Cowork runs in a sandboxed environment on Anthropic's servers. It cannot reach `localhost:9621` (LightRAG's Docker container on Angel's Mac). The current workaround — writing task files for Code to run via `runner.sh` — is slow, fills Cowork's context window with file reads, and requires a manual Code handoff for every query.

GitMCP already runs as a subprocess on Angel's machine, where `localhost:9621` is fully reachable. Adding three LightRAG proxy tools to GitMCP gives Cowork direct, synchronous access to the knowledge graph with no file protocol overhead.

## Requirements

1. Add a `--lightrag-url` CLI argument to `index.ts` (default: `http://localhost:9621`). Store it in `ServerConfig`.
2. Create `src/lightrag-client.ts` — a minimal HTTP client using Node's built-in `http`/`https` modules. No external dependencies.
3. Create `src/tools/lightrag-query.ts` — `lightrag_query` tool: sends a hybrid-mode query to LightRAG and returns the response text.
4. Create `src/tools/lightrag-index.ts` — `lightrag_index` tool: accepts an array of file paths, reads each from disk (using `fs.readFileSync`), and POSTs each as a document to LightRAG's `/documents/text` endpoint.
5. Create `src/tools/lightrag-status.ts` — `lightrag_status` tool: hits `/health` and returns container state, version, and pipeline busy status.
6. Register all three tools in `src/server.ts`.
7. Add Zod schemas for all three tools to `src/schemas/index.ts`.
8. `npm run build` passes with zero TypeScript errors.
9. `npm test` passes with no regressions.

## Implementation Notes

### New CLI Arg — `index.ts`

Add `--lightrag-url` parsing alongside the existing `--allowed-paths` logic. Default to `http://localhost:9621` if not provided. Pass it through to `ServerConfig`.

### ServerConfig change — `types.ts`

Add one optional field:
```typescript
lightragUrl?: string;  // default: "http://localhost:9621"
```

### LightRAG Client — `src/lightrag-client.ts`

Use Node's built-in `http` and `https` modules. No fetch polyfills, no axios. Pattern:

```typescript
export async function lightragPost(
  baseUrl: string,
  path: string,
  body: unknown
): Promise<unknown> {
  // use http.request / https.request based on baseUrl protocol
  // POST with Content-Type: application/json
  // parse response as JSON
  // throw with clear message on non-2xx or connection refused
}

export async function lightragGet(
  baseUrl: string,
  path: string
): Promise<unknown> {
  // same pattern, GET only
}
```

Handle `ECONNREFUSED` explicitly — return a clear error: `"LightRAG is not running at {url}. Start it with: cd ~/1000Problems/.lightrag && docker compose up -d"`

### lightrag_query — `src/tools/lightrag-query.ts`

```typescript
// Input schema:
{
  text: z.string().min(1).describe("The question or query to send to LightRAG"),
  mode: z.enum(["naive", "local", "global", "hybrid"]).default("hybrid")
    .describe("Search mode. hybrid is best for most queries.")
}

// API call:
POST {lightragUrl}/query
{
  "query": text,
  "mode": mode
}

// Return the response.response field as text content
```

Annotations: `readOnlyHint: true, destructiveHint: false, idempotentHint: false`

### lightrag_index — `src/tools/lightrag-index.ts`

```typescript
// Input schema:
{
  documents: z.array(z.object({
    path: z.string().describe("Absolute path to the file to index"),
    label: z.string().optional().describe("Human-readable label for this document")
  })).min(1).describe("List of documents to index into LightRAG")
}

// For each document:
// 1. validateRepoPath(doc.path, config.allowedPaths)  ← security check
// 2. fs.readFileSync(doc.path, "utf-8")
// 3. POST {lightragUrl}/documents/text
//    { "text": content, "description": doc.label ?? path.basename(doc.path) }
// 4. Collect results

// Return summary: "Indexed 5/5 documents. Failed: 0"
// On partial failure, list which files failed and why
```

Annotations: `readOnlyHint: false, destructiveHint: false, idempotentHint: true`

**Note:** Path validation via `validateRepoPath` is REQUIRED here since we're reading from disk. Import from `../security.js`.

### lightrag_status — `src/tools/lightrag-status.ts`

```typescript
// Input schema: {} (no inputs)

// API call:
GET {lightragUrl}/health

// Return key fields as formatted text:
// Status: {status}
// Version: {core_version} / {api_version}
// Pipeline busy: {pipeline_busy}
// LLM: {llm_model} via {llm_binding}
// Embeddings: {embedding_model} (dim inferred from config)
```

Annotations: `readOnlyHint: true, destructiveHint: false, idempotentHint: true`

### server.ts additions

Follow the exact pattern of existing tools:
```typescript
import { registerLightragQueryTool } from "./tools/lightrag-query.js";
import { registerLightragIndexTool } from "./tools/lightrag-index.js";
import { registerLightragStatusTool } from "./tools/lightrag-status.js";

// inside createServer():
registerLightragQueryTool(server, config);
registerLightragIndexTool(server, config);
registerLightragStatusTool(server, config);
```

### Version bump

Bump `server.ts` version string from `"0.3.0"` to `"0.4.0"`.

## Do Not Change

- `src/security.ts` — path validation logic is security-critical, do not touch
- `src/git-executor.ts` — git execution wrapper, do not touch
- All existing `src/tools/*.ts` files (status, diff, log, add, commit, push, pull, branch, checkout, clone, stash, remote, init, show, fs-read, fs-write, fs-list, fs-stat) — leave untouched
- Existing CLI args in `index.ts` (`--allowed-paths`, `--default-branch`, `--timeout`) — add `--lightrag-url` only, do not refactor the existing parsing
- `src/schemas/index.ts` — ADD new schemas at the bottom only, do not modify existing schemas

## Acceptance Criteria

- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm test` passes with no regressions on existing tools
- [ ] `node dist/index.js --help` shows `--lightrag-url` in the usage output
- [ ] `lightrag_status` tool returns healthy status when LightRAG is running at localhost:9621
- [ ] `lightrag_query` tool returns a coherent answer for "What projects use SwiftUI?"
- [ ] `lightrag_index` tool successfully indexes a test document and the doc appears in LightRAG's web UI
- [ ] `lightrag_index` rejects paths outside `--allowed-paths` with a clear error
- [ ] `lightrag_query` and `lightrag_status` return clear "LightRAG not running" error when port 9621 is unreachable
- [ ] `git diff` shows changes ONLY in: `src/tools/lightrag-*.ts`, `src/lightrag-client.ts`, `src/schemas/index.ts`, `src/server.ts`, `src/types.ts`, `src/index.ts`

## Verification

1. `npm run build` — must compile clean
2. `npm test` — all existing tests must still pass
3. `git diff --name-only` — confirm only the 6 files listed above are changed
4. With LightRAG running, test all three tools manually via Claude Desktop:
   - `lightrag_status` → should show healthy, v1.4.14
   - `lightrag_query` with text "What is Angel's development workflow?" → should describe Cowork/Code split
   - `lightrag_index` with `[{"path": "/Users/angel/1000Problems/GitMCP/CLAUDE.md", "label": "test"}]` → should succeed
5. Shut down LightRAG (`docker compose stop`), retest `lightrag_status` — must return the "not running" error, not crash
