---
name: cloudflare-agent-readiness
description: Improve a website's AEO (Answer Engine Optimization) and AI-agent readiness. Use when the user wants to scan a site they own or are authorized to change (e.g. kevops.site) with the isitagentready.com scanner, fix failing checks (robots.txt, sitemap, Link headers, AI bot rules, Content Signals, llms.txt, markdown negotiation, Agent Skills index, MCP/A2A cards, OAuth discovery, commerce protocols), reach a higher readiness level, or asks how to make a site visible to ChatGPT/Claude/Perplexity-style answer engines.
---

# cloudflare-agent-readiness

One skill that consolidates all 25 implementation skills published by
[isitagentready.com](https://isitagentready.com) — **Cloudflare's "Is Your Site Agent-Ready?"
scanner** — into a single workflow: scan → prioritize → implement → re-scan.

## Origin and attribution

The scanner, its 23 checks, the readiness-level scale and the per-standard requirements come from
**isitagentready.com** (Cloudflare; see <https://developers.cloudflare.com/agents/>). The
requirements in `references/` are condensed from its published skills at
`https://isitagentready.com/.well-known/agent-skills/<name>/SKILL.md`, indexed at
`https://isitagentready.com/.well-known/agent-skills/index.json` (a snapshot of that index is
kept in [references/upstream-index.json](references/upstream-index.json), fetched 2026-10-27).
Each underlying standard (RFC 9309, RFC 8288, RFC 9727, RFC 9728, llmstxt.org, Content Signals,
MCP, A2A, WebMCP, x402, …) belongs to its own spec authors. This repo adds the consolidation,
the hosting-aware guidance and the helper script; it is not affiliated with or endorsed by
Cloudflare. If upstream changes, treat upstream as the source of truth and update `references/`.

## Hard rules

- **Only scan and change sites the user owns or is authorized to change.** The scan sends
  one `POST https://isitagentready.com/api/scan` with the URL — nothing else — to the
  third-party scanner, which then fetches that site's public well-known URLs.
  Loopback, private, link-local and internal hostnames are refused (they can't be scanned from
  the internet and would leak internal names).
- **Never fabricate capabilities.** Publish an MCP card, A2A card, OAuth metadata, API catalog,
  commerce document, etc. only if the thing it advertises exists. A static portfolio/blog should
  not claim an API or payment flow to turn a check green.
- Never put secrets or private keys in any discovery document.
- Never probe `POST /agent/auth` or any registration/payment endpoint on a live service.
- Recompute `digest` hashes (Agent Skills index) after every edit to a published SKILL.md.
- Confirm with the user before changing production hosting/CDN/DNS configuration.

## Workflow

1. **Scan.** `node scripts/scan.js https://example.com` (summary, level, ordered fix list).
   Add `--json` for machine output or `--from-file scan.json` to re-read a saved response
   offline. The script maps every failing check to the right reference section below.
2. **Identify the stack** (static export, S3/CloudFront, Cloudflare, Vercel, Netlify, Next.js,
   …). It decides *where* each fix goes: files in the build output for `/robots.txt`,
   `/sitemap.xml`, `/llms.txt`, `/.well-known/*`; **CDN/edge config** for `Link` headers and
   `Accept: text/markdown` negotiation (static hosts cannot do these in the origin).
3. **Fix in level order** (below), a small batch at a time; ask for decisions that are the
   user's (e.g. allow or block AI *training* crawlers).
4. **Re-scan** after deploying and report the level change and any remaining failures. A
   scanner result is cached/edge-dependent: verify with `curl` first if a fix "didn't take".

## Level scale and fix order

| Level | Name | Requires |
|---|---|---|
| 0 | Not Ready | fewer than 2 of: robots.txt, sitemap, Link headers |
| 1 | Basic Web Presence | 2 of 3: robots.txt, sitemap, Link headers |
| 2 | Bot-Aware | L1 + AI bot rules **and** Content Signals |
| 3 | Agent-Readable | L2 + markdown content negotiation |
| 4 | Agent-Integrated | L3 + 1 of: MCP Server Card, A2A Agent Card, Agent Skills, API Catalog |
| 5 | Agent-Native | L4 + 2 of 3: Web Bot Auth, all integrations, auth metadata (OAuth or Auth.md) |

Personal Agent Protocol (Poppy), DNS-AID and the commerce checks are informational: they do not
change the level. Commerce checks report `neutral` for non-commerce sites — skip them.

## Check → reference map

| Scanner check | Reference |
|---|---|
| `robotsTxt`, `sitemap`, `linkHeaders`, `dnsAid`, `robotsTxtAiRules`, `contentSignals`, `webBotAuth` | [references/discoverability.md](references/discoverability.md) |
| `markdownNegotiation` (+ `llms.txt` / `llms-full.txt`, not scanner checks but recommended) | [references/content-accessibility.md](references/content-accessibility.md) |
| `apiCatalog`, `oauthDiscovery`, `oauthProtectedResource`, `authMd`, `mcpServerCard`, `a2aAgentCard`, `agentSkills`, `webMcp`, `ard`, `personalAgentProtocol` | [references/protocol-discovery.md](references/protocol-discovery.md) |
| `x402`, `mpp`, `ucp`, `acp`, `ap2` | [references/commerce.md](references/commerce.md) |

Upstream skill → reference (all 25 covered): `scan-site` (this file + `scripts/scan.js`),
`robots-txt`, `sitemap`, `link-headers`, `dns-aid`, `ai-rules`, `content-signals`,
`web-bot-auth` → discoverability; `markdown-negotiation`, `llms-txt`, `llms-full-txt` →
content-accessibility; `api-catalog`, `oauth-discovery`, `oauth-protected-resource`, `auth-md`,
`mcp-server-card`, `a2a-agent-card`, `agent-skills`, `webmcp`, `ard`,
`personal-agent-protocol` → protocol-discovery; `ucp`, `x402`, `mpp`, `acp` → commerce.

## Templates and standards status

- [templates/](templates/) holds ready-to-copy starting files laid out as they are served
  (`robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `link-headers.txt`, and
  `.well-known/` documents). All use `example.com` placeholders: **replace every one** and delete
  any template for something the site does not really offer (MCP, A2A, API catalog, OAuth, ARD,
  Poppy are examples of the shape only). The agent-skills `digest` must be recomputed with
  `sha256sum` of the exact served `SKILL.md`.
- Not every file is a standard: `robots.txt`, `sitemap.xml`, `Link` headers, API catalog and the
  OAuth documents are; Content Signals, `llms.txt`, Agent Skills, MCP card, WebMCP, ARD and
  others are drafts or proposals. See [references/standards-status.md](references/standards-status.md)
  and say so to the user when recommending them.

## Beyond the scanner (AEO content basics)

The scanner measures protocol readiness, not whether answer engines can *understand* the pages.
Cheap, high-value additions the upstream skills do not cover: server-rendered/static HTML with
real text (not JS-only, no meta-refresh/JS redirect on `/`), one `<h1>` and descriptive titles,
`<link rel="canonical">`, `hreflang` for multilingual sites, JSON-LD (`Organization`/`Person`,
`WebSite`, `Article`, `FAQPage` where genuine), and concise question-style headings with direct
answers. Suggest these as optional follow-ups; they are not scored by the scanner.
