# skills

A collection of Claude Code **defensive security** skills by **kevops**. Each skill lives in its
own directory (a top-level directory, or nested under a grouping folder like `cves/`, `ghsas/`)
and can be installed individually:

```bash
npx skills add mrkevops/skills@<skill-name>
```

Install every skill in the repo at once with:

```bash
npx skills add mrkevops/skills --all
```

All security skills here are **read-only and detection-only**: they compare versions/configurations
against known advisories and, where safe, inspect certificates or running processes. None of
them exploit, probe destructively, or scan unnamed/unauthorized targets. See each skill's
`SKILL.md` for its exact hard rules.

## Catalog

| Skill | Description |
|---|---|
| [`cve-2026-109618`](cves/cve-2026-109618/SKILL.md) | Checks for CVE-2026-109618, a php-src engine/interpreter-core RCE ("php2shell") that Trivy and `composer audit` miss. |
| [`cve-2026-109619`](cves/cve-2026-109619/SKILL.md) | Checks for CVE-2026-109619, the second php2shell RCE in php-src's engine/interpreter core. |
| [`cve-2026-111943`](cves/cve-2026-111943/SKILL.md) | Checks for CVE-2026-111943 / GO-2026-6809: Go's `crypto/x509` trusting compromised eMudhra intermediate CAs, across go.mod, Dockerfiles, CI, running toolchains and compiled binaries. |
| [`cve-2026-105481`](cves/cve-2026-105481/SKILL.md) | Checks a Node.js project/container against all 10 CVEs fixed in the October 2026 Node.js security releases (named after the lowest CVE ID in that batch — see its `SKILL.md`). |
| [`ghsa-26q8-h657-pf84`](ghsas/ghsa-26q8-h657-pf84/SKILL.md) | Checks a Bun project/container against GHSA-26q8-h657-pf84 (bundled trust store accepting compromised eMudhra CAs) and CVE-2026-111497 (Brotli decoder RCE), both fixed in Bun 1.4.4. |
| [`emudhra-tls-security`](incidents/emudhra-tls-security/SKILL.md) | Checks certificates, chains, trust stores or an authorized HTTPS endpoint against the eMudhra emSign intermediate CA key-compromise incident directly (no single CVE covers it). |
| [`cloudflare-agent-readiness`](aeo/cloudflare-agent-readiness/SKILL.md) | AEO / AI-agent readiness: scans a site you own with Cloudflare's isitagentready.com scanner and consolidates its 25 implementation skills (robots.txt, sitemap, AI bot rules, Content Signals, llms.txt, markdown negotiation, Agent Skills, MCP/A2A, OAuth, commerce) into one fix workflow. Not a security-advisory check. |

`cves/` groups CVE-specific detection skills (`cves/cve-<id>/`); `ghsas/` groups the same for
advisories with no CVE ID (`ghsas/ghsa-<id>/`); `incidents/` groups skills for an incident with
no single advisory ID at all (`incidents/<name>/`); `aeo/` groups answer-engine / agent-readiness
skills (`aeo/<name>/`). None of these folders has a `SKILL.md` of
its own, so none installs as a bundle by name — they're folder conventions for browsing and for
copying a template when adding a new one (see [CONTRIBUTING.md](CONTRIBUTING.md)).

**Every skill must live at the same depth (one directory inside its grouping folder, or
top-level if ungrouped) — never a mix.** The installer (`npx skills add`) stops descending into
subdirectories once it finds a skill shallower than that depth elsewhere in the repo, so a
top-level skill alongside grouped ones would silently hide every grouped skill from the default
`--list`/`--all`/`@name` install. This is why `emudhra-tls-security` lives under `incidents/`
rather than at the repo root even though it's the only thing in that folder.

Use `--all` above to install every skill the repo currently has.

A skill whose name is a CVE ID can still cover more than that one CVE when several share a
fixed-version table and detection engine (see `cve-2026-105481`'s `SKILL.md` for why) — the
directory name is just the anchor identifier, not a scope limit.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to collaborate.

## License

[MIT](LICENSE)
