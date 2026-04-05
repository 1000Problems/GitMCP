# GitMCP — Design Specification

## Overview

GitMCP is a local MCP (Model Context Protocol) server that gives Claude native git access by running as a subprocess on the user's machine. It wraps the git CLI in MCP tools, inheriting the user's existing git authentication (SSH keys, credential helpers) with zero additional credential management.

**Problem:** Claude's sandboxed environments cannot execute git operations due to filesystem permission restrictions on mounted directories. This blocks commits, pushes, branch management, and all write-path git workflows.

**Solution:** A lightweight Node.js MCP server that runs natively on the host machine via stdio transport. Claude calls MCP tools; the server executes real git commands and returns results.

---

## Architecture

### Transport

**stdio** — the server runs as a subprocess of Claude Desktop (or Claude Code). No network, no ports, no daemon. Starts when the client launches, stops when it closes. This is the standard pattern for local MCP servers.

### Runtime

- **Node.js ≥ 18** with TypeScript
- **MCP SDK**: `@modelcontextprotocol/sdk` (latest)
- **No external dependencies beyond the MCP SDK, Zod, and Node built-ins.** Git operations use `child_process.execFile` — no shell interpretation, no npm git libraries.

### Security Model

Security is the highest priority. This server executes shell commands on the user's machine.

#### Path Validation (CRITICAL)

Every tool that accepts a path argument MUST validate it against the configured `allowedPaths` before executing any command.

1. **Allowed paths** are passed as CLI arguments at startup: `--allowed-paths /Users/angel/1000Problems`
2. Multiple paths can be comma-separated: `--allowed-paths /path/one,/path/two`
3. The server resolves all paths to their real, absolute form (`path.resolve` + `fs.realpathSync`) before comparison
4. A requested path must be equal to or a subdirectory of at least one allowed path
5. **Symlink traversal**: resolve symlinks before checking — no escaping via symlinks
6. **Reject**: `..` segments, null bytes, paths outside allowed roots

```typescript
function isPathAllowed(requestedPath: string, allowedPaths: string[]): boolean {
  const resolved = fs.realpathSync(path.resolve(requestedPath));
  return allowedPaths.some(allowed => {
    const resolvedAllowed = fs.realpathSync(path.resolve(allowed));
    return resolved === resolvedAllowed || resolved.startsWith(resolvedAllowed + path.sep);
  });
}
```

#### Command Injection Prevention (CRITICAL)

- **NEVER use `child_process.exec` or `child_process.execSync`** — these invoke a shell and are vulnerable to injection
- **ALWAYS use `child_process.execFile`** — this executes the binary directly with an argument array, no shell interpolation
- All arguments are passed as array elements, never concatenated into a string
- The binary is always literally `"git"` — never user-supplied

```typescript
// CORRECT — safe
execFile("git", ["commit", "-m", userMessage], { cwd: repoPath });

// WRONG — vulnerable to injection
exec(`git commit -m "${userMessage}"`, { cwd: repoPath });
```

#### Additional Security Rules

- **No arbitrary command execution.** The server runs git and only git. There is no `run_command` or `exec` tool.
- **No file read/write tools.** The server does git operations. File I/O is handled by Claude's existing file tools.
- **Environment variables**: the server does not pass through or expose env vars to git commands beyond what git needs (PATH, HOME, GIT_SSH_COMMAND, etc.)
- **Stderr handling**: git writes progress/warnings to stderr. The server captures stderr but never writes it to stdout (which is the MCP transport channel). All logging goes to stderr via `console.error`.

---

## Configuration

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "git": {
      "command": "node",
      "args": [
        "/path/to/git-mcp-server/dist/index.js",
        "--allowed-paths",
        "/Users/angel/1000Problems"
      ]
    }
  }
}
```

### Claude Code (`.mcp.json` in project root)

```json
{
  "mcpServers": {
    "git": {
      "command": "node",
      "args": [
        "/path/to/git-mcp-server/dist/index.js",
        "--allowed-paths",
        "/Users/angel/1000Problems"
      ]
    }
  }
}
```

### CLI Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--allowed-paths` | Yes | Comma-separated list of absolute directory paths the server is allowed to operate in |
| `--default-branch` | No | Default branch name for new repos (default: `main`) |
| `--timeout` | No | Timeout in ms for git commands (default: `30000`) |

