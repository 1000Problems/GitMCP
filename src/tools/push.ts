import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { GitPushInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";
import { execGit } from "../git-executor.js";

export function registerPushTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_push",
    {
      title: "Git Push",
      description:
        "Push commits to a remote repository. Force push is intentionally not supported.",
      inputSchema: GitPushInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      const { repo_path, remote, branch, set_upstream } = params;
      validateRepoPath(repo_path, config.allowedPaths);

      const args: string[] = ["push"];

      if (set_upstream) {
        args.push("--set-upstream");
      }

      args.push(remote);

      if (branch) {
        args.push(branch);
      }

      const result = await execGit(args, repo_path, config.timeout);

      // git push outputs to stderr on success
      const output =
        result.stderr.trim() || result.stdout.trim() || "Push complete.";
      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}
