import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { GitLogInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";
import { execGit } from "../git-executor.js";

export function registerLogTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_log",
    {
      title: "Git Log",
      description:
        "Show commit history with hash, author, date, and message. Supports filtering by author, ref, and file path.",
      inputSchema: GitLogInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { repo_path, max_count, oneline, ref, file_path, author } =
        params;
      validateRepoPath(repo_path, config.allowedPaths);

      const args: string[] = ["log"];

      if (oneline) {
        args.push("--oneline");
      } else {
        args.push("--format=%H%n%an%n%aI%n%s%n---");
      }

      args.push(`-n`, `${max_count}`);

      if (author) {
        args.push(`--author=${author}`);
      }

      if (ref) {
        args.push(ref);
      }

      if (file_path) {
        args.push("--", file_path);
      }

      const result = await execGit(args, repo_path, config.timeout);

      const output = result.stdout.trim() || "(no commits)";
      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}
