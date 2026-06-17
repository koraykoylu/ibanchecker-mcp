# ibanchecker-mcp

[![npm version](https://img.shields.io/npm/v/@ibanchecker/mcp.svg)](https://www.npmjs.com/package/@ibanchecker/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Model Context Protocol](https://img.shields.io/badge/MCP-server-6E56CF.svg)](https://modelcontextprotocol.io)

MCP (Model Context Protocol) server for [ibanchecker.cash](https://ibanchecker.cash). Gives AI assistants like Claude five finance tools backed by the ibanchecker.cash validation engine:

| Tool | What it does |
|------|--------------|
| `validate_iban` | Validate a single IBAN: country, length, national BBAN structure, MOD-97 check digits, and bank details when available |
| `validate_bulk_ibans` | Validate up to 100 IBANs in one call |
| `extract_ibans_from_text` | Find and validate every IBAN inside a block of text (emails, invoices, spreadsheets) |
| `get_iban_format` | IBAN format specification for any of 90 supported countries |
| `lookup_bic` | Look up a bank by BIC/SWIFT code |

No IBAN data is logged or stored; validation runs in memory on Cloudflare's edge. See the [security page](https://ibanchecker.cash/security) for details.

## Quick start: hosted remote server

The easiest path is the hosted endpoint. Nothing to install or deploy.

```
https://mcp.ibanchecker.cash/mcp
```

**Claude Code**

```bash
claude mcp add --transport http ibanchecker https://mcp.ibanchecker.cash/mcp
```

**Claude Desktop** (`claude_desktop_config.json`), via the [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridge:

```json
{
  "mcpServers": {
    "ibanchecker": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.ibanchecker.cash/mcp"]
    }
  }
}
```

## Local stdio server

Run the server locally over stdio (requires Node 18+):

```json
{
  "mcpServers": {
    "ibanchecker": {
      "command": "npx",
      "args": ["-y", "@ibanchecker/mcp"],
      "env": {
        "IBANCHECKER_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Example

Calling `validate_iban` with `DE89370400440532013000` returns:

```json
{
  "valid": true,
  "iban": "DE89370400440532013000",
  "formatted": "DE89 3704 0044 0532 0130 00",
  "country_name": "Germany",
  "bank_name": "Commerzbank AG Cologne",
  "bic": "COBADEFFXXX",
  "bank_code": "37040044",
  "account_number": "0532013000",
  "sepa": true
}
```

When the API returns an error (for example a `429` rate limit or `401` bad key), the tool result is flagged with `isError: true` and a human-readable message, so the assistant can react rather than crash.

## API key

The underlying REST API has a free tier (1,000 requests/month). Get a key at [ibanchecker.cash/api-docs](https://ibanchecker.cash/api-docs) and pass it as:

- `IBANCHECKER_API_KEY` env var (stdio mode), or
- `Authorization: Bearer <key>` / `x-api-key` header (remote mode).

## Project layout

```
.
├── bin/stdio.mjs      # npm CLI entry (published as `ibanchecker-mcp`)
├── shared/tools.mjs   # the 5 tool definitions, shared by both transports
└── worker/            # Cloudflare Worker (the hosted remote server)
    ├── src/index.ts
    └── wrangler.toml
```

Both the stdio CLI and the Worker register the exact same tools from `shared/tools.mjs`, so there is a single source of truth.

## Self-hosting the Worker

The remote server is a Cloudflare Worker built on the [Agents SDK](https://developers.cloudflare.com/agents/). Deploy your own:

```bash
cd worker
npm install
npx wrangler deploy
```

Remove the `routes` block in `worker/wrangler.toml` (or point it at your own domain) and optionally set a server-wide key with `npx wrangler secret put IBANCHECKER_API_KEY`.

## License

MIT. See [LICENSE](./LICENSE).
