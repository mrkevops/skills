# Commerce

> Source: condensed from [isitagentready.com](https://isitagentready.com) (Cloudflare's agent-readiness scanner) skills; see the Origin section in [../SKILL.md](../SKILL.md).

Merged from the isitagentready.com skills: `ucp`, `x402`, `mpp`, `acp`.

**Only for sites that actually sell something or charge for API/content access.** The scanner
reports these as `neutral` ("not a commerce site") otherwise — leave them alone. Never publish a
payment-discovery document for payment flows that don't exist.

## UCP, Universal Commerce Protocol (`commerce.ucp`)

- `/.well-known/ucp`, HTTP 200. `protocol_version`, `services`, `capabilities`, `endpoints`;
  referenced spec URLs/schemas must be reachable.

## x402 (`commerce.x402`)

- Add x402 middleware (`@x402/express`, `@x402/hono`, `@x402/next`) to paid API routes with a
  facilitator URL and wallet address; protected routes answer HTTP 402 with payment requirements.

## MPP, Machine Payment Protocol (`commerce.mpp`)

- `/openapi.json`, HTTP 200, with `x-payment-info` on payable operations, each declaring
  `intent` (`charge`|`session`), `method` (`tempo`|`stripe`|`lightning`|`card`) and `amount`.
  Optional `currency`, `description`, top-level `x-service-info`.

## ACP, Agentic Commerce Protocol (`commerce.acp`)

- `/.well-known/acp.json`, HTTP 200. `protocol.name = "acp"` + `protocol.version`, absolute
  `api_base_url`, non-empty `transports[]`, non-empty `capabilities.services[]`.

## AP2 (`commerce.ap2`)

No upstream skill. Detected via the A2A Agent Card; reported `neutral` without one.
