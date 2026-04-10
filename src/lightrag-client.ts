import * as http from "node:http";
import * as https from "node:https";

function makeRequest(
  url: string,
  method: string,
  body?: unknown
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const transport = isHttps ? https : http;

    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;

    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port
        ? parseInt(parsed.port, 10)
        : isHttps
          ? 443
          : 80,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(bodyStr !== undefined
          ? { "Content-Length": Buffer.byteLength(bodyStr) }
          : {}),
      },
    };

    const req = transport.request(options, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on("end", () => {
        if (res.statusCode === undefined || res.statusCode < 200 || res.statusCode >= 300) {
          reject(
            new Error(
              `LightRAG returned HTTP ${res.statusCode ?? "unknown"}: ${data}`
            )
          );
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ECONNREFUSED") {
        reject(
          new Error(
            `LightRAG is not running at ${parsed.protocol}//${parsed.host}. Start it with: cd ~/1000Problems/.lightrag && docker compose up -d`
          )
        );
      } else {
        reject(new Error(`LightRAG request failed: ${err.message}`));
      }
    });

    if (bodyStr !== undefined) {
      req.write(bodyStr);
    }
    req.end();
  });
}

export async function lightragPost(
  baseUrl: string,
  path: string,
  body: unknown
): Promise<unknown> {
  return makeRequest(`${baseUrl}${path}`, "POST", body);
}

export async function lightragGet(
  baseUrl: string,
  path: string
): Promise<unknown> {
  return makeRequest(`${baseUrl}${path}`, "GET");
}
