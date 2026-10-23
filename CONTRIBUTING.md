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

A skill is any directory containing a `SKILL.md`. A skill tied to one or more CVEs is grouped
under `cves/cve-<id>/`; one tied to an advisory with no CVE ID (a GHSA-only advisory) is grouped
under `ghsas/ghsa-<id>/` instead, following the exact same convention. A skill tied to neither —
an incident with no single advisory ID, like a CA key compromise — stays top-level. Either way,
the grouping folder itself (`cves/`, `ghsas/`) has no `SKILL.md` and is never an installable
unit; it's purely a browsing/template convention.

When several CVEs share the same fixed-version table and detection engine (e.g. a batch of bugs
fixed together in one language runtime's security release), they belong in **one** skill
directory, not one per CVE — splitting them would duplicate the same engine for no benefit, and
the whole point of a single release is that users ask about it as one thing. Name that directory
after the lowest/first-reserved CVE ID in the batch, and say explicitly in `SKILL.md` (and the
catalog description) that the directory covers more than its name — see
`cves/cve-2026-105481/SKILL.md` for the pattern.

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
- Scripts must be safe to run: read-only by default, no destructive actions, no exploitation,
  and no scanning of a network target the caller didn't explicitly name. A script that connects
  anywhere (e.g. to read an HTTPS endpoint's own certificate) must document exactly what it
  sends and never anything beyond a plain, standard handshake/request.
- Every skill with scripts ships tests runnable with `node --test tests/<file>.test.js`, exiting
  non-zero on failure. Prefer offline tests; make anything needing Docker or network opt-in (see
  `cves/cve-2026-109618/tests` for the pattern: a `check.test.js` run by `node --test`, plus a
  separate opt-in `docker-check.sh`).
- Security skills are **defensive only**: detection and remediation guidance, never exploitation.
- Add the skill to the catalog table in `README.md`.

## Adding a new CVE/GHSA-detection skill

`cves/cve-<id>/` and `ghsas/ghsa-<id>/` skills are self-contained — no shared code outside the
directory, so each installs independently. To add one:

1. Copy an existing directory of the same kind (e.g. `cves/cve-2026-109618/` for a version-only
   PHP-style check, `cves/cve-2026-111943/` for a multi-source toolchain check with contextual
   TLS inspection, `ghsas/ghsa-26q8-h657-pf84/` for a GHSA with no CVE) to
   `cves/cve-<year>-<id>/` or `ghsas/ghsa-<id>/`.
2. Replace `data.json` (advisory, CVSS/severity, fixed versions, and whatever detection
   parameters the engine needs — e.g. `version_source`, `usage_hints`, `always_vulnerable_branches`).
   Verify every field against the GHSA/NVD entry and the vendor advisory before adding it — there
   is no automated feed for this. **Never fabricate identifiers** (fingerprints, serials, hashes)
   that aren't actually published by an official source — say so explicitly as a limitation
   instead.
3. Update `SKILL.md`'s frontmatter (`name` matches the directory) and body, including the
   `description`'s trigger conditions.
4. Update `tests/check.test.js` with cases for the new data: at least an affected version, a
   mitigated version, an EOL/unsupported-branch case, and an unparseable/insufficient-evidence
   case. Keep tests fully offline by default.
5. Add the new skill to the catalog table in `README.md`.

## Result classification

Security-check scripts classify each finding as one of: `NOT_AFFECTED`, `POTENTIALLY_AFFECTED`,
`CONFIRMED_EXPOSURE`, `MITIGATED`, or `INSUFFICIENT_EVIDENCE`. A version below a fix is evidence
of *potential* exposure, never proof of compromise — don't let a script or its `SKILL.md` imply
otherwise. In practice, none of the skills in this repo emit `CONFIRMED_EXPOSURE`: confirming
actual exploitation would require intrusive checks that are out of scope here (see "Scripts must
be safe to run" above, and each skill's own "Hard rule(s)" section in its `SKILL.md`).

## Pull request checklist

- [ ] Tests pass (`node --test tests/<file>.test.js` in the skill's directory)
- [ ] `SKILL.md` frontmatter is valid and `description` states trigger conditions
- [ ] Data changes cite official sources
- [ ] `README.md` catalog updated (new skills)
- [ ] No secrets or credentials committed

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
