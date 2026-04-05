import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { GitPullInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";
import { execGit } from "../git-executor.js";

export function registerPullTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_pull",
    {
      title: "Git Pull",
      description:
        "Pull changes from a remote repository. Supports merge or rebase mode.",
      inputSchema: GitPullInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      const { repo_path, remote, branch, rebase } = params;
      validateRepoPath(repo_path, config.allowedPaths);

      const args: string[] = ["pull"];

      if (rebase) {
        args.push("--rebase");
      }

      args.push(remote);

      if (branch) {
        args.push(branch);
      }

      const result = await execGit(args, repo_path, config.timeout);

      const output =
        result.stdout.trim() || result.stderr.trim() || "Pull complete.";
      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}
