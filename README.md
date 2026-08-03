# GitMCP

A local [MCP](https://modelcontextprotocol.io) server that gives Claude native git access. It runs as a stdio subprocess of Claude Desktop or Claude Code, wraps the `git` CLI in a set of MCP tools, and inherits your existing git authentication (SSH keys, credential helpers) with zero additional credential management.

**Why?** Claude's sandboxed environments can't execute git operations directly against mounted directories. GitMCP runs natively on your machine: Claude calls a tool, the server runs the real `git` command in a directory you've explicitly allowed, and returns structured results.

---

## Features

- **18 tools** — 14 git operations plus 4 scoped filesystem helpers.
- **Path-scoped by design.** Every path is validated against `--allowed-paths` and resolved through `fs.realpathSync` before any command runs. Symlink escapes, `..` traversal, and null bytes are rejected.
- **No shell, ever.** Git runs via `child_process.execFile("git", [...])` — arguments are passed as an array, never concatenated into a shell string, so command injection isn't possible.
- **Safe by default.** No `--force` push, no `-D` branch delete, no `reset --hard`, no arbitrary command execution. These are intentionally excluded.
- **Minimal footprint.** Two runtime dependencies (`@modelcontextprotocol/sdk`, `zod`); everything else is Node built-ins.

---

## Requirements

- Node.js ≥ 18
- `git` installed and available on `PATH`

---

## Install & Build

```bash
git clone https://github.com/1000Problems/GitMCP.git
cd GitMCP
npm install
npm run build

# Verify
node dist/index.js --help
```

`dist/index.js` is the entry point you point your MCP client at.

---

## Configuration

GitMCP is launched by your MCP client with `--allowed-paths` naming the directories it may operate in. Use **absolute** paths.

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "git": {
      "command": "node",
      "args": [
        "/path/to/GitMCP/dist/index.js",
        "--allowed-paths",
        "/Users/you/projects"
      ]
    }
  }
}
```

### Claude Code (`.mcp.json` in your project root)

```json
{
  "mcpServers": {
    "git": {
      "command": "node",
      "args": [
        "/path/to/GitMCP/dist/index.js",
        "--allowed-paths",
        "/Users/you/projects"
      ]
    }
  }
}
```

### CLI Arguments

| Argument           | Required | Default   | Description                                                             |
| ------------------ | -------- | --------- | ----------------------------------------------------------------------- |
| `--allowed-paths`  | **Yes**  | —         | Comma-separated list of absolute directory paths the server may act in. |
| `--default-branch` | No       | `main`    | Default branch name for newly initialized repos.                        |
| `--timeout`        | No       | `30000`   | Timeout (ms) for each git command.                                      |
| `--help`, `-h`     | No       | —         | Print usage and exit.                                                    |

Multiple roots are comma-separated: `--allowed-paths /path/one,/path/two`. The server exits with an error if no allowed path is given.

---

## Tools

All git tools are prefixed with `git_`; filesystem helpers with `fs_`. Every tool takes an absolute path that must resolve inside an allowed root.

### Git tools

| Tool           | Description                                                                    |
| -------------- | ------------------------------------------------------------------------------ |
| `git_status`   | Working tree status (branch, staged/unstaged/untracked, ahead/behind).         |
| `git_diff`     | Changes in the working tree or between refs; optional `staged` / `file_path`.  |
| `git_log`      | Commit history with filters for count, ref, author, and file.                  |
| `git_show`     | Contents of a commit, tag, or a file at a specific revision.                    |
| `git_add`      | Stage files (or `all`) for commit.                                             |
| `git_commit`   | Create a commit with a message; optional author override.                      |
| `git_branch`   | List, create, or safely delete (`-d`) branches.                                |
| `git_checkout` | Switch branches or restore files; optional `create` (`-b`).                    |
| `git_push`     | Push commits to a remote; optional `set_upstream`. **No force push.**          |
| `git_pull`     | Pull from a remote; optional `rebase`.                                         |
| `git_clone`    | Clone a repo into an allowed target path; optional `branch` / `depth`.         |
| `git_remote`   | List, add, or remove remotes.                                                  |
| `git_stash`    | `push` / `pop` / `list` / `drop` working-directory changes.                    |
| `git_init`     | Initialize a new repository; optional `initial_branch`.                        |

See [`SPEC.md`](./SPEC.md) for the full input/output schema and git commands behind each tool.

### Filesystem tools

These helpers operate under the same path validation as the git tools:

| Tool        | Description                                                                        |
| ----------- | ---------------------------------------------------------------------------------- |
| `fs_read`   | Read a file's contents (utf-8 or base64 for binary).                               |
| `fs_write`  | Create or overwrite a file (utf-8 or base64 content).                              |
| `fs_list`   | List a directory's contents; supports recursive listing with depth control.        |
| `fs_stat`   | Check whether a path exists and return metadata (type, size, modified date).       |

---

## Security Model

Security is the top priority — this server executes commands on your machine.

- **Path validation.** A requested path must equal, or be a subdirectory of, at least one `--allowed-paths` root after resolving symlinks and relative segments with `fs.realpathSync(path.resolve(...))`. Anything outside is rejected, as are `..` segments and null bytes.
- **No shell interpolation.** All git invocations use `execFile("git", args)` — never `exec`/`execSync`. Arguments are array elements; the binary is always literally `git`.
- **No destructive escapes.** Force push, force branch delete, `reset --hard`, and `checkout .` are deliberately unsupported. There is no generic command-execution tool.
- **stdout is sacred.** stdout is the MCP transport channel. All logging goes to stderr via `console.error`.

Full details are in [`SPEC.md`](./SPEC.md#security-model) and the project handoff notes in [`CLAUDE.md`](./CLAUDE.md).

---

## Development

```bash
npm run build        # Compile TypeScript (strict mode) to dist/
npm test             # Run all tests
npm run test:unit    # Unit tests (security/path validation)
npm run test:int     # Integration tests (against a real temp repo)
```

The codebase is strict TypeScript with Zod input validation on every tool. Path validation lives in `src/security.ts` and the single git entry point is `src/git-executor.ts` — both are security-critical and protected.

---

## License

MIT
