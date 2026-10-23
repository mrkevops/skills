// Tests for scripts/check.js. Fully offline: fake 'bun' binary on PATH, synthetic repo fixtures.
// Run with: node --test tests/check.test.js
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFileSync } = require('node:child_process')

const HERE = __dirname
const CHECK = path.join(HERE, '..', 'scripts', 'check.js')
const FIXTURE_BIN = path.join(HERE, 'fixtures', 'bin')

function run(args, env) {
  try {
    const out = execFileSync('node', [CHECK, ...args], { encoding: 'utf8', env: { ...process.env, ...env } })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }
  }
}

test('affected version is potentially affected for both issues', () => {
  const { code, out } = run(['--version', '1.4.2'])
  assert.equal(code, 1)
  assert.match(out, /POTENTIALLY_AFFECTED\s+GHSA-26q8-h657-pf84/)
  assert.match(out, /POTENTIALLY_AFFECTED\s+CVE-2026-111497/)
})

test('mitigated at the fixed version', () => {
  const { code, out } = run(['--version', '1.4.4'])
  assert.equal(code, 0)
  assert.match(out, /MITIGATED/)
  assert.doesNotMatch(out, /POTENTIALLY_AFFECTED/)
})

test('mitigated above the fixed version', () => {
  const { code, out } = run(['--version', '1.5.0'])
  assert.equal(code, 0)
})

test('unparseable version is a usage error (no evidence at all)', () => {
  const { code, out } = run(['--version', 'nope'])
  assert.equal(code, 2)
})

test('missing mode is a usage error', () => {
  const { code, out } = run([])
  assert.equal(code, 2)
  assert.match(out, /Usage/)
})

test('never emits CONFIRMED_EXPOSURE', () => {
  const { out } = run(['--version', '1.0.0', '--json'])
  assert.ok(!out.includes('CONFIRMED_EXPOSURE'))
})

test('--local reads the fake bun binary on PATH', () => {
  const env = { FAKE_BUN_VERSION: '1.4.0', PATH: `${FIXTURE_BIN}:${process.env.PATH}` }
  const { code, out } = run(['--local'], env)
  assert.equal(code, 1)
  assert.match(out, /1\.4\.0/)
})

test('--repo reads package.json packageManager and Dockerfile, plus a usage hint', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bun-repo-'))
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ packageManager: 'bun@1.4.1' }))
    fs.writeFileSync(path.join(dir, 'Dockerfile'), 'FROM oven/bun:1.4.0-slim\n')
    fs.writeFileSync(path.join(dir, 'index.ts'), "const res = await fetch('https://example.com');\n")
    const { code, out } = run(['--repo', dir, '--json'])
    const report = JSON.parse(out)
    assert.equal(code, 1)
    const sources = report.results.map((r) => r.source)
    assert.ok(sources.includes('package.json packageManager'))
    assert.ok(sources.includes('Dockerfile FROM'))
    const pkgResult = report.results.find((r) => r.source === 'package.json packageManager')
    const trust = pkgResult.findings.find((f) => f.issue === 'GHSA-26q8-h657-pf84')
    assert.match(trust.reason, /Heuristic scan found code patterns/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('--binary flags a synthetic bun-marker file as a best-effort match', () => {
  const tmp = path.join(os.tmpdir(), `fake-bun-binary-${process.pid}`)
  fs.writeFileSync(tmp, 'garbage\x00bun-compile-marker\x00Bun v1.4.1 build info\x00more garbage')
  try {
    const { code, out } = run(['--binary', tmp, '--json'])
    const report = JSON.parse(out)
    assert.equal(code, 3)
    assert.equal(report.looksLikeCompiledBun, true)
    assert.match(out, /best-effort/i)
  } finally { fs.rmSync(tmp, { force: true }) }
})

test('--binary finds no evidence in an unrelated file', () => {
  const tmp = path.join(os.tmpdir(), `plain-file-${process.pid}`)
  fs.writeFileSync(tmp, 'just some text with nothing relevant in it')
  try {
    const { code } = run(['--binary', tmp, '--json'])
    assert.equal(code, 0)
  } finally { fs.rmSync(tmp, { force: true }) }
})
