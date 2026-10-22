# Contributing

Thanks for helping out. This repo is a collection of Claude Code skills; each skill lives in its own
top-level directory and is installable as `mrkevops/skills@<skill-name>`.

## Ways to contribute

- **Report a problem:** open an issue with the skill name, what you ran, what you expected and what
  happened.
- **Update skill data:** e.g. a new PHP engine CVE for `php-engine-cve-check`. Cite the official
  advisory (GHSA) and NVD entry in the PR.
- **Improve a skill:** fix scripts, sharpen `SKILL.md`, add tests.
- **Propose a new skill:** open an issue first to agree on scope.

## Workflow

1. Fork the repo and create a branch from `main` (`feat/<skill>-<change>` or `fix/<skill>-<change>`).
2. Make your change and run the skill's tests.
3. Open a pull request against `main`. Describe what changed and how you tested it.

## Skill layout

```
<skill-name>/
├── SKILL.md      # required: frontmatter (name, description) + instructions
├── scripts/      # helper scripts the skill runs
├── data/         # data files, with a last-updated date when manually maintained
└── tests/        # tests for the scripts; runnable locally, offline by default
```

Guidelines:

- `name` in the frontmatter matches the directory name (kebab-case).
- `description` says **when** to use the skill (trigger conditions), not only what it does.
- Keep `SKILL.md` focused; move bulky reference material into separate files.
- Scripts must be safe to run: no network calls or destructive actions beyond what the skill documents.
- Every skill with scripts ships a `tests/run-tests.sh` that exits non-zero on failure. Prefer
  offline tests; make anything needing Docker or network opt-in (see `php-engine-cve-check/tests`).
- Security skills are **defensive only**: detection and remediation guidance, never exploitation.
- Add the skill to the catalog table in `README.md`.

## Pull request checklist

- [ ] Tests pass (`<skill>/tests/run-tests.sh`)
- [ ] `SKILL.md` frontmatter is valid and `description` states trigger conditions
- [ ] Data changes cite official sources
- [ ] `README.md` catalog updated (new skills)
- [ ] No secrets or credentials committed

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
