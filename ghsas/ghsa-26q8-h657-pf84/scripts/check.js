#!/usr/bin/env node
// Detects exposure to GHSA-26q8-h657-pf84 (Bun trusts compromised eMudhra intermediate CAs) and
// CVE-2026-111497 (Brotli decoder OOB write), both fixed in Bun 1.4.4. Detection only: never
// exploits, never crafts a payload, even against the user's own systems.
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { execFileSync, spawnSync } = require('node:child_process')
const { parseArgs } = require('node:util')

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data.json'), 'utf8'))

const USAGE = `Usage: check.js <mode> [options] [--json]
  --repo <path>          scan package.json, bunfig.toml and Dockerfiles under <path>
                         (also runs the heuristic usage scan described below)
  --local                run the local 'bun' binary (bun --version)
  --docker <service>     docker compose exec <service> bun --version
    --compose-file <f>   (optional) pass -f <f> to docker compose
  --binary <path>        best-effort check for a bun-compiled executable (bun build --compile)
  --version <x.y.z>      check an explicit version string
  --json                 machine-readable output

Statuses: NOT_AFFECTED, POTENTIALLY_AFFECTED, MITIGATED, INSUFFICIENT_EVIDENCE.
Exit codes: 0 all mitigated, 1 at least one potentially affected, 2 usage/error,
3 insufficient evidence only.`

// --- version parsing & classification -------------------------------------------------------

function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec((v || '').trim())
  if (!m) return null
  return { major: +m[1], minor: +m[2], patch: +m[3] }
}

function compareTriplet(a, b) { return a.major - b.major || a.minor - b.minor || a.patch - b.patch }

function usageHintFound(issue, text) {
  return (issue.usage_hints || []).some((pattern) => new RegExp(pattern, 'i').test(text))
}

function evaluate(versionStr, scannedText) {
  const v = parseVersion(versionStr)
  if (!v) return DATA.issues.map((issue) => ({ issue: issue.id, severity: issue.severity, status: 'INSUFFICIENT_EVIDENCE', reason: 'unparseable version string', advisory: issue.advisory }))
  const fixed = parseVersion(DATA.fixed_version)
  const mitigated = compareTriplet(v, fixed) >= 0
  return DATA.issues.map((issue) => {
    if (mitigated) return { issue: issue.id, severity: issue.severity, status: 'MITIGATED', reason: `meets fixed version ${DATA.fixed_version}`, advisory: issue.advisory }
    let reason = `below the fixed version ${DATA.fixed_version}`
    if (scannedText !== undefined) {
      const hit = usageHintFound(issue, scannedText)
      reason += hit
        ? '. Heuristic scan found code patterns related to this issue (not proof of reachability).'
        : '. Heuristic scan found no related code patterns; absence of a match is not proof of safety (default-trust-store TLS and Brotli-over-HTTP can both apply with no direct API call to grep for).'
    }
    return { issue: issue.id, severity: issue.severity, status: 'POTENTIALLY_AFFECTED', reason, advisory: issue.advisory }
  })
}

// --- detection sources ----------------------------------------------------------------------

function findFiles(root, matcher, maxFiles = 2000) {
  const out = []
  const stack = [root]
  const skipDirs = new Set(['.git', 'node_modules', 'dist', 'build'])
  while (stack.length && out.length < maxFiles) {
    const dir = stack.pop()
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.bun-version') continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) { if (!skipDirs.has(e.name)) stack.push(full) }
      else if (matcher(e.name)) out.push(full)
    }
  }
  return out
}

function scanRepoVersions(root) {
  const detections = []
  const bunVersionFile = path.join(root, '.bun-version')
  if (fs.existsSync(bunVersionFile)) detections.push({ source: '.bun-version', path: bunVersionFile, version: fs.readFileSync(bunVersionFile, 'utf8').trim() })

  const pkgFile = path.join(root, 'package.json')
  if (fs.existsSync(pkgFile)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'))
      const pm = /^bun@([\d.]+)/.exec(pkg.packageManager || '')
      if (pm) detections.push({ source: 'package.json packageManager', path: pkgFile, version: pm[1] })
    } catch { /* malformed package.json; skip */ }
  }

  for (const file of findFiles(root, (n) => /^Dockerfile/i.test(n))) {
    const text = fs.readFileSync(file, 'utf8')
    for (const m of text.matchAll(/^\s*FROM\s+(?:oven\/bun|bun):([0-9][\w.-]*)/gim)) {
      detections.push({ source: 'Dockerfile FROM', path: file, version: m[1] })
    }
  }

  return detections
}

function readScannedText(root) {
  let text = ''
  const files = findFiles(root, (n) => /\.(js|mjs|cjs|ts|jsx|tsx|json|toml|ya?ml)$/i.test(n) || /^Dockerfile/i.test(n), 1000)
  for (const file of files) {
    try {
      const stat = fs.statSync(file)
      if (stat.size > 1_000_000) continue
      text += fs.readFileSync(file, 'utf8') + '\n'
      if (text.length > 5_000_000) break
    } catch { /* unreadable; skip */ }
  }
  return text
}

function getLocalVersion() { return execFileSync('bun', ['--version'], { encoding: 'utf8', timeout: 10_000 }).trim() }

function getDockerVersion(service, composeFile) {
  const args = ['compose']
  if (composeFile) args.push('-f', composeFile)
  args.push('exec', '-T', service, 'bun', '--version')
  const res = spawnSync('docker', args, { encoding: 'utf8', timeout: 15_000 })
  if (res.error) throw res.error
  if (res.status !== 0) throw new Error(`docker compose exec failed: ${(res.stderr || '').trim()}`)
  return res.stdout.trim()
}

