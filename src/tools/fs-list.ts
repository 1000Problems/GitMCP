import * as fs from "node:fs";
import * as path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { FsListInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";

const SKIP_DIRS = new Set(["node_modules", ".git", ".venv", ".cache"]);
const MAX_ENTRIES = 500;

interface EntryInfo {
  name: string;
  type: "file" | "dir" | "symlink";
  size: number;
  children?: EntryInfo[];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function readDir(
  dirPath: string,
  recursive: boolean,
  maxDepth: number,
  includeHidden: boolean,
  currentDepth: number,
  entryCount: { count: number }
): EntryInfo[] {
  if (entryCount.count >= MAX_ENTRIES) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: EntryInfo[] = [];

  for (const entry of entries) {
    if (entryCount.count >= MAX_ENTRIES) break;

    if (!includeHidden && entry.name.startsWith(".")) continue;

    entryCount.count++;

    if (entry.isSymbolicLink()) {
      results.push({ name: entry.name, type: "symlink", size: 0 });
    } else if (entry.isDirectory()) {
      const info: EntryInfo = { name: entry.name, type: "dir", size: 0 };

      if (
        recursive &&
        currentDepth < maxDepth &&
        !SKIP_DIRS.has(entry.name)
      ) {
        info.children = readDir(
          path.join(dirPath, entry.name),
          recursive,
          maxDepth,
          includeHidden,
          currentDepth + 1,
          entryCount
        );
      }

      results.push(info);
    } else if (entry.isFile()) {
      let size = 0;
      try {
        size = fs.statSync(path.join(dirPath, entry.name)).size;
      } catch {
        // skip stat errors
      }
      results.push({ name: entry.name, type: "file", size });
    }
  }

  return results;
}

function formatTree(
  entries: EntryInfo[],
  prefix: string
): string {
  const lines: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = isLast ? "    " : "│   ";

    if (entry.type === "file") {
      lines.push(`${prefix}${connector}${entry.name} (${formatSize(entry.size)})`);
    } else if (entry.type === "dir") {
      lines.push(`${prefix}${connector}${entry.name}/ (dir)`);
      if (entry.children && entry.children.length > 0) {
        lines.push(formatTree(entry.children, prefix + childPrefix));
      }
    } else {
      lines.push(`${prefix}${connector}${entry.name} -> (symlink)`);
    }
  }

  return lines.join("\n");
}

export function registerFsListTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "fs_list",
    {
      title: "List Directory",
      description:
        "List the contents of a directory within allowed paths. Shows file names, types, and sizes. Supports recursive listing with depth control.",
      inputSchema: FsListInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { path: dirPath, recursive, max_depth, include_hidden } = params;

      validateRepoPath(dirPath, config.allowedPaths);

      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) {
        throw new Error(`Not a directory: ${dirPath}`);
      }

      const entryCount = { count: 0 };
      const entries = readDir(
        dirPath,
        recursive,
        max_depth,
        include_hidden,
        0,
        entryCount
      );

      const header = `${dirPath}/`;
      const tree = formatTree(entries, "");
      const truncated =
        entryCount.count >= MAX_ENTRIES
          ? `\n\n(Truncated at ${MAX_ENTRIES} entries)`
          : "";

      return {
        content: [
          {
            type: "text" as const,
            text: `${header}\n${tree}${truncated}`,
          },
        ],
      };
    }
  );
}
