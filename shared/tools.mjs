import { z } from "zod";

export const API_BASE = "https://ibanchecker.cash/api/v1";

export const SERVER_INFO = { name: "ibanchecker-mcp", version: "1.2.0" };

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

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export function registerTools(server, call) {
  server.registerTool(
    "validate_iban",
    {
      title: "Validate IBAN",
      description:
        "Validate a single International Bank Account Number (IBAN) against the official ISO 13616 structure for its country.\n\n" +
        "What it checks: the country code, total length for that country, the national BBAN structure, and the MOD-97 check digits. " +
        "When the bank/branch code maps to a known institution, the response also includes the bank name, BIC/SWIFT code, and country.\n\n" +
        "Returns JSON with fields such as `valid` (boolean), `countryCode`, `checkDigitsValid`, the `formatted` IBAN, and an optional `bank` object. " +
        "On a malformed input the call still succeeds with `valid: false` and a `reason` (e.g. INVALID_FORMAT, INVALID_CHECKSUM); it does not throw for invalid IBANs.\n\n" +
        "Use this when you have one account number to verify. For many IBANs prefer `validate_bulk_ibans`; to pull IBANs out of prose use `extract_ibans_from_text` first. " +
        "No account data is stored; validation runs in memory and is discarded.",
      inputSchema: {
        iban: z
          .string()
          .min(5)
          .describe(
            "A single IBAN to validate. Case-insensitive; spaces are tolerated and ignored (e.g. 'DE89 3704 0044 0532 0130 00' or 'GB29NWBK60161331926819')."
          ),
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    ({ iban }) => call("/validate", { method: "POST", body: JSON.stringify({ iban }) })
  );

  server.registerTool(
    "validate_bulk_ibans",
    {
      title: "Validate Multiple IBANs",
      description:
        "Validate a batch of up to 100 IBANs in one call, applying the same ISO 13616 checks as `validate_iban` (country, length, BBAN structure, MOD-97).\n\n" +
        "Returns a JSON array of per-IBAN results in the same order as the input, each with `valid`, `countryCode`, an optional `reason` for failures, and bank details when the code is recognized, plus a summary count of valid vs. invalid entries.\n\n" +
        "Use this instead of calling `validate_iban` in a loop when checking a list (e.g. a payment file or a column of supplier accounts). Split inputs larger than 100 into multiple calls. " +
        "Account numbers are validated in memory and never stored.",
      inputSchema: {
        ibans: z
          .array(z.string().min(5))
          .min(1)
          .max(100)
          .describe(
            "Array of 1 to 100 IBAN strings to validate. Case-insensitive; spaces are tolerated. Order is preserved in the response."
          ),
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    ({ ibans }) => call("/validate/bulk", { method: "POST", body: JSON.stringify({ ibans }) })
  );

  server.registerTool(
    "extract_ibans_from_text",
    {
      title: "Extract IBANs From Text",
      description:
        "Scan a free-form block of text and pull out every candidate IBAN, then validate each one.\n\n" +
        "Useful for unstructured sources such as emails, invoices, PDFs pasted as text, or chat messages where IBANs appear inline and may be split by spaces or surrounded by other words. " +
        "Returns a JSON array of the IBANs found, each with its validation result (`valid`, `countryCode`, bank details when known); text containing no IBAN returns an empty list rather than an error.\n\n" +
        "Use this as the first step when the account number is buried in prose; pass the extracted IBANs to `validate_bulk_ibans` only if you need to re-check them separately. Input text is processed in memory and not stored.",
      inputSchema: {
        text: z
          .string()
          .min(1)
          .describe(
            "Arbitrary text to scan for IBANs, e.g. the body of an email or invoice. IBANs may be split across spaces or embedded in sentences."
          ),
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    ({ text }) => call("/extract", { method: "POST", body: JSON.stringify({ text }) })
  );

  server.registerTool(
    "get_iban_format",
    {
      title: "Get Country IBAN Format",
      description:
        "Return the IBAN format specification for a country, covering 90 supported IBAN-using countries.\n\n" +
        "Returns JSON describing the country's total IBAN length, the BBAN layout (bank code, branch code, and account number positions and lengths), an example IBAN, and the SEPA-membership flag. " +
        "Use this to understand or display how a country's IBAN is structured, to build input masks, or to explain a validation failure, not to validate a specific number (use `validate_iban` for that). " +
        "An unsupported or unknown country code returns an error result describing the problem.",
      inputSchema: {
        country_code: z
          .string()
          .length(2)
          .regex(/^[A-Za-z]{2}$/)
          .describe(
            "Two-letter ISO 3166-1 alpha-2 country code, case-insensitive (e.g. 'DE' for Germany, 'GB' for the United Kingdom, 'FR' for France)."
          ),
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    ({ country_code }) => call(`/formats/${country_code.toUpperCase()}`)
  );

  server.registerTool(
    "lookup_bic",
    {
      title: "Look Up Bank by BIC/SWIFT",
      description:
        "Look up a financial institution by its BIC (Business Identifier Code, also called SWIFT code) and return the matching bank's details.\n\n" +
        "Accepts an 8-character (head office) or 11-character (branch) BIC. Returns JSON with the bank name, city, ISO country code, SEPA membership, and (when available) the official website and Wikidata entity. " +
        "Use this to resolve a BIC to a human-readable bank, to confirm a SWIFT code is real, or to enrich a validated IBAN with institution details. " +
        "An unknown or malformed BIC returns an error result rather than a guess; codes are never fabricated.",
      inputSchema: {
        bic: z
          .string()
          .min(8)
          .max(11)
          .regex(/^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/)
          .describe(
            "An 8- or 11-character ISO 9362 BIC/SWIFT code, case-insensitive (e.g. 'DEUTDEFF' or 'DEUTDEFF500')."
          ),
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    ({ bic }) => call(`/swift/${bic.toUpperCase()}`)
  );
}