// Best-effort only: there is no documented, reliable way to read a bun-compiled executable's
// embedded Bun version. This looks for marker strings that suggest the file IS one (so it can be
// flagged for a rebuild), but does not claim to extract an exact version.
function inspectBinary(binaryPath) {
  if (!fs.existsSync(binaryPath)) throw new Error(`no such file: ${binaryPath}`)
  let strings
  try { strings = execFileSync('strings', [binaryPath], { encoding: 'utf8', timeout: 15_000, maxBuffer: 64 * 1024 * 1024 }) }
  catch (e) { throw new Error(`'strings' not available to inspect the binary: ${e.message}`) }
  const versionMatch = /Bun v(\d+\.\d+\.\d+)/.exec(strings)
  const looksLikeBun = versionMatch || /\bBun\.js\b/.test(strings) || /bun-compile-marker/.test(strings)
  return { looksLikeCompiledBun: Boolean(looksLikeBun), embeddedVersionGuess: versionMatch ? versionMatch[1] : null }
}

// --- CLI --------------------------------------------------------------------------------------

async function main() {
  let values
  try {
    const args = parseArgs({
      allowPositionals: false,
      options: {
        repo: { type: 'string' },
        local: { type: 'boolean' },
        docker: { type: 'string' },
        'compose-file': { type: 'string' },
        binary: { type: 'string' },
        version: { type: 'string' },
        json: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    })
    values = args.values
    if (values.help) { console.log(USAGE); return }
    const modes = ['repo', 'local', 'docker', 'binary', 'version'].filter((m) => values[m] !== undefined)
    if (modes.length !== 1) throw new Error('pass exactly one of --repo, --local, --docker, --binary, --version')
  } catch (error) {
    console.error(`error: ${error.message}\n\n${USAGE}`)
    process.exitCode = 2
    return
  }

  if (values.binary !== undefined) {
    try {
      const info = inspectBinary(values.binary)
      const out = { binary: values.binary, ...info,
        note: 'Best-effort heuristic: there is no reliable, documented way to read a bun-compiled executable\'s exact embedded version. A positive match only means this looks like a Bun-compiled binary and should be rebuilt with Bun >=1.4.4 to be sure.' }
      if (values.json) console.log(JSON.stringify({ ...out, exit_code: info.looksLikeCompiledBun ? 3 : 0 }))
      else {
        console.log(info.looksLikeCompiledBun
          ? `This looks like a Bun-compiled executable${info.embeddedVersionGuess ? ` (possible version: ${info.embeddedVersionGuess})` : ''}. Rebuild with Bun >=1.4.4 to be sure it includes both fixes.`
          : 'No evidence this is a Bun-compiled executable.')
        console.log(out.note)
      }
      process.exitCode = info.looksLikeCompiledBun ? 3 : 0
    } catch (error) {
      console.error(`error: ${error.message}`)
      process.exitCode = 2
    }
    return
  }

  let detections = []
  let scannedText
  try {
    if (values.repo !== undefined) { detections = scanRepoVersions(values.repo); scannedText = readScannedText(values.repo) }
    else if (values.local) detections = [{ source: 'local bun binary', version: getLocalVersion() }]
    else if (values.docker !== undefined) detections = [{ source: `docker:${values.docker}`, version: getDockerVersion(values.docker, values['compose-file']) }]
    else if (values.version !== undefined) detections = [{ source: 'explicit', version: values.version }]
  } catch (error) {
    console.error(`error: ${error.message}`)
    process.exitCode = 2
    return
  }

  detections = detections.filter((d) => parseVersion(d.version))
  if (detections.length === 0) {
    console.error('error: no parseable Bun version evidence found')
    process.exitCode = 2
    return
  }

  const bySource = detections.map((d) => ({ source: d.source, path: d.path, version: d.version, findings: evaluate(d.version, scannedText) }))
  const rank = { POTENTIALLY_AFFECTED: 1, INSUFFICIENT_EVIDENCE: 3, MITIGATED: 0, NOT_AFFECTED: 0 }
  const exitCode = Math.max(...bySource.flatMap((s) => s.findings.map((f) => rank[f.status])), 0)

  if (values.json) {
    console.log(JSON.stringify({
      fixed_version: DATA.fixed_version, results: bySource,
      limitations: [
        'Usage-hint matches come from a plain-text grep, not real static analysis.',
        'Default-trust-store TLS connections and Brotli-over-HTTP can apply with no direct API call to grep for; a usage-hint miss is not proof of safety.',
        'No official SHA-256/serial list for the 8 compromised eMudhra intermediates was found; this skill does not attempt exact-key matching. See the emudhra-tls-security skill for a dedicated, broader check.',
      ],
      exit_code: exitCode,
    }))
  } else {
    console.log(`Bun security issues fixed in ${DATA.fixed_version}: GHSA-26q8-h657-pf84, CVE-2026-111497`)
    console.log(`Data last updated: ${DATA.last_updated}`)
    for (const s of bySource) {
      console.log()
      console.log(`${s.source}${s.path ? ` (${s.path})` : ''}: ${s.version}`)
      for (const f of s.findings) console.log(`  ${f.status.padEnd(20)} ${f.issue} [${f.severity}] -- ${f.reason}`)
    }
  }
  process.exitCode = exitCode
}

main()
