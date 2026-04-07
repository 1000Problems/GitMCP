# GitMCP — Claude Code Agent Handoff

You are building **GitMCP**, a local MCP server that gives Claude native git access. Read `SPEC.md` in this directory before writing any code — it is the authoritative design document.

## Before Implementing Any TASK

1. **Read the full TASK spec** — understand scope, acceptance criteria, and the Do Not Change section.
2. **Query LightRAG** for cross-project context before touching shared patterns:
   ```bash
   curl -X POST http://localhost:9621/query \
     -H "Content-Type: application/json" \
     -d '{"query": "architectural context for [feature being implemented]", "mode": "hybrid"}'
   ```
3. **Stay in scope.** Only modify files and components explicitly listed in the TASK spec. If you discover something that needs changing outside the spec, create a new VybePM task — do NOT fix it inline.
4. **Verify before committing.** Run `npm run build && npm test`, confirm zero errors, and check that nothing outside the TASK scope changed with `git diff`.

### Protected Areas (global — TASK specs may add more)

These components are stable and must NOT be modified unless the TASK spec explicitly names them:

- `src/security.ts` — path validation and sanitization. Security-critical, heavily tested.
- `src/git-executor.ts` — safe execFile wrapper. The single point of git CLI access.
- `src/index.ts` — CLI arg parsing and stdio transport setup.
- All existing tool files in `src/tools/` — modify only the tool named in the TASK spec, leave others untouched.

## Step 0: Repository Setup (Do This First)

Before writing any code, set up the git repository and push to GitHub:

1. **Initialize git in this directory:**
   ```bash
   git init
   git branch -M main
   ```

2. **Create the GitHub repo under the 1000Problems org:**
   ```bash
   gh repo create 1000Problems/GitMCP --public --description "Local MCP server giving Claude native git access — wraps git CLI in MCP tools via stdio transport" --source . --remote origin
   ```

3. **Create a .gitignore:**
   ```
   node_modules/
   dist/
   *.js.map
   .env
   .env.*
   .DS_Store
   ```

4. **Make the initial commit with the existing files (SPEC.md, CLAUDE.md, .gitignore):**
   ```bash
   git add SPEC.md CLAUDE.md .gitignore
   git commit -m "Initial commit: spec and handoff docs for GitMCP"
   ```

5. **Push to GitHub:**
   ```bash
   git push -u origin main
   ```

6. **Verify the repo exists:** `gh repo view 1000Problems/GitMCP`

Only after this is confirmed, proceed to building the MCP server.

## What This Is

A Node.js/TypeScript MCP server that wraps the git CLI in MCP tools. It runs as a stdio subprocess of Claude Desktop or Claude Code on the user's machine. The user's existing git auth (SSH keys, credential helpers) is inherited automatically.

## Non-Negotiable Rules

### Security — These Are Hard Requirements

1. **NEVER use `child_process.exec` or `child_process.execSync`.** Always use `child_process.execFile` with arguments as an array. This prevents command injection. No exceptions.

2. **Every tool that accepts a path MUST validate it** against the `--allowed-paths` CLI argument before executing anything. Use `fs.realpathSync(path.resolve(...))` to resolve symlinks and relative segments, then confirm the resolved path starts with an allowed root. See `SPEC.md` Security Model section.

3. **No force operations.** No `--force` push, no `-D` branch delete, no `checkout .`, no `reset --hard`. These are intentionally excluded from the spec. If you think you need one, you don't — revisit the design.

4. **No arbitrary command execution.** This server runs `git` and only `git`. There is no generic exec/run tool.

5. **No secrets in code.** No API keys, tokens, or credentials hardcoded anywhere. The server inherits auth from the host OS.

6. **Stderr is your log channel.** The server communicates with the MCP client over stdout. All logging, warnings, and debug output go to `console.error` (stderr). Never write non-MCP content to stdout.

### Code Quality

1. **Strict TypeScript.** `strict: true` in tsconfig.json. No `any` types — use `unknown` and type guards.

