import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { GitStatusInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";
import { execGit } from "../git-executor.js";

export function registerStatusTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_status",
    {
      title: "Git Status",
      description:
        "Get the working tree status of a repository including branch, staged files, unstaged changes, and untracked files.",
      inputSchema: GitStatusInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { repo_path } = params;
      validateRepoPath(repo_path, config.allowedPaths);

      const result = await execGit(
        ["status", "--porcelain=v2", "--branch"],
        repo_path,
        config.timeout
      );

      const lines = result.stdout.split("\n").filter((l) => l.length > 0);
      let branch = "";
      let upstream = "";
      let ahead = 0;
      let behind = 0;
      const staged: string[] = [];
      const modified: string[] = [];
      const untracked: string[] = [];

      for (const line of lines) {
        if (line.startsWith("# branch.head ")) {
          branch = line.slice("# branch.head ".length);
        } else if (line.startsWith("# branch.upstream ")) {
          upstream = line.slice("# branch.upstream ".length);
        } else if (line.startsWith("# branch.ab ")) {
          const match = line.match(
            /# branch\.ab \+(\d+) -(\d+)/
          );
          if (match) {
            ahead = parseInt(match[1], 10);
            behind = parseInt(match[2], 10);
          }
        } else if (line.startsWith("1 ") || line.startsWith("2 ")) {
          const parts = line.split(" ");
          const xy = parts[1];
          // For renamed entries (type 2), the path is after a tab
          const pathPart =
            line.startsWith("2 ")
              ? line.split("\t").slice(1).join("\t")
              : parts.slice(8).join(" ");

          if (xy[0] !== ".") {
            staged.push(pathPart);
          }
          if (xy[1] !== ".") {
            modified.push(pathPart);
          }
        } else if (line.startsWith("? ")) {
          untracked.push(line.slice(2));
        }
      }

      const summary = [
        `Branch: ${branch}`,
        upstream ? `Upstream: ${upstream}` : null,
        ahead || behind
          ? `Ahead: ${ahead}, Behind: ${behind}`
          : null,
        staged.length
          ? `Staged (${staged.length}):\n  ${staged.join("\n  ")}`
          : "No staged changes",
        modified.length
          ? `Modified (${modified.length}):\n  ${modified.join("\n  ")}`
          : "No unstaged changes",
        untracked.length
          ? `Untracked (${untracked.length}):\n  ${untracked.join("\n  ")}`
          : "No untracked files",
      ]
        .filter(Boolean)
        .join("\n");

      return {
        content: [{ type: "text" as const, text: summary }],
      };
    }
  );
}
