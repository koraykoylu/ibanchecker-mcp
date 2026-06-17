import { z } from "zod";

export const API_BASE = "https://ibanchecker.cash/api/v1";

export const SERVER_INFO = { name: "ibanchecker-mcp", version: "1.1.0" };

export function makeCall(getHeaders) {
  return async function call(path, init = {}) {
    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, { headers: getHeaders(), ...init });
    } catch (err) {
      return {
        content: [{ type: "text", text: `Request to ibanchecker.cash failed: ${err?.message ?? String(err)}` }],
        isError: true,
      };
    }

    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }

    if (!res.ok) {
      const hint =
        res.status === 401 || res.status === 403
          ? " (check your IBANCHECKER_API_KEY)"
          : res.status === 429
            ? " (rate limit reached; the free tier allows 1,000 requests/month)"
            : "";
      const detail = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      return {
        content: [{ type: "text", text: `ibanchecker.cash API error ${res.status}${hint}:\n${detail}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
    };
  };
}

export function registerTools(server, call) {
  server.tool(
    "validate_iban",
    "Validate an IBAN number and return its country, format validity, check digit result, and bank details if available.",
    { iban: z.string().describe("The IBAN to validate") },
    ({ iban }) => call("/validate", { method: "POST", body: JSON.stringify({ iban }) })
  );

  server.tool(
    "validate_bulk_ibans",
    "Validate up to 100 IBAN numbers at once.",
    { ibans: z.array(z.string()).max(100).describe("Array of IBANs to validate (max 100)") },
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
}
