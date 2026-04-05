import * as fs from "node:fs";
import * as path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { FileWriteInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";

export function registerFileWriteTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_write_file",
    {
      title: "Write File",
      description:
        "Write content to a file on disk inside an allowed repository path. Creates parent directories by default.",
      inputSchema: FileWriteInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { file_path, content, create_dirs } = params;
      validateRepoPath(file_path, config.allowedPaths);

      // Resolve the real path to prevent symlink escape
      const resolved = path.resolve(file_path);
      const dir = path.dirname(resolved);

      // If the file already exists, verify the real path is still allowed
      try {
        const realPath = fs.realpathSync(resolved);
        validateRepoPath(realPath, config.allowedPaths);
      } catch (err: unknown) {
        // File doesn't exist yet — that's fine, we'll create it
        if (
          err instanceof Error &&
          "code" in err &&
          (err as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          // Validate the parent directory's real path
          try {
            const realDir = fs.realpathSync(dir);
            validateRepoPath(realDir, config.allowedPaths);
          } catch {
            // Parent doesn't exist yet either — will be created if create_dirs is true
          }
        } else {
          throw err;
        }
      }

      if (create_dirs) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(resolved, content, "utf-8");
      const bytes = Buffer.byteLength(content, "utf-8");

      return {
        content: [
          {
            type: "text" as const,
            text: `Wrote ${bytes} bytes to ${file_path}`,
          },
        ],
      };
    }
  );
}
