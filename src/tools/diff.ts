import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { GitDiffInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";
import { execGit } from "../git-executor.js";

export function registerDiffTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_diff",
    {
      title: "Git Diff",
      description:
        "Show changes in the working tree or between commits. Can show staged changes, unstaged changes, or diff between two refs.",
      inputSchema: GitDiffInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { repo_path, staged, file_path, ref1, ref2 } = params;
      validateRepoPath(repo_path, config.allowedPaths);

      const args: string[] = ["diff"];

      if (staged) {
        args.push("--cached");
      }

      if (ref1) {
        args.push(ref1);
        if (ref2) {
          args.push(ref2);
        }
      }

      if (file_path) {
        args.push("--", file_path);
      }

      const result = await execGit(args, repo_path, config.timeout);

      const output = result.stdout.trim() || "(no diff output)";
      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}
