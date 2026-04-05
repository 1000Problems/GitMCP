import * as fs from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { FileDeleteInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";

export function registerFileDeleteTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_delete_file",
    {
      title: "Delete File",
      description:
        "Delete a file on disk inside an allowed repository path. Refuses to delete directories.",
      inputSchema: FileDeleteInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { file_path } = params;
      validateRepoPath(file_path, config.allowedPaths);

      // Verify it's a file, not a directory
      const stat = fs.statSync(file_path);
      if (stat.isDirectory()) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Refusing to delete directory: ${file_path}. Only files can be deleted.`,
            },
          ],
        };
      }

      fs.unlinkSync(file_path);

      return {
        content: [
          {
            type: "text" as const,
            text: `Deleted ${file_path}`,
          },
        ],
      };
    }
  );
}
