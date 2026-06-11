import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const API_BASE = "https://ibanchecker.cash/api/v1";

interface Env {
  IBANCHECKER_API_KEY?: string;
}

function authHeaders(env: Env, requestApiKey?: string): Record<string, string> {
  const key = requestApiKey || env.IBANCHECKER_API_KEY || "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;
  return headers;
}

export class IBANCheckerMCP extends McpAgent<Env> {
  server = new McpServer({
    name: "ibanchecker-mcp",
    version: "1.0.0",
  });

  async init() {
    this.server.tool(
      "validate_iban",
      "Validate an IBAN number and return its country, format validity, check digit result, and bank details if available.",
      { iban: z.string().describe("The IBAN to validate") },
      async ({ iban }) => {
        const res = await fetch(`${API_BASE}/validate`, {
          method: "POST",
          headers: authHeaders(this.env),
          body: JSON.stringify({ iban }),
        });
        const data = await res.json();
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }
    );

    this.server.tool(
      "validate_bulk_ibans",
      "Validate up to 20 IBAN numbers at once.",
      { ibans: z.array(z.string()).max(20).describe("Array of IBANs to validate") },
      async ({ ibans }) => {
        const res = await fetch(`${API_BASE}/validate/bulk`, {
          method: "POST",
          headers: authHeaders(this.env),
          body: JSON.stringify({ ibans }),
        });
        const data = await res.json();
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }
    );

    this.server.tool(
      "extract_ibans_from_text",
      "Extract and validate all IBAN numbers found in a block of text.",
      { text: z.string().describe("The text to scan for IBANs") },
      async ({ text }) => {
        const res = await fetch(`${API_BASE}/extract`, {
          method: "POST",
          headers: authHeaders(this.env),
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }
    );

    this.server.tool(
      "get_iban_format",
      "Get the IBAN format specification for a given country.",
      { country_code: z.string().length(2).describe("Two-letter ISO 3166-1 country code (e.g. DE, GB, FR)") },
      async ({ country_code }) => {
        const res = await fetch(`${API_BASE}/formats/${country_code.toUpperCase()}`, {
          headers: authHeaders(this.env),
        });
        const data = await res.json();
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }
    );

    this.server.tool(
      "lookup_bic",
      "Look up a bank by BIC/SWIFT code.",
      { bic: z.string().describe("The BIC/SWIFT code to look up (e.g. DEUTDEDB)") },
      async ({ bic }) => {
        const res = await fetch(`${API_BASE}/swift/${bic.toUpperCase()}`, {
          headers: authHeaders(this.env),
        });
        const data = await res.json();
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }
    );
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    const apiKey = request.headers.get("x-api-key") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      undefined;

    const envWithKey: Env = apiKey ? { ...env, IBANCHECKER_API_KEY: apiKey } : env;

    return IBANCheckerMCP.serve("/mcp").fetch(request, envWithKey, ctx);
  },
} satisfies ExportedHandler<Env>;
