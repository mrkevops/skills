# API, auth & MCP discovery

> Source: condensed from [isitagentready.com](https://isitagentready.com) (Cloudflare's agent-readiness scanner) skills; see the Origin section in [../SKILL.md](../SKILL.md).

Merged from the isitagentready.com skills: `api-catalog`, `oauth-discovery`,
`oauth-protected-resource`, `auth-md`, `mcp-server-card`, `a2a-agent-card`, `agent-skills`,
`webmcp`, `ard`, `personal-agent-protocol`.

**Honesty rule:** publish a document only if what it advertises exists and works. A content/portfolio
site with no API, OAuth server, MCP server or A2A agent should NOT fabricate those documents just
to turn a check green. For such sites the realistic level-4 route is **Agent Skills index** (it can
describe how to read/use the site) and, optionally, WebMCP tools for real on-page actions.

Level 4 needs **one of**: MCP Server Card, A2A Agent Card, Agent Skills, API Catalog.
Level 5 needs 2 of 3: Web Bot Auth, all integrations, auth metadata (OAuth or Auth.md).

## Agent Skills index (`discovery.agentSkills`) — Agent Skills Discovery RFC v0.2.0

Serve JSON at `/.well-known/agent-skills/index.json` (HTTP 200):

```json
{
  "$schema": "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  "skills": [
    {
      "name": "site-overview",
      "type": "skill-md",
      "description": "What this site offers and how to find things on it.",
      "url": "/.well-known/agent-skills/site-overview/SKILL.md",
      "digest": "sha256:<hex of the exact file served>"
    }
  ]
}
```

- `name`: lowercase alphanumeric + hyphens. `type`: `skill-md` or `archive`.
- `digest` is the SHA-256 of the artifact: `sha256sum SKILL.md`. **Recompute on every change.**

## API Catalog (`discovery.apiCatalog`) — RFC 9727

- `/.well-known/api-catalog`, `Content-Type: application/linkset+json`, HTTP 200.
- `linkset` array; each entry has an `anchor` plus `service-desc` (OpenAPI), `service-doc`, and
  optionally `status`.
- Only if the site has a real API.

## MCP Server Card (`discovery.mcpServerCard`) — SEP-1649

- `/.well-known/mcp/server-card.json`, HTTP 200.
- `serverInfo` (`name`, `version`), transport `endpoint` (e.g. `/mcp`), `capabilities`
  (tools/resources/prompts). Only if an MCP server exists at that endpoint.

## A2A Agent Card (`discovery.a2aAgentCard`) — A2A spec

- `/.well-known/agent-card.json`, HTTP 200.
- `name`, `version`, `description`, `supportedInterfaces` (URL + transport), `capabilities`,
  `skills[]` (each `id`, `name`, `description`). Only if an A2A agent exists.

## OAuth / OIDC discovery (`discovery.oauthDiscovery`) — RFC 8414 / OIDC Discovery

- `/.well-known/openid-configuration` or `/.well-known/oauth-authorization-server`.
- `issuer`, `authorization_endpoint`, `token_endpoint`, `jwks_uri`, `grant_types_supported`,
  `response_types_supported`. Only if the site is/has an authorization server.

## OAuth Protected Resource (`discovery.oauthProtectedResource`) — RFC 9728

- `/.well-known/oauth-protected-resource`, HTTP 200.
- `resource`, `authorization_servers[]`; optional `scopes_supported`. Optionally return
  `WWW-Authenticate: Bearer resource_metadata="…"` on 401.

## Auth.md (`discovery.authMd`)

- `/auth.md` served as Markdown, H1 containing `auth.md`.
- Prefer PRM (above) with `resource`, `authorization_servers`, `scopes_supported`,
  `bearer_methods_supported: ["header"]`; AS metadata `issuer` must match PRM.
- With AS metadata, add an `agent_auth` block (`skill`, `register_uri`, ≥1 full registration
  method: ID-JAG, verified email, or anonymous).
- Without OAuth, keep `/auth.md` self-contained (audience, registration endpoint(s), methods,
  credential use).
- **Never probe `POST /agent/auth`** on a live service — it can create accounts or send email.

## WebMCP (`discovery.webMcp`) — detected by loading the page in a browser

- Feature-detect `document.modelContext` (older Chrome: `navigator.modelContext`).
- `await document.modelContext.registerTool({ name, description, inputSchema, execute })`
  for real site actions (search, navigation, data retrieval); pass an `AbortController` signal
  to unregister.
- Declarative: on an existing `<form>` add `toolname`, `tooldescription`, and per-input
  `toolparamdescription`.
- The script must run on page load (hydrated SPA is fine; it must not wait for interaction).

## ARD, Agentic Resource Discovery (`discovery.ard`) — draft v0.9

- `/.well-known/ai-catalog.json`, `Content-Type: application/json`, HTTP 200,
  `Access-Control-Allow-Origin: *`.
- `specVersion` (string, `"1.0"` = ai-catalog data model), `host{displayName,identifier}`,
  non-empty `entries[]`.
- Each entry: `identifier` (`urn:air:<fqdn>:<namespace>:<name>`), `displayName`, `type` (media
  type), **exactly one** of `url` or `data`, plus 2–5 `representativeQueries`.
- Extra pointers: `Agentmap: <url>` in robots.txt; `<link rel="ai-catalog" href="/.well-known/ai-catalog.json">`;
  DNS TXT `_catalog._agents.<domain>` = `url=…`.

## Personal Agent Protocol / Poppy (`discovery.personalAgentProtocol`) — informational only

- `/.well-known/poppy.json` (JSON, not SPA HTML fallback):
  `{"protocol_version":"0.1","organization":{"name":"…","domain":"example.com"},"web":{}}`
- `organization.domain` must match the host (ignoring `www.`).
- Declare agent/API/browser-session interfaces only if implemented; these require `auth.issuer`
  whose RFC 8414 metadata has matching `issuer`, `poppy_domains`, HTTPS `token_endpoint` and
  `revocation_endpoint`. Never put credentials in discovery metadata. Does not affect level.
