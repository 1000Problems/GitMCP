import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { GitAddInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";
import { execGit } from "../git-executor.js";

export function registerAddTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_add",
    {
      title: "Git Add",
      description:
        "Stage files for commit. Can stage specific files or all changes.",
      inputSchema: GitAddInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { repo_path, files, all } = params;
      validateRepoPath(repo_path, config.allowedPaths);

      if (!all && files.length === 0) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Either provide files to stage or set all: true.",
            },
          ],
        };
      }

      const args: string[] = ["add"];

      if (all) {
        args.push("--all");
      } else {
        args.push("--", ...files);
      }

      await execGit(args, repo_path, config.timeout);

      const what = all ? "all changes" : `${files.length} file(s): ${files.join(", ")}`;
      return {
        content: [
          {
            type: "text" as const,
            text: `Staged ${what}`,
          },
        ],
      };
    }
  );
}