2. **Zod for all input validation.** Every tool's input schema uses Zod with `.strict()` to reject unknown fields. Include `.describe()` on every field.

3. **One file per tool.** Each tool lives in `src/tools/<name>.ts`. Tools export a registration function that takes the McpServer instance and config.

4. **DRY.** The git execution logic lives in `src/git-executor.ts`. Every tool calls through it. Path validation lives in `src/security.ts`. No inline security checks scattered across tools.

5. **Test everything security-critical.** Path validation, argument sanitization, and command construction MUST have unit tests. Integration tests should run against a real temporary git repo created in test setup.

## Tech Stack

- Node.js ≥ 18
- TypeScript with strict mode
- `@modelcontextprotocol/sdk` (latest) — use `McpServer` and `registerTool`, NOT deprecated `server.tool()` API
- `zod` for input validation
- **No other runtime dependencies.** No axios, no node-fetch, no external git libraries. Use `child_process.execFile` from Node built-ins.

## Project Structure

```
git-mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # CLI arg parsing, server instantiation, stdio transport
│   ├── server.ts             # McpServer setup, imports and registers all tools
│   ├── types.ts              # Shared TypeScript interfaces
│   ├── constants.ts          # Defaults, limits
│   ├── security.ts           # isPathAllowed(), validateRepoPath(), sanitization
│   ├── git-executor.ts       # execGit() — safe wrapper around execFile("git", ...)
│   ├── tools/
│   │   ├── status.ts
│   │   ├── diff.ts
│   │   ├── log.ts
│   │   ├── add.ts
│   │   ├── commit.ts
│   │   ├── push.ts
│   │   ├── pull.ts
│   │   ├── branch.ts
│   │   ├── checkout.ts
│   │   ├── clone.ts
│   │   ├── stash.ts
│   │   ├── remote.ts
│   │   ├── init.ts
│   │   └── show.ts
│   └── schemas/
│       └── index.ts          # All Zod schemas
└── dist/
```

## Build and Verify

```bash
npm install
npm run build          # Must compile with zero errors
node dist/index.js --help   # Should print usage info
npm test               # All tests must pass
```

## Tool Registration Pattern

Use the modern `registerTool` API:

```typescript
server.registerTool(
  "git_status",
  {
    title: "Git Status",
    description: "Get working tree status of a repository...",
    inputSchema: GitStatusInputSchema,  // Zod schema
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params) => {
    // 1. Validate path
    // 2. Execute git command via git-executor
    // 3. Parse output
    // 4. Return structured result
  }
);
```

## Git Executor Pattern

All git commands go through a single function:

```typescript
// src/git-executor.ts
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function execGit(
  args: string[],
  cwd: string,
  timeout?: number
): Promise<{ stdout: string; stderr: string }> {
  // Validate cwd is an allowed path (or caller already validated)
  // Execute: execFile("git", args, { cwd, timeout })
  // Return stdout/stderr
  // On error: throw with actionable message
}
```

## Priority Order

Build in this order:

1. **Core infra first:** index.ts, security.ts, git-executor.ts, types.ts, constants.ts
2. **Read-only tools:** git_status, git_log, git_diff, git_show (safe to test, prove the pattern works)
3. **Write tools:** git_add, git_commit, git_branch, git_checkout
4. **Network tools:** git_push, git_pull, git_clone, git_remote
5. **Utility tools:** git_stash, git_init
6. **Tests:** Unit tests for security, integration tests for each tool
7. **README.md:** Installation and configuration docs

## What NOT To Do

- Don't add features not in SPEC.md without asking
- Don't use deprecated MCP SDK APIs (`server.tool()`, `setRequestHandler`)
- Don't add HTTP transport — this is stdio only for v1
- Don't add file read/write tools — Claude already has those
- Don't use `exec()` — use `execFile()` (this matters for security)
- Don't skip the path validation on any tool, even read-only ones
- Don't swallow errors — always return actionable error messages
