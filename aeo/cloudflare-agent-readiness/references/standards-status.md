# Standards status

> Source: classification by this repo of the standards the isitagentready.com (Cloudflare)
> scanner checks. Re-verify status before relying on it; drafts change.

Which of these files are real standards, and which are drafts/proposals/vendor conventions
(snapshot, 2026-10-27, from my knowledge of each spec — not re-verified against each one today).

| File / mechanism | Status |
|---|---|
| `robots.txt` | **Standard** — IETF RFC 9309 |
| `sitemap.xml` | **De facto standard** — sitemaps.org protocol (used by all major search engines) |
| `Link` response header | **Standard** — RFC 8288; `api-catalog` relation via RFC 9727 |
| `/.well-known/api-catalog` | **Standard** — RFC 9727 |
| OAuth/OIDC discovery (`openid-configuration`, `oauth-authorization-server`) | **Standard** — OIDC Discovery 1.0 / RFC 8414 |
| `/.well-known/oauth-protected-resource` | **Standard** — RFC 9728 |
| `Accept: text/markdown` negotiation | HTTP negotiation and the `text/markdown` type are standard; *serving markdown for agents* is a convention (Cloudflare "Markdown for Agents") |
| `Content-Signal` in robots.txt | **Draft** — IETF draft-romm-aipref-contentsignals (Cloudflare-originated) |
| Web Bot Auth (`http-message-signatures-directory`) | **Draft** — IETF WebBotAuth WG |
| DNS-AID (`_agents` SVCB records) | **Draft / experimental** |
| `/llms.txt`, `/llms-full.txt` | **Community proposal** (llmstxt.org); not an RFC, no guarantee any engine reads it |
| Agent Skills index (`/.well-known/agent-skills/index.json`) | **Draft RFC** v0.2.0 |
| MCP Server Card | **Proposal** (MCP SEP-1649) |
| A2A Agent Card | Published protocol spec (A2A project), not an IETF/W3C standard |
| WebMCP | **Draft** (W3C community group) |
| ARD (`ai-catalog.json`) | **Draft** v0.9 |
| Personal Agent Protocol (`poppy.json`) | **Draft** 0.1 |
| Auth.md | Vendor convention (WorkOS) |
| x402, MPP, UCP, ACP, AP2 | Vendor/consortium protocols, not open standards bodies |

Practical consequence: only the first six rows are safe long-term bets for AEO today. Everything
else is cheap to publish but may change or be ignored — keep those files small, generated, and
easy to delete.
