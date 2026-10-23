---
name: emudhra-tls-security
description: Check X.509 certificates, chains, trust stores or HTTPS endpoints (that the user explicitly authorizes) against the October 2026 eMudhra (emSign) intermediate CA private-key compromise. Use when the user asks if their certificates or trust stores are affected by the eMudhra incident, or wants to check a specific endpoint/CA bundle they own or are authorized to inspect.
---

# emudhra-tls-security

Checks for exposure to the **eMudhra emSign intermediate CA private-key compromise** (disclosed
2026-10-20): eight intermediate CA certificates — six TLS, two code-signing — chaining to the
root `emSign ECC Root CA - G3` had their private keys compromised. Full incident data, timeline
and citations live in [data.json](data.json).

**This incident has no single universal CVE.** It produced ecosystem-specific advisories
instead — [CVE-2026-111943 / GO-2026-6809](../../cves/cve-2026-111943/SKILL.md) for Go and
[GHSA-26q8-h657-pf84](../../ghsas/ghsa-26q8-h657-pf84/SKILL.md) for Bun. This skill checks the
incident itself (certificates, chains, trust stores), independent of any one runtime — use it
alongside those two when the stack includes Go or Bun.

## The hard limit on what this skill can confirm

**No official SHA-256 fingerprint, serial number or SPKI hash list for the 8 specific
compromised intermediates was published** in any source checked (Google's and Cloudflare's own
incident posts, CCADB, Mozilla's bug tracker). The only concrete, citable identifier available
is the root's name, `emSign ECC Root CA - G3`. So:

- A certificate/chain that matches that root by name is reported `POTENTIALLY_AFFECTED` — it
  chains through the implicated root, which is real signal, but it is **not** confirmation that
  this exact certificate is one of the 8 compromised ones.
- This skill **never reports `CONFIRMED_EXPOSURE`**, and never will until an official
  fingerprint/serial list exists to match against.
- For a live, continuously-updated, officially maintained check, point the user at
  **https://emudhra.we-have-a-problem.com** (maintained by Mozilla's Dennis Jackson, cited by
  Cloudflare's incident post) — and note its own caveat: it only tests the verification path
  being exercised (e.g. a browser or curl), not necessarily the path a background service uses.

## Workflow

1. Pick the right input — never scan a target the user hasn't named and authorized:
   ```bash
   node scripts/check.js --pem ./chain.pem              # a chain/bundle file you have
   node scripts/check.js --store /etc/ssl/certs/ca-certificates.crt   # a trust-store file
   node scripts/check.js --url example.com               # an HTTPS endpoint, --url host:port
   node scripts/check.js --pem ./chain.pem --json
   ```
2. Report per certificate found: `POTENTIALLY_AFFECTED` (matches the affected root exactly) /
   `INSUFFICIENT_EVIDENCE` (mentions "emSign" but isn't an exact match — tell the user to verify
   manually) / `NOT_AFFECTED` (scoped to *that* certificate only — never a system-wide claim).
3. `--url` performs a plain TLS handshake with certificate validation disabled, purely to read
   what the server presents — it does not tell you whether the user's actual TLS client (with
   validation enabled) would accept or reject that chain. Say so.
4. Always distinguish "this chain includes the implicated root" from "this system has been
   compromised" — the former is what this skill can show; the latter requires evidence this
   skill does not and cannot collect (no probing, no forged certs, nothing destructive).
5. Point to the remediation list in `data.json` (`remediation`): update/await trust-store
   updates, reissue any of the user's own certs from the affected intermediates, confirm
   services actually reloaded their trust store, never disable verification to work around
   errors.

Exit codes: `0` no match found, `1` at least one potentially-affected match, `2` usage/error,
`3` insufficient evidence only (an "emSign"-brand match that isn't the exact affected root).
Requires Node.js 18+ (uses `crypto.X509Certificate` and `tls.connect`); no other dependencies.

## Hard rules

- **Read-only, and only on what the user names.** `--pem`/`--store` read a local file the user
  points to. `--url` performs a single plain TLS handshake to a host **the user explicitly
  names** — never scans a range, a list of unnamed targets, or anything inferred.
- **No private keys, tokens or credentials are requested or collected.** Only the server's own
  public certificate chain is read.
- **Never fabricate identifiers.** This skill does not invent fingerprints or serial numbers for
  the 8 compromised intermediates — none exist publicly to invent against — and flags that gap
  explicitly in every report rather than papering over it with a guess.

## Tests

`tests/check.test.js` (run with `node --test tests/check.test.js`) covers affected-root/
emSign-brand/unrelated/malformed-input cases for `--pem` and `--store`, and `--url` against a
local throwaway TLS server — all using ephemeral self-signed certs generated with `openssl` at
test time (tests skip gracefully if `openssl` isn't on `PATH`). Fully offline.
