import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { GitStashInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";
import { execGit } from "../git-executor.js";

export function registerStashTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_stash",
    {
      title: "Git Stash",
      description:
        "Stash or restore working directory changes. Supports push, pop, list, and drop.",
      inputSchema: GitStashInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { repo_path, action, message, index } = params;
      validateRepoPath(repo_path, config.allowedPaths);

      let args: string[];

      switch (action) {
        case "push":
          args = ["stash", "push"];
          if (message) {
            args.push("-m", message);
          }
          break;
        case "pop":
          args = ["stash", "pop", `stash@{${index}}`];
          break;
        case "list":
          args = ["stash", "list"];
          break;
        case "drop":
          args = ["stash", "drop", `stash@{${index}}`];
          break;
      }

      const result = await execGit(args, repo_path, config.timeout);

      const output =
        result.stdout.trim() || result.stderr.trim() || `Stash ${action} complete.`;
      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}
