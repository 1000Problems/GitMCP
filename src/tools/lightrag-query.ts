import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { LightragQueryInput } from "../schemas/index.js";
import { lightragPost } from "../lightrag-client.js";

export function registerLightragQueryTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "lightrag_query",
    {
      title: "LightRAG Query",
      description:
        "Query the LightRAG knowledge graph running on the host machine. Returns answers synthesized from indexed project documents. Use hybrid mode (default) for best results.",
      inputSchema: LightragQueryInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { text, mode } = params;
      const lightragUrl = config.lightragUrl ?? "http://localhost:9621";

      const result = await lightragPost(lightragUrl, "/query", {
        query: text,
        mode,
      });

      if (
        result !== null &&
        typeof result === "object" &&
        "response" in result
      ) {
        const response = (result as Record<string, unknown>).response;
        return {
          content: [{ type: "text" as const, text: String(response) }],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
