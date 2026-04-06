import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "./types.js";
import { registerStatusTool } from "./tools/status.js";
import { registerDiffTool } from "./tools/diff.js";
import { registerLogTool } from "./tools/log.js";
import { registerShowTool } from "./tools/show.js";
import { registerAddTool } from "./tools/add.js";
import { registerCommitTool } from "./tools/commit.js";
import { registerPushTool } from "./tools/push.js";
import { registerPullTool } from "./tools/pull.js";
import { registerBranchTool } from "./tools/branch.js";
import { registerCheckoutTool } from "./tools/checkout.js";
import { registerCloneTool } from "./tools/clone.js";
import { registerStashTool } from "./tools/stash.js";
import { registerRemoteTool } from "./tools/remote.js";
import { registerInitTool } from "./tools/init.js";
import { registerFsWriteTool } from "./tools/fs-write.js";
import { registerFsReadTool } from "./tools/fs-read.js";
import { registerFsListTool } from "./tools/fs-list.js";
import { registerFsStatTool } from "./tools/fs-stat.js";

export function createServer(config: ServerConfig): McpServer {
  const server = new McpServer({
    name: "git-mcp-server",
    version: "0.3.0",
  });

  registerStatusTool(server, config);
  registerDiffTool(server, config);
  registerLogTool(server, config);
  registerShowTool(server, config);
  registerAddTool(server, config);
  registerCommitTool(server, config);
  registerPushTool(server, config);
  registerPullTool(server, config);
  registerBranchTool(server, config);
  registerCheckoutTool(server, config);
  registerCloneTool(server, config);
  registerStashTool(server, config);
  registerRemoteTool(server, config);
  registerInitTool(server, config);
  registerFsWriteTool(server, config);
  registerFsReadTool(server, config);
  registerFsListTool(server, config);
  registerFsStatTool(server, config);

  return server;
}
