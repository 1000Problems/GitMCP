import * as fs from "node:fs";
import * as path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerConfig } from "../types.js";
import { LightragIndexInput } from "../schemas/index.js";
import { validateRepoPath } from "../security.js";
import { lightragPost } from "../lightrag-client.js";

export function registerLightragIndexTool(
  server: McpServer,
  config: ServerConfig
): void {
  server.registerTool(
    "lightrag_index",
    {
      title: "LightRAG Index",
      description:
        "Read files from disk and index them into the LightRAG knowledge graph. Files must be within allowed paths. Useful for keeping LightRAG up-to-date with project documents.",
      inputSchema: LightragIndexInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { documents } = params;
      const lightragUrl = config.lightragUrl ?? "http://localhost:9621";

      const results: string[] = [];
      let succeeded = 0;
      let failed = 0;

      for (const doc of documents) {
        try {
          validateRepoPath(doc.path, config.allowedPaths);

          const content = fs.readFileSync(doc.path, "utf-8");
          const description = doc.label ?? path.basename(doc.path);

          await lightragPost(lightragUrl, "/documents/text", {
            text: content,
            description,
          });

          succeeded++;
          results.push(`✓ ${doc.path}`);
        } catch (err: unknown) {
          failed++;
          const message = err instanceof Error ? err.message : String(err);
          results.push(`✗ ${doc.path}: ${message}`);
        }
      }

      const summary = `Indexed ${succeeded}/${documents.length} documents. Failed: ${failed}`;
      const details = results.join("\n");
      return {
        content: [{ type: "text" as const, text: `${summary}\n\n${details}` }],
      };
    }
  );
}
