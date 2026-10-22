# Contributing

Thanks for helping out. This repo is a collection of Claude Code skills; each skill lives in its own
directory and is installable as `mrkevops/skills@<skill-name>`.

## Ways to contribute

- **Report a problem:** open an issue with the skill name, what you ran, what you expected and what
  happened.
- **Update skill data:** e.g. a new PHP engine CVE. Cite the official advisory (GHSA) and NVD entry
  in the PR.
- **Improve a skill:** fix scripts, sharpen `SKILL.md`, add tests.
- **Propose a new skill:** open an issue first to agree on scope.

## Workflow

1. Fork the repo and create a branch from `main` (`feat/<skill>-<change>` or `fix/<skill>-<change>`).
2. Make your change and run the skill's tests.
3. Open a pull request against `main`. Describe what changed and how you tested it.

## Skill layout

A skill is any directory containing a `SKILL.md`. Most are top-level; CVE-detection skills are
grouped under `cves/<cve-id>/` instead (see below) — the grouping folder itself has no `SKILL.md`
and is never an installable unit.

```
<skill-name>/
├── SKILL.md      # required: frontmatter (name, description) + instructions
├── scripts/      # helper scripts the skill runs
├── data/         # data files, with a last-updated date when manually maintained (if separate from SKILL.md's own data.json)
└── tests/        # tests for the scripts; runnable locally, offline by default
```

Guidelines:

- `name` in the frontmatter matches the directory name (kebab-case).
- `description` says **when** to use the skill (trigger conditions), not only what it does.
- Keep `SKILL.md` focused; move bulky reference material into separate files.
- **Helper scripts are written in Node.js**, not Bash/Python/etc. Claude Code users already have
  Node.js available (Claude Code itself requires it), so a Node script runs portably with no extra
  install step. Exception: trivial shell wrappers (e.g. an opt-in Docker test harness) may stay
  Bash if they add no logic of their own.
- Scripts must be safe to run: no network calls or destructive actions beyond what the skill documents.
- Every skill with scripts ships tests runnable with `node --test tests/<file>.test.js`, exiting
  non-zero on failure. Prefer offline tests; make anything needing Docker or network opt-in (see
  `cves/cve-2026-109618/tests` for the pattern: a `check.test.js` run by `node --test`, plus a
  separate opt-in `docker-check.sh`).
- Security skills are **defensive only**: detection and remediation guidance, never exploitation.
- Add the skill to the catalog table in `README.md`.

## Adding a new CVE-detection skill

CVE skills live under `cves/cve-<id>/` and are self-contained — no shared code outside the
directory, so each installs independently. To add one:

1. Copy an existing CVE directory (e.g. `cves/cve-2026-109618/`) to `cves/cve-<year>-<id>/`.
2. Replace `data.json` (advisory, CVSS, fixed versions per branch, and optionally
   `always_vulnerable_branches` / a `version_source` override for a non-PHP target). Verify every
   field against the GHSA/NVD entry and the vendor advisory before adding it — there is no
   automated feed for this.
3. Update `SKILL.md`'s frontmatter (`name` matches the directory) and body.
4. Update `tests/check.test.js` with cases for the new data; the fixtures and `scripts/check.js`
   engine are generic and usually need no changes for another PHP-engine CVE.
5. Add the new skill to the catalog table in `README.md`.

## Pull request checklist

- [ ] Tests pass (`node --test tests/<file>.test.js` in the skill's directory)
- [ ] `SKILL.md` frontmatter is valid and `description` states trigger conditions
- [ ] Data changes cite official sources
- [ ] `README.md` catalog updated (new skills)
- [ ] No secrets or credentials committed

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
