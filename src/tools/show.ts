import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { GitShowInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";
import { execGit } from "../git-executor.js";

export function registerShowTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_show",
    {
      title: "Git Show",
      description:
        "Show the contents of a commit, tag, or file at a specific revision.",
      inputSchema: GitShowInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { repo_path, ref, file_path } = params;
      validateRepoPath(repo_path, config.allowedPaths);

      const target = file_path ? `${ref}:${file_path}` : ref;
      const result = await execGit(
        ["show", target],
        repo_path,
        config.timeout
      );

      return {
        content: [{ type: "text" as const, text: result.stdout }],
      };
    }
  );
}
