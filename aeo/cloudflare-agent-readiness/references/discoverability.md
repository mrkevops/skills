# Discoverability & bot access control

> Source: condensed from [isitagentready.com](https://isitagentready.com) (Cloudflare's agent-readiness scanner) skills; see the Origin section in [../SKILL.md](../SKILL.md).

Merged from the isitagentready.com skills: `robots-txt`, `sitemap`, `link-headers`, `dns-aid`,
`ai-rules`, `content-signals`, `web-bot-auth`. Scanner keys in parentheses.

## robots.txt (`discoverability.robotsTxt`) — RFC 9309

- Serve `/robots.txt` as `text/plain`, HTTP 200 (a soft-404 returning HTML fails).
- Include `User-agent` groups with `Allow`/`Disallow` rules.
- Reference the sitemap: `Sitemap: https://example.com/sitemap.xml`.

## sitemap.xml (`discoverability.sitemap`) — sitemaps.org

- Serve `/sitemap.xml` as valid XML, HTTP 200. The scanner also tries `/sitemap_index.xml`,
  `/sitemap-index.xml` and `/sitemap.xml.gz`.
- List canonical `<url><loc>` for public pages; update it on every publish/removal.
- Reference it from robots.txt.
- Multi-language sites: list every language URL (and `xhtml:link rel="alternate" hreflang`).

## Link response headers (`discoverability.linkHeaders`) — RFC 8288 / RFC 9727 §3

- Return `Link` headers on the **homepage response** pointing to machine-readable resources.
- Registered relations: `api-catalog`, `service-desc`, `service-doc`, `describedby`.
- Example: `Link: </.well-known/api-catalog>; rel="api-catalog"`. Multiple headers or
  comma-separated values are both valid.
- Only advertise resources that exist (a link to a 404 is worse than none). For a site with no
  API, `describedby` → `/llms.txt` or the sitemap is a reasonable honest choice.
- Static hosting: add via the CDN (CloudFront response-headers policy / function, Cloudflare
  Transform Rules or Workers, Netlify `_headers`, Vercel `headers`), not the origin.

## DNS for AI Discovery, DNS-AID (`discoverability.dnsAid`)

- Records under the `_agents` namespace, e.g. `_index._agents.example.com`,
  `_a2a._agents.example.com`.
- ServiceMode `SVCB` (or `HTTPS`) records with `alpn` and endpoint params; experimental params use
  numeric `keyNNNNN` names.
- Sign the zone with DNSSEC.
- Example: `_a2a._agents.example.com. 3600 IN SVCB 1 agent.example.com. alpn="a2a" port=443 mandatory=alpn,port`
- Only publish this if you actually run an agent endpoint. It does not affect the level.

## AI bot rules (`botAccessControl.robotsTxtAiRules`) — RFC 9309

Add explicit `User-agent` groups (a `User-agent: *` group with rules also passes, but applies one
policy to everyone):

| Kind | Agents | Effect of blocking |
|---|---|---|
| AI **search** crawlers | `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot` | You stop appearing in AI answers. |
| AI **training** crawlers | `GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `Bytespider`, `Amazonbot` | No effect on AI search visibility. |
| **User-triggered** fetchers | `ChatGPT-User`, `Claude-User`, `Perplexity-User` | Some vendors do not apply robots.txt to them. |

For AEO the usual policy is: **allow search crawlers**, decide training crawlers by content policy.

## Content Signals (`botAccessControl.contentSignals`) — contentsignals.org / IETF draft

- Add `Content-Signal` under the relevant `User-agent` block in robots.txt.
- Declare all three: `ai-train`, `search`, `ai-input` (`yes`/`no`).
- Example: `Content-Signal: ai-train=no, search=yes, ai-input=yes`.
- `ai-input=yes` is what lets answer engines quote/ground on the content.

Combined robots.txt template:

```
User-agent: *
Allow: /
Content-Signal: ai-train=no, search=yes, ai-input=yes

User-agent: OAI-SearchBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /

User-agent: GPTBot
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: Google-Extended
Disallow: /
User-agent: Applebot-Extended
Disallow: /
User-agent: CCBot
Disallow: /
User-agent: Bytespider
Disallow: /
User-agent: Amazonbot
Disallow: /

Sitemap: https://example.com/sitemap.xml
```

(Flip the training block to `Allow: /` + `ai-train=yes` if the user wants training allowed — ask.)

## Web Bot Auth (`botAccessControl.webBotAuth`) — IETF WebBotAuth WG

Informational (`neutral`) unless the site **operates a bot/agent** that sends signed requests.

- Publish a JWKS with ≥1 public key at `/.well-known/http-message-signatures-directory`.
- Sign outgoing bot requests; include `Signature-Agent` and `Signature-Input` headers.
- Never publish private keys. Required only for level 5.
