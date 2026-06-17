import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools, makeCall, SERVER_INFO } from "../../shared/tools.mjs";

interface Env {
  IBANCHECKER_API_KEY?: string;
}

export class IBANCheckerMCP extends McpAgent<Env> {
  server = new McpServer(SERVER_INFO);

  async init() {
    const call = makeCall(() => {
      const key = this.env.IBANCHECKER_API_KEY || "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (key) headers["Authorization"] = `Bearer ${key}`;
      return headers;
    });
    registerTools(this.server, call);
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const apiKey =
      request.headers.get("x-api-key") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      undefined;

    const envWithKey: Env = apiKey ? { ...env, IBANCHECKER_API_KEY: apiKey } : env;

    return IBANCheckerMCP.serve("/mcp").fetch(request, envWithKey, ctx);
  },
} satisfies ExportedHandler<Env>;
