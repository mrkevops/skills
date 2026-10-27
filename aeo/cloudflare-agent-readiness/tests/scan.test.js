// Tests for scripts/scan.js. Fully offline (uses a saved scanner response). Run with:
// node --test tests/scan.test.js
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const execFileAsync = promisify(execFile)

const ROOT = path.join(__dirname, '..')
const SCAN = path.join(ROOT, 'scripts', 'scan.js')
const FIXTURE = path.join(__dirname, 'fixtures', 'scan-not-ready.json')
const { analyze, REF } = require(SCAN)

async function run(args) {
  try {
    const { stdout } = await execFileAsync('node', [SCAN, ...args])
    return { code: 0, stdout }
  } catch (error) {
    return { code: error.code, stdout: error.stdout, stderr: error.stderr }
  }
}

test('analyze: level 0 fixture orders level-1 fixes first', () => {
  const result = analyze(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')))
  assert.equal(result.level, 0)
  assert.equal(result.plan[0].stage, 'Level 1')
  assert.deepEqual(result.plan[0].items.map((i) => i.key), ['robotsTxt', 'sitemap', 'linkHeaders'])
  assert.ok(result.failing.includes('markdownNegotiation'))
  assert.deepEqual(result.unmappedChecks, [])
})

test('analyze: neutral commerce checks are listed but not counted as failing', () => {
  const result = analyze(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')))
  assert.ok(!result.failing.includes('x402'))
  assert.equal(result.isCommerce, false)
})

test('every mapped check points at an existing reference file', () => {
  for (const [key, [file]] of Object.entries(REF)) {
    assert.ok(fs.existsSync(path.join(ROOT, 'references', file)), `${key} -> ${file}`)
  }
})

test('cli --from-file prints a plan and exits 1 when checks fail', async () => {
  const { code, stdout } = await run(['--from-file', FIXTURE])
  assert.equal(code, 1)
  assert.match(stdout, /level 0 \(Not Ready\)/)
  assert.match(stdout, /references\/discoverability\.md -> robots\.txt/)
})

test('cli --json is parseable', async () => {
  const { stdout } = await run(['--from-file', FIXTURE, '--json'])
  assert.equal(JSON.parse(stdout).levelName, 'Not Ready')
})

test('cli rejects a missing or non-http URL with exit 2', async () => {
  assert.equal((await run([])).code, 2)
  assert.equal((await run(['ftp://example.com'])).code, 2)
})

test('cli exits 2 on a file that is not a scan response', async () => {
  const bad = path.join(__dirname, 'fixtures', 'not-a-scan.json')
  fs.writeFileSync(bad, '{}')
  try { assert.equal((await run(['--from-file', bad])).code, 2) } finally { fs.unlinkSync(bad) }
})

test('templates: JSON files parse and robots.txt/sitemap keep their required directives', () => {
  const dir = path.join(ROOT, 'templates')
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])
  for (const file of walk(dir)) {
    const base = path.basename(file)
    if (base.endsWith('.json') || ['api-catalog', 'oauth-protected-resource'].includes(base)) {
      assert.doesNotThrow(() => JSON.parse(fs.readFileSync(file, 'utf8')), file)
    }
  }
  const robots = fs.readFileSync(path.join(dir, 'robots.txt'), 'utf8')
  for (const needle of ['Content-Signal:', 'OAI-SearchBot', 'GPTBot', 'Sitemap:']) {
    assert.ok(robots.includes(needle), needle)
  }
  assert.match(fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8'), /<urlset[^>]+sitemaps\.org/)
  assert.match(fs.readFileSync(path.join(dir, 'llms.txt'), 'utf8'), /^# /)
})
