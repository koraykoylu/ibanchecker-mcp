#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://ibanchecker.cash/api/v1";
const API_KEY = process.env.IBANCHECKER_API_KEY || "";

function headers() {
  const h = { "Content-Type": "application/json" };
  if (API_KEY) h["Authorization"] = `Bearer ${API_KEY}`;
  return h;
}

async function call(path, init) {
  const res = await fetch(`${API_BASE}${path}`, { headers: headers(), ...init });
  const data = await res.json();
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

const server = new McpServer({ name: "ibanchecker-mcp", version: "1.0.0" });

server.tool(
  "validate_iban",
  "Validate an IBAN number and return its country, format validity, check digit result, and bank details if available.",
  { iban: z.string().describe("The IBAN to validate") },
  ({ iban }) => call("/validate", { method: "POST", body: JSON.stringify({ iban }) })
);

server.tool(
  "validate_bulk_ibans",
  "Validate up to 20 IBAN numbers at once.",
  { ibans: z.array(z.string()).max(20).describe("Array of IBANs to validate") },
  ({ ibans }) => call("/validate/bulk", { method: "POST", body: JSON.stringify({ ibans }) })
);

server.tool(
  "extract_ibans_from_text",
  "Extract and validate all IBAN numbers found in a block of text.",
  { text: z.string().describe("The text to scan for IBANs") },
  ({ text }) => call("/extract", { method: "POST", body: JSON.stringify({ text }) })
);

server.tool(
  "get_iban_format",
  "Get the IBAN format specification for a given country.",
  { country_code: z.string().length(2).describe("Two-letter ISO 3166-1 country code (e.g. DE, GB, FR)") },
  ({ country_code }) => call(`/formats/${country_code.toUpperCase()}`)
);

server.tool(
  "lookup_bic",
  "Look up a bank by BIC/SWIFT code.",
  { bic: z.string().describe("The BIC/SWIFT code to look up (e.g. DEUTDEDB)") },
  ({ bic }) => call(`/swift/${bic.toUpperCase()}`)
);

const transport = new StdioServerTransport();
await server.connect(transport);
