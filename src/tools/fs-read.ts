import * as fs from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { FsReadInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";

export function registerFsReadTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "fs_read",
    {
      title: "Read File",
      description:
        "Read the contents of a file at an absolute path within allowed directories. Supports utf-8 text and base64 for binary files.",
      inputSchema: FsReadInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { file_path: filePath, encoding, max_size } = params;

      validateRepoPath(filePath, config.allowedPaths);

      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        throw new Error(`Not a file: ${filePath}`);
      }

      if (stat.size > max_size) {
        throw new Error(
          `File too large: ${stat.size} bytes exceeds max_size of ${max_size} bytes`
        );
      }

      if (encoding === "base64") {
        const buffer = fs.readFileSync(filePath);
        return {
          content: [
            {
              type: "text" as const,
              text: buffer.toString("base64"),
            },
          ],
        };
      }

      const text = fs.readFileSync(filePath, "utf-8");
      return {
        content: [{ type: "text" as const, text }],
      };
    }
  );
}
