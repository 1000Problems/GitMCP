import * as fs from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { FileReadInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";

export function registerFileReadTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_read_file",
    {
      title: "Read File",
      description:
        "Read the contents of a file on disk inside an allowed repository path.",
      inputSchema: FileReadInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { file_path } = params;
      validateRepoPath(file_path, config.allowedPaths);

      try {
        const content = fs.readFileSync(file_path, "utf-8");
        return {
          content: [{ type: "text" as const, text: content }],
        };
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          "code" in err &&
          (err as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `File not found: ${file_path}`,
              },
            ],
          };
        }
        throw err;
      }
    }
  );
}
