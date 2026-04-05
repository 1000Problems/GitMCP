import * as fs from "node:fs";
import * as path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { FileListInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";

function walkDir(dir: string, base: string): string[] {
  const entries: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    if (item.name === ".git") continue;
    const rel = path.join(base, item.name);
    if (item.isDirectory()) {
      entries.push(rel + "/");
      entries.push(...walkDir(path.join(dir, item.name), rel));
    } else {
      entries.push(rel);
    }
  }

  return entries;
}

export function registerFileListTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "git_list_files",
    {
      title: "List Files",
      description:
        "List files and directories inside an allowed repository path. Skips .git directories.",
      inputSchema: FileListInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { dir_path, recursive } = params;
      validateRepoPath(dir_path, config.allowedPaths);

      if (recursive) {
        const entries = walkDir(dir_path, "");
        return {
          content: [
            {
              type: "text" as const,
              text: entries.length
                ? entries.join("\n")
                : "(empty directory)",
            },
          ],
        };
      }

      const items = fs.readdirSync(dir_path, { withFileTypes: true });
      const lines: string[] = [];

      for (const item of items) {
        if (item.name === ".git") continue;
        const suffix = item.isDirectory() ? "/" : "";
        lines.push(item.name + suffix);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: lines.length ? lines.join("\n") : "(empty directory)",
          },
        ],
      };
    }
  );
}
