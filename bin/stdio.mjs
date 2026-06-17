#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools, makeCall, SERVER_INFO } from "../shared/tools.mjs";

const API_KEY = process.env.IBANCHECKER_API_KEY || "";

const call = makeCall(() => {
  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;
  return headers;
});

const server = new McpServer(SERVER_INFO);
registerTools(server, call);

const transport = new StdioServerTransport();
await server.connect(transport);
