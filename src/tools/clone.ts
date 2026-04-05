import * as fs from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { GitCloneInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";
import { execGit } from "../git-executor.js";

export function registerCloneTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_clone",
    {
      title: "Git Clone",
      description:
        "Clone a repository into a directory. Target path must be within allowed paths.",
      inputSchema: GitCloneInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      const { url, target_path, branch, depth } = params;
      validateRepoPath(target_path, config.allowedPaths);

      // Check if target already exists and is non-empty
      try {
        const entries = fs.readdirSync(target_path);
        if (entries.length > 0) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Error: Target directory '${target_path}' already exists and is not empty.`,
              },
            ],
          };
        }
      } catch {
        // Directory doesn't exist — that's fine
      }

      const args: string[] = ["clone"];

      if (branch) {
        args.push("--branch", branch);
      }

      if (depth) {
        args.push("--depth", `${depth}`);
      }

      args.push(url, target_path);

      // Clone runs in the parent directory
      const cwd = fs.realpathSync(".");
      const result = await execGit(args, cwd, config.timeout);

      const output =
        result.stderr.trim() || result.stdout.trim() || `Cloned ${url} into ${target_path}`;
      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}
