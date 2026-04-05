#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { DEFAULT_BRANCH, DEFAULT_TIMEOUT } from "./constants.js";
import type { ServerConfig } from "./types.js";

function parseArgs(argv: string[]): ServerConfig {
  const args = argv.slice(2);

  let allowedPaths: string[] = [];
  let defaultBranch = DEFAULT_BRANCH;
  let timeout = DEFAULT_TIMEOUT;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      console.error(`Usage: git-mcp-server --allowed-paths <paths>

Options:
  --allowed-paths <paths>   Comma-separated list of absolute directory paths (required)
  --default-branch <name>   Default branch name for new repos (default: main)
  --timeout <ms>            Timeout for git commands in ms (default: 30000)
  --help, -h                Show this help message
`);
      process.exit(0);
    }

    if (arg === "--allowed-paths" && i + 1 < args.length) {
      i++;
      allowedPaths = args[i]
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    } else if (arg === "--default-branch" && i + 1 < args.length) {
      i++;
      defaultBranch = args[i];
    } else if (arg === "--timeout" && i + 1 < args.length) {
      i++;
      const parsed = parseInt(args[i], 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        timeout = parsed;
      }
    }
  }

  if (allowedPaths.length === 0) {
    console.error(
      "Error: --allowed-paths is required. Provide at least one directory path."
    );
    process.exit(1);
  }

  return { allowedPaths, defaultBranch, timeout };
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv);

  console.error(
    `git-mcp-server starting with allowed paths: ${config.allowedPaths.join(", ")}`
  );

  const server = createServer(config);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error("git-mcp-server connected via stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