---

## Tools

All tool names are prefixed with `git_` to avoid conflicts with other MCP servers.

### git_status

Get the working tree status of a repository.

**Input:**
- `repo_path` (string, required): Absolute path to the git repository

**Output:** Structured status including branch name, staged files, unstaged changes, untracked files, ahead/behind counts.

**Git commands:** `git status --porcelain=v2 --branch`

**Annotations:** readOnlyHint: true, destructiveHint: false, idempotentHint: true

---

### git_diff

Show changes in the working tree or between commits.

**Input:**
- `repo_path` (string, required): Absolute path to the git repository
- `staged` (boolean, optional, default: false): Show staged changes (--cached)
- `file_path` (string, optional): Limit diff to specific file
- `ref1` (string, optional): First commit/ref for comparison
- `ref2` (string, optional): Second commit/ref for comparison

**Output:** Diff output as text.

**Git commands:** `git diff [--cached] [ref1 ref2] [-- file_path]`

**Annotations:** readOnlyHint: true, destructiveHint: false, idempotentHint: true

---

### git_log

Show commit history.

**Input:**
- `repo_path` (string, required): Absolute path to the git repository
- `max_count` (number, optional, default: 20): Maximum number of commits to return
- `oneline` (boolean, optional, default: false): Compact one-line format
- `ref` (string, optional): Branch or ref to show log for
- `file_path` (string, optional): Show history for specific file
- `author` (string, optional): Filter by author

**Output:** Commit history with hash, author, date, message.

**Git commands:** `git log --format=<format> [-n max_count] [--author=author] [ref] [-- file_path]`

**Annotations:** readOnlyHint: true, destructiveHint: false, idempotentHint: true

---

### git_add

Stage files for commit.

**Input:**
- `repo_path` (string, required): Absolute path to the git repository
- `files` (string[], required): List of file paths to stage (relative to repo root)
- `all` (boolean, optional, default: false): Stage all changes (--all)

**Output:** Confirmation of staged files.

**Git commands:** `git add <files...>` or `git add --all`

**Annotations:** readOnlyHint: false, destructiveHint: false, idempotentHint: true

**Validation:** If `all` is false, `files` must be non-empty. Each file path is validated to be within the repo.

---

### git_commit

Create a commit with a message.

**Input:**
- `repo_path` (string, required): Absolute path to the git repository
- `message` (string, required): Commit message
- `author` (string, optional): Override author (format: "Name <email>")

**Output:** Commit hash, branch, summary of changes.

**Git commands:** `git commit -m <message> [--author=<author>]`

**Annotations:** readOnlyHint: false, destructiveHint: false, idempotentHint: false

**Validation:** Message must be non-empty. Warns if nothing is staged.

---

### git_push

Push commits to remote.

**Input:**
- `repo_path` (string, required): Absolute path to the git repository
- `remote` (string, optional, default: "origin"): Remote name
- `branch` (string, optional): Branch to push (defaults to current branch)
- `set_upstream` (boolean, optional, default: false): Set upstream tracking (--set-upstream)

**Output:** Push result including remote URL, branch, and any new commits.

**Git commands:** `git push [--set-upstream] <remote> <branch>`

**Annotations:** readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true

**Security:** Force push (`--force`) is intentionally NOT supported. This is a safety decision.

---

### git_pull

Pull changes from remote.

**Input:**
- `repo_path` (string, required): Absolute path to the git repository
- `remote` (string, optional, default: "origin"): Remote name
- `branch` (string, optional): Branch to pull
- `rebase` (boolean, optional, default: false): Rebase instead of merge

**Output:** Pull result including merge/rebase status.

**Git commands:** `git pull [--rebase] <remote> <branch>`

**Annotations:** readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true

---

### git_branch

List, create, or delete branches.

