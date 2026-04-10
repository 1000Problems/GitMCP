import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { LightragStatusInput } from "../schemas/index.js";
import { lightragGet } from "../lightrag-client.js";

export function registerLightragStatusTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "lightrag_status",
    {
      title: "LightRAG Status",
      description:
        "Check the health and status of the LightRAG knowledge graph container running on the host machine.",
      inputSchema: LightragStatusInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (_params) => {
      const lightragUrl = config.lightragUrl ?? "http://localhost:9621";

      const health = await lightragGet(lightragUrl, "/health");

      if (health === null || typeof health !== "object") {
        return {
          content: [
            { type: "text" as const, text: `Unexpected response: ${JSON.stringify(health)}` },
          ],
        };
      }

      const h = health as Record<string, unknown>;
      const lines: string[] = [
        `Status: ${h["status"] ?? "unknown"}`,
        `Version: ${h["core_version"] ?? "?"} / ${h["api_version"] ?? "?"}`,
        `Pipeline busy: ${h["pipeline_busy"] ?? "unknown"}`,
        `LLM: ${h["llm_model"] ?? "unknown"} via ${h["llm_binding"] ?? "unknown"}`,
        `Embeddings: ${h["embedding_model"] ?? "unknown"}`,
      ];

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
