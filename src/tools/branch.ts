import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { GitBranchInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";
import { execGit } from "../git-executor.js";

export function registerBranchTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_branch",
    {
      title: "Git Branch",
      description:
        "List, create, or delete branches. Force delete (-D) is intentionally not supported — only safe delete (-d) is available.",
      inputSchema: GitBranchInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { repo_path, action, name, start_point } = params;
      validateRepoPath(repo_path, config.allowedPaths);

      switch (action) {
        case "list": {
          const result = await execGit(
            [
              "branch",
              "-a",
              "--format=%(if)%(HEAD)%(then)* %(end)%(refname:short)%(if)%(upstream)%(then) -> %(upstream:short)%(end)",
            ],
            repo_path,
            config.timeout
          );
          const output = result.stdout.trim() || "(no branches)";
          return {
            content: [{ type: "text" as const, text: output }],
          };
        }
        case "create": {
          if (!name) {
            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: "Error: Branch name is required for create action.",
                },
              ],
            };
          }
          const args = ["branch", name];
          if (start_point) {
            args.push(start_point);
          }
          await execGit(args, repo_path, config.timeout);
          return {
            content: [
              {
                type: "text" as const,
                text: `Created branch '${name}'${start_point ? ` from '${start_point}'` : ""}`,
              },
            ],
          };
        }
        case "delete": {
          if (!name) {
            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: "Error: Branch name is required for delete action.",
                },
              ],
            };
          }
          // Safe delete only — no -D
          await execGit(
            ["branch", "-d", name],
            repo_path,
            config.timeout
          );
          return {
            content: [
              {
                type: "text" as const,
                text: `Deleted branch '${name}'`,
              },
            ],
          };
        }
      }
    }
  );
}