**Input:**
- `repo_path` (string, required): Absolute path to the git repository
- `action` (enum: "list" | "create" | "delete", required): Branch operation
- `name` (string, optional): Branch name (required for create/delete)
- `start_point` (string, optional): Starting point for new branch

**Output:** Branch list, or confirmation of create/delete.

**Git commands:**
- list: `git branch -a --format=<format>`
- create: `git branch <name> [start_point]`
- delete: `git branch -d <name>` (safe delete only, no -D)

**Annotations:** readOnlyHint: false (varies by action), destructiveHint: false (safe delete only)

**Security:** Force delete (`-D`) is intentionally NOT supported. Use safe delete (`-d`) which refuses to delete unmerged branches.

---

### git_checkout

Switch branches or restore files.

**Input:**
- `repo_path` (string, required): Absolute path to the git repository
- `target` (string, required): Branch name, tag, or commit hash
- `create` (boolean, optional, default: false): Create new branch (-b)

**Output:** Confirmation of branch switch.

**Git commands:** `git checkout [-b] <target>`

**Annotations:** readOnlyHint: false, destructiveHint: false, idempotentHint: true

---

### git_clone

Clone a repository into a directory.

**Input:**
- `url` (string, required): Repository URL (HTTPS or SSH)
- `target_path` (string, required): Absolute path for the clone destination
- `branch` (string, optional): Specific branch to clone
- `depth` (number, optional): Shallow clone depth

**Output:** Clone result including path and default branch.

**Git commands:** `git clone [--branch <branch>] [--depth <depth>] <url> <target_path>`

**Annotations:** readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true

**Validation:** `target_path` must be within an allowed path AND must not already exist as a non-empty directory.

---

### git_stash

Stash or restore working directory changes.

**Input:**
- `repo_path` (string, required): Absolute path to the git repository
- `action` (enum: "push" | "pop" | "list" | "drop", required): Stash operation
- `message` (string, optional): Stash message (for push)
- `index` (number, optional, default: 0): Stash index (for pop/drop)

**Output:** Stash result or list.

**Git commands:**
- push: `git stash push [-m <message>]`
- pop: `git stash pop [stash@{index}]`
- list: `git stash list`
- drop: `git stash drop [stash@{index}]`

**Annotations:** readOnlyHint: false, destructiveHint: false (push/pop/list), idempotentHint: false

---

### git_remote

Manage remote repositories.

**Input:**
- `repo_path` (string, required): Absolute path to the git repository
- `action` (enum: "list" | "add" | "remove", required): Remote operation
- `name` (string, optional): Remote name (required for add/remove)
- `url` (string, optional): Remote URL (required for add)

**Output:** Remote list or confirmation.

**Git commands:**
- list: `git remote -v`
- add: `git remote add <name> <url>`
- remove: `git remote remove <name>`

**Annotations:** readOnlyHint: false (varies), destructiveHint: false

---

### git_init

Initialize a new git repository.

**Input:**
- `repo_path` (string, required): Absolute path for the new repository
- `initial_branch` (string, optional): Name for initial branch (defaults to server config)

**Output:** Confirmation of initialization.

**Git commands:** `git init [--initial-branch=<branch>] <repo_path>`

**Annotations:** readOnlyHint: false, destructiveHint: false, idempotentHint: true

**Validation:** Path must be within allowed paths.

---

### git_show

Show the contents of a commit, tag, or file at a specific revision.

**Input:**
- `repo_path` (string, required): Absolute path to the git repository
- `ref` (string, required): Commit hash, tag, or ref
- `file_path` (string, optional): Show specific file at that ref

**Output:** Commit details or file content.

**Git commands:** `git show <ref>[:<file_path>]`

**Annotations:** readOnlyHint: true, destructiveHint: false, idempotentHint: true

---

## Error Handling

All tools return structured error responses following MCP conventions:

```typescript
{
  isError: true,
  content: [{
    type: "text",
    text: "Error: <clear description>. <actionable suggestion>"
  }]
}
```

### Error Categories

