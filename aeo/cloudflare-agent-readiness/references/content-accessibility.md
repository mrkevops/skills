# Content accessibility

> Source: condensed from [isitagentready.com](https://isitagentready.com) (Cloudflare's agent-readiness scanner) skills; see the Origin section in [../SKILL.md](../SKILL.md).

Merged from the isitagentready.com skills: `markdown-negotiation`, `llms-txt`, `llms-full-txt`.

## Markdown content negotiation (`contentAccessibility.markdownNegotiation`) — required for level 3

- A request with `Accept: text/markdown` returns a markdown version of the page with
  `Content-Type: text/markdown`.
- Requests without that header still get HTML.
- Add `x-markdown-tokens: <n>` (token count) when available.
- Add `Vary: Accept` so caches don't serve the wrong representation.
- Cloudflare zones: enable *Markdown for Agents* (no code). Otherwise implement at the edge:
  a CloudFront Function/Lambda@Edge, Worker, or middleware that maps `Accept: text/markdown`
  to a pre-built `.md` twin of each page.
- Static sites: generate `<page>.md` at build time next to each HTML page, and have the edge
  rewrite on `Accept`. Verify with:
  `curl -sI -H 'Accept: text/markdown' https://example.com/ | grep -i content-type`

## llms.txt (not a scanner check; recommended) — llmstxt.org

- Serve `/llms.txt` as UTF-8 plain text, HTTP 200.
- Start with an H1 (`# Site Name`), then a short summary (blockquote or paragraph).
- Link the most important sections/pages (`- [Title](url): one-line description`).
- Optionally link `/llms-full.txt`.

```
# Example

> One-sentence description of what the site/company is and who it is for.

## Pages
- [About](https://example.com/about.md): who we are
- [Services](https://example.com/services.md): what we offer

## Optional
- [Full content](https://example.com/llms-full.txt)
```

## llms-full.txt (not a scanner check; recommended)

- Serve `/llms-full.txt`, UTF-8 plain text, HTTP 200.
- Detailed, structured content covering the key topics/docs; link to it from `/llms.txt`.
- Generate it at build time from the same sources as the pages so it never drifts.
