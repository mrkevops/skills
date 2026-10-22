# skills

A collection of Claude Code skills by **kevops**. Each skill lives in its own directory (a
top-level directory, or nested under a grouping folder like `cves/`) and can be installed
individually:

```bash
npx skills add mrkevops/skills@<skill-name>
```

Install every skill in the repo at once with:

```bash
npx skills add mrkevops/skills --all
```

## Catalog

| Skill | Description |
|---|---|
| [`cve-2026-109618`](cves/cve-2026-109618/SKILL.md) | Checks for CVE-2026-109618, a php-src engine/interpreter-core RCE ("php2shell") that Trivy and `composer audit` miss. |
| [`cve-2026-109619`](cves/cve-2026-109619/SKILL.md) | Checks for CVE-2026-109619, the second php2shell RCE in php-src's engine/interpreter core. |

`cves/` groups all CVE-detection skills, one self-contained subdirectory per CVE (`cves/cve-<id>/`).
It has no `SKILL.md` of its own, so it never installs as a bundle by name — it's purely a folder
convention for browsing and for copying the template when adding a new CVE (see
[CONTRIBUTING.md](CONTRIBUTING.md)). Use `--all` above to install every skill the repo currently
has, CVE skills included.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to collaborate.

## License

[MIT](LICENSE)
