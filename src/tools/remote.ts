import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { GitRemoteInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";
import { execGit } from "../git-executor.js";

export function registerRemoteTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_remote",
    {
      title: "Git Remote",
      description:
        "Manage remote repositories — list, add, or remove remotes.",
      inputSchema: GitRemoteInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { repo_path, action, name, url } = params;
      validateRepoPath(repo_path, config.allowedPaths);

      switch (action) {
        case "list": {
          const result = await execGit(
            ["remote", "-v"],
            repo_path,
            config.timeout
          );
          const output = result.stdout.trim() || "(no remotes)";
          return {
            content: [{ type: "text" as const, text: output }],
          };
        }
        case "add": {
          if (!name || !url) {
            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: "Error: Both name and url are required for add action.",
                },
              ],
            };
          }
          await execGit(
            ["remote", "add", name, url],
            repo_path,
            config.timeout
          );
          return {
            content: [
              {
                type: "text" as const,
                text: `Added remote '${name}' -> ${url}`,
              },
            ],
          };
        }
        case "remove": {
          if (!name) {
            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: "Error: Remote name is required for remove action.",
                },
              ],
            };
          }
          await execGit(
            ["remote", "remove", name],
            repo_path,
            config.timeout
          );
          return {
            content: [
              {
                type: "text" as const,
                text: `Removed remote '${name}'`,
              },
            ],
          };
        }
      }
    }
  );
}
