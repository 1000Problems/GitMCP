import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { GitCheckoutInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";
import { execGit } from "../git-executor.js";

export function registerCheckoutTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_checkout",
    {
      title: "Git Checkout",
      description:
        "Switch branches or create and switch to a new branch.",
      inputSchema: GitCheckoutInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { repo_path, target, create } = params;
      validateRepoPath(repo_path, config.allowedPaths);

      const args: string[] = ["checkout"];

      if (create) {
        args.push("-b");
      }

      args.push(target);

      const result = await execGit(args, repo_path, config.timeout);

      const output =
        result.stderr.trim() || result.stdout.trim() || `Switched to '${target}'`;
      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}
