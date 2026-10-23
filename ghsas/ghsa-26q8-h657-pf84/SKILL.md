---
name: ghsa-26q8-h657-pf84
description: Check whether a Bun project, binary or container is affected by GHSA-26q8-h657-pf84 (Bun's bundled trust store accepting compromised eMudhra/emSign intermediate CAs) or CVE-2026-111497 (the Brotli decoder RCE, also fixed in Bun 1.4.4). Use when the user asks if their Bun app is vulnerable to either issue, or after auditing a Bun container image.
---

# GHSA-26q8-h657-pf84 (and CVE-2026-111497 for Bun)

**Naming note:** this directory follows the `cves/cve-<id>/` convention, but lives under
`ghsas/` instead because its primary issue, GHSA-26q8-h657-pf84, has **no CVE ID** of its own.
It also covers **CVE-2026-111497** (the Brotli decoder RCE) for Bun specifically — both issues
were fixed together in Bun 1.4.4, and splitting them would duplicate the same
version-detection engine for no benefit. Bun's own instance of CVE-2026-111497 is tracked here,
separately from Node.js's instance of the same CVE ID under
[`cves/cve-2026-105481`](../../cves/cve-2026-105481/SKILL.md) — same CVE number, two different
runtimes' own Brotli implementations, two different fixed-version tables.

Full data — advisory links, CWE, applicability, usage hints — lives in
[data.json](data.json).

| Issue | CVE | Severity | Summary |
|---|---|---|---|
| GHSA-26q8-h657-pf84 | none | High | Bundled trust store accepts certs from 6 revoked eMudhra (emSign) TLS intermediates chaining to `emSign ECC Root CA - G3` |
| CVE-2026-111497 | CVE-2026-111497 | High | Brotli decoder out-of-bounds write (RCE) |

Both fixed in **Bun 1.4.4**.

## Why version alone isn't the whole story

- **GHSA-26q8-h657-pf84** applies to *any* default-trust-store TLS connection (`fetch`, `bun
  install`/`bunx`, `node:https`, `node:tls`, `WebSocket`, `Bun.connect`) — there's no narrow API
  to grep for that rules it out. `--use-system-ca` / `NODE_USE_SYSTEM_CA=1` do **not** mitigate
  it (they add to the bundled roots, they don't replace them). The only real mitigations below
  1.4.4 are upgrading or passing an explicit `ca`/`cafile` that excludes the emSign roots.
- Executables built with `bun build --compile` **embed** the trust store/Brotli code at build
  time. A patched `bun` on the host building them does not help an already-built, unrebuilt
  executable — it must be rebuilt.
- There is no public SHA-256/serial list for the 8 compromised eMudhra intermediates (see the
  [`emudhra-tls-security`](../../incidents/emudhra-tls-security/SKILL.md) skill for the broader
  incident and its citations). This skill cannot
  confirm a specific certificate is one of the 8 — only that Bun's bundled trust store, below
  1.4.4, would have accepted any of them.

## Workflow

1. Gather version evidence and, when a repo path is given, run the heuristic usage scan:
   ```bash
   node scripts/check.js --repo .                     # package.json, .bun-version, Dockerfiles + usage grep
   node scripts/check.js --local                        # installed bun binary
   node scripts/check.js --docker <service>            # docker compose exec <service> bun --version
   node scripts/check.js --version 1.4.2                 # explicit version
   node scripts/check.js --binary ./dist/myapp            # best-effort: looks like bun build --compile output?
   node scripts/check.js --repo . --json
   ```
2. Report per issue: `MITIGATED` / `POTENTIALLY_AFFECTED` / `INSUFFICIENT_EVIDENCE`. Never
   `CONFIRMED_EXPOSURE`.
3. `--binary` is explicitly best-effort: there is no documented, reliable way to read a
   bun-compiled executable's exact embedded version. A positive match ("looks like Bun") is
   enough to recommend a rebuild on Bun ≥1.4.4; don't over-claim the version it guesses.
4. For GHSA-26q8-h657-pf84, a usage-hint miss is weak evidence — the default trust store applies
   whether or not the grep found an obvious TLS call. Say so explicitly in the report.

Exit codes: `0` all mitigated, `1` at least one potentially affected, `2` usage/error, `3`
insufficient evidence only (includes a `--binary` match, since that alone can't confirm a
version). Requires Node.js 18+; `--binary` additionally needs `strings` on `PATH`.

## Hard rule

Read-only detection only: version comparison, a plain-text grep over local files, and (for
`--binary`) reading embedded strings from a file the user already has. Never connects to
anything, never decompresses untrusted data, never presents or forges a certificate.

## Tests

`tests/check.test.js` (run with `node --test tests/check.test.js`) covers affected/mitigated/
unparseable cases for both issues, `--local` against a fake `bun` binary, `--binary` against a
synthetic marker file, and `--repo` against synthetic `package.json`/`Dockerfile`/source
fixtures — fully offline.
