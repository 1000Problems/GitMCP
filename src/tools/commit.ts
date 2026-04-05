import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { GitCommitInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";
import { execGit } from "../git-executor.js";

export function registerCommitTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_commit",
    {
      title: "Git Commit",
      description:
        "Create a commit with a message. Optionally override the author.",
      inputSchema: GitCommitInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { repo_path, message, author } = params;
      validateRepoPath(repo_path, config.allowedPaths);

      const args: string[] = ["commit", "-m", message];

      if (author) {
        args.push(`--author=${author}`);
      }

      const result = await execGit(args, repo_path, config.timeout);

      return {
        content: [
          { type: "text" as const, text: result.stdout.trim() },
        ],
      };
    }
  );
}
