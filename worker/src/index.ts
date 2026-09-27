import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools, makeCall, SERVER_INFO } from "../../shared/tools.mjs";

interface Env {
  IBANCHECKER_API_KEY?: string;
}

type Props = { apiKey?: string };

export class IBANCheckerMCP extends McpAgent<Env, unknown, Props> {
  server = new McpServer(SERVER_INFO);

  async init() {
    const call = makeCall(() => {
      const key = this.props?.apiKey || this.env.IBANCHECKER_API_KEY || "";
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

    // The session lives in a Durable Object that never sees this request's env; it only keeps the
    // props handed over when the session starts, so the caller's key has to travel as a prop.
    (ctx as ExecutionContext & { props?: Props }).props = apiKey ? { apiKey } : {};

    return IBANCheckerMCP.serve("/mcp").fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
