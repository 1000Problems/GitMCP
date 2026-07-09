# TASK: Remove LightRAG from GitMCP

> Delete the three LightRAG proxy tools, the HTTP client, their schemas, and the `--lightrag-url` CLI argument. LightRAG has been permanently decommissioned.

## Context

LightRAG (the knowledge-graph container that ran at localhost:9621) has been permanently shut down. GitMCP gained three proxy tools (`lightrag_query`, `lightrag_index`, `lightrag_status`) in a previous task (see `DONE-lightrag-tools.md`) so Cowork could reach it. With the service gone, these tools error on every call and must be removed entirely — code, schemas, CLI plumbing, and docs.

## Requirements

1. Delete these five files: `src/lightrag-client.ts`, `src/tools/lightrag-query.ts`, `src/tools/lightrag-index.ts`, `src/tools/lightrag-status.ts`, `DONE-lightrag-tools.md`.
2. In `src/server.ts`, remove the three `registerLightrag*Tool` imports (lines 21–23) and their registration calls (lines 49–51). All other tool registrations stay in their current order.
3. Remove the `--lightrag-url` CLI argument end to end: in `src/index.ts` delete the `lightragUrl` variable, its usage-text line, its `else if` parsing branch, and its entry in the returned config object; in `src/types.ts` delete `lightragUrl?: string` from `ServerConfig`.
4. In `src/schemas/index.ts`, delete the `LightragQueryInput`, `LightragIndexInput`, and `LightragStatusInput` exports (lines ~343–373). Touch nothing else in that file.
5. In `CLAUDE.md`, remove item 2 ("Query LightRAG for cross-project context…" including its curl block) from the "Before Implementing Any TASK" list and renumber the remaining items.

## Implementation Notes

- This is a pure deletion task. No new code, no refactoring, no renaming of surviving code.
- After removing the imports in `src/server.ts` and the schema exports, `npm run build` with strict mode will surface any dangling reference — fix only by deleting the reference, never by re-adding a stub.
- `package.json` needs no changes — the LightRAG client used Node built-in `http`/`https`, no external deps.
- `SPEC.md` and the test suites contain no LightRAG references; leave them alone.
- Unknown-argument behavior in `src/index.ts` must remain as-is, so a stale `--lightrag-url` flag in someone's Claude Desktop config degrades gracefully rather than crashing the server.

## Do Not Change

- `src/security.ts` — security-critical, globally protected
- `src/git-executor.ts` — single point of git CLI access, globally protected
- `src/index.ts` — only the four `lightragUrl`-related deletions listed in Requirement 3; do not refactor the arg-parsing loop or touch `--allowed-paths`, `--default-branch`, `--timeout`
- All other files in `src/tools/` (git_* and fs_* tools) — untouched
- `src/constants.ts`, `SPEC.md`, `package.json`, `tsconfig.json`, `vitest.config.ts` — untouched
- `tests/` — untouched (no LightRAG references exist there)

## Acceptance Criteria

- [ ] `npm run build` passes with zero errors
- [ ] `npm test` passes — all existing tests green
- [ ] `node dist/index.js --help` no longer mentions `--lightrag-url`
- [ ] `grep -ri lightrag src/ CLAUDE.md` returns nothing
- [ ] The server starts and registers only git_* and fs_* tools
- [ ] `git diff` + `git status` show changes ONLY in: the five deleted files, `src/server.ts`, `src/index.ts`, `src/types.ts`, `src/schemas/index.ts`, `CLAUDE.md`

## Verification

1. `npm run build` — zero errors
2. `npm test` — all pass
3. `grep -ri lightrag src/ CLAUDE.md` — empty output
4. `node dist/index.js --help` — usage shows `--allowed-paths`, `--default-branch`, `--timeout` only
5. `git status` — confirm no files outside the scope list are modified or deleted
