import * as fs from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { FsStatInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";

export function registerFsStatTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "fs_stat",
    {
      title: "File/Path Stat",
      description:
        "Check if a path exists and get metadata (type, size, modified date) within allowed directories.",
      inputSchema: FsStatInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { path: targetPath } = params;

      validateRepoPath(targetPath, config.allowedPaths);

      let stat: fs.Stats;
      try {
        stat = fs.statSync(targetPath);
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          "code" in err &&
          (err as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Path: ${targetPath}\nExists: false`,
              },
            ],
          };
        }
        throw err;
      }

      let type = "file";
      if (stat.isDirectory()) type = "dir";
      else if (stat.isSymbolicLink()) type = "symlink";

      const sizeStr = stat.size.toLocaleString();
      const modified = stat.mtime.toISOString();

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Path: ${targetPath}`,
              `Exists: true`,
              `Type: ${type}`,
              `Size: ${sizeStr} bytes`,
              `Modified: ${modified}`,
            ].join("\n"),
          },
        ],
      };
    }
  );
}
