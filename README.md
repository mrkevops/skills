# skills

Colección de skills de Claude Code de **kevops**. Cada skill vive en su propio subdirectorio y se
instala individualmente:

```bash
npx skills add mrkevops/skills@<nombre-skill>
```

## Catálogo

| Skill | Descripción |
|---|---|
| [`php-engine-cve-check`](php-engine-cve-check/SKILL.md) | Detecta CVEs del engine/intérprete de PHP (que Trivy y `composer audit` no ven) comparando la versión contra una tabla de advisories de `php-src`. |

## Licencia

[MIT](LICENSE)