| Category | Example | Response Pattern |
|----------|---------|-----------------|
| Path violation | Path outside allowed roots | "Error: Path '/etc/passwd' is outside allowed directories. Allowed: /Users/angel/1000Problems" |
| Not a repo | Path exists but no .git | "Error: '/Users/angel/1000Problems/docs' is not a git repository. Run git_init first or check the path." |
| Nothing staged | Commit with empty staging area | "Error: Nothing to commit. Stage files with git_add first." |
| Merge conflict | Pull results in conflicts | "Error: Merge conflict in 3 files: src/index.ts, src/utils.ts, README.md. Resolve conflicts and commit." |
| Auth failure | Push to remote fails auth | "Error: Authentication failed for 'git@github.com:1000Problems/repo.git'. Check SSH keys or credentials." |
| Command timeout | Operation exceeds timeout | "Error: Git command timed out after 30000ms. The operation may still be running." |
| Git not found | git binary not in PATH | "Error: git executable not found. Ensure git is installed and in PATH." |

---

## Project Structure

```
git-mcp-server/
├── package.json
├── tsconfig.json
├── README.md
├── CLAUDE.md
├── SPEC.md (this file)
├── src/
│   ├── index.ts              # Entry point: parse CLI args, create server, connect stdio
│   ├── server.ts             # McpServer setup and tool registration
│   ├── types.ts              # TypeScript interfaces and type definitions
│   ├── constants.ts          # Defaults, limits, error messages
│   ├── security.ts           # Path validation, argument sanitization
│   ├── git-executor.ts       # Safe child_process.execFile wrapper for git
│   ├── tools/
│   │   ├── status.ts         # git_status tool
│   │   ├── diff.ts           # git_diff tool
│   │   ├── log.ts            # git_log tool
│   │   ├── add.ts            # git_add tool
│   │   ├── commit.ts         # git_commit tool
│   │   ├── push.ts           # git_push tool
│   │   ├── pull.ts           # git_pull tool
│   │   ├── branch.ts         # git_branch tool
│   │   ├── checkout.ts       # git_checkout tool
│   │   ├── clone.ts          # git_clone tool
│   │   ├── stash.ts          # git_stash tool
│   │   ├── remote.ts         # git_remote tool
│   │   ├── init.ts           # git_init tool
│   │   └── show.ts           # git_show tool
│   └── schemas/
│       └── index.ts          # All Zod schemas for tool inputs
└── dist/                     # Compiled output (dist/index.js is the entry point)
```

---

## Testing Strategy

### Unit Tests

- Path validation logic (symlinks, traversal attacks, edge cases)
- Argument sanitization
- Git output parsing (porcelain formats)
- Error message formatting

### Integration Tests

- Each tool against a real temporary git repository (created in test setup, destroyed in teardown)
- Clone from a public repo
- Full workflow: init → add → commit → branch → checkout → merge → push

### Security Tests

- Path traversal attempts (`../../etc/passwd`)
- Null byte injection
- Symlink escape
- Command injection via commit messages, branch names, file paths
- Paths that look valid but resolve outside allowed roots

### How to Run Tests Locally

```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:int      # Integration tests only
```

---

## Build and Install

```bash
# Clone and build
git clone https://github.com/1000Problems/GitMCP.git
cd GitMCP
npm install
npm run build

# Verify
node dist/index.js --help

# Add to Claude Desktop config
# (see Configuration section above)
```

---

## Future Considerations

These are NOT in scope for v1 but worth noting:

- **git_merge**: Merge branches. Deferred due to conflict resolution complexity.
- **git_rebase**: Rebase operations. Deferred — interactive rebase doesn't work in this model.
- **git_tag**: Create and manage tags. Low priority, can add later.
- **git_blame**: Show line-by-line authorship. Useful for code review workflows.
- **Multi-repo operations**: A `git_sync_all` tool that pulls all repos in a directory. Specific to portfolio management.
- **GitHub API integration**: PR creation, issue management. Could be a separate MCP or extension of this one.

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 0.1.0 | 2026-04-05 | Initial spec — 13 tools, stdio transport, path-scoped security |
