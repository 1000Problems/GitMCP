import * as fs from "node:fs";
import * as path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { FsWriteInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";

const MAX_WRITE_SIZE = 5 * 1024 * 1024; // 5MB

export function registerFsWriteTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "fs_write",
    {
      title: "Write File",
      description:
        "Write (create or overwrite) a file at an absolute path within allowed directories. Supports utf-8 text and base64 binary content.",
      inputSchema: FsWriteInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { file_path: filePath, content, create_dirs, encoding } = params;

      // Reject paths inside .git internals
      if (filePath.includes("/.git/") || filePath.endsWith("/.git")) {
        throw new Error(
          `Refusing to write inside .git directory: ${filePath}`
        );
      }

      validateRepoPath(filePath, config.allowedPaths);

      const byteLength = Buffer.byteLength(content, encoding === "base64" ? "base64" : "utf-8");
      if (byteLength > MAX_WRITE_SIZE) {
        throw new Error(
          `Content too large: ${byteLength} bytes exceeds ${MAX_WRITE_SIZE} byte limit`
        );
      }

      if (create_dirs) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }

      const buffer = encoding === "base64"
        ? Buffer.from(content, "base64")
        : content;

      fs.writeFileSync(filePath, buffer, encoding === "base64" ? undefined : "utf-8");

      const stat = fs.statSync(filePath);
      const sizeStr = stat.size.toLocaleString();

      return {
        content: [
          {
            type: "text" as const,
            text: `Written: ${filePath} (${sizeStr} bytes)`,
          },
        ],
      };
    }
  );
}
