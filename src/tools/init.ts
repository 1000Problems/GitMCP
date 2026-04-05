import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { GitInitInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";
import { execGit } from "../git-executor.js";

export function registerInitTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_init",
    {
      title: "Git Init",
      description:
        "Initialize a new git repository at the specified path.",
      inputSchema: GitInitInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { repo_path, initial_branch } = params;
      validateRepoPath(repo_path, config.allowedPaths);

      const branch = initial_branch ?? config.defaultBranch;
      const args: string[] = [
        "init",
        `--initial-branch=${branch}`,
        repo_path,
      ];

      const result = await execGit(args, repo_path, config.timeout);

      const output =
        result.stdout.trim() ||
        result.stderr.trim() ||
        `Initialized repository at ${repo_path}`;
      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}
