// Tests for scripts/check.js. Fully offline: generates throwaway self-signed certs with openssl
// (skipped if openssl isn't on PATH) and a local TLS server for --url. Run with:
// node --test tests/check.test.js
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const tls = require('node:tls')
const { execFile, execFileSync } = require('node:child_process')
const { promisify } = require('node:util')
const execFileAsync = promisify(execFile)

const HERE = __dirname
const CHECK = path.join(HERE, '..', 'scripts', 'check.js')

let haveOpenssl = true
try { execFileSync('openssl', ['version'], { stdio: 'ignore' }) } catch { haveOpenssl = false }

// Async throughout: a synchronous child-process wait would stall this process's event loop, and
// with it the in-process TLS server the --url test uses as a fixture.
async function run(args) {
  try {
    const { stdout } = await execFileAsync('node', [CHECK, ...args])
    return { code: 0, out: stdout }
  } catch (e) {
    return { code: e.code, out: (e.stdout || '') + (e.stderr || '') }
  }
}

function selfSignedCert(cn, dir, name) {
  const keyFile = path.join(dir, `${name}.key`)
  const certFile = path.join(dir, `${name}.crt`)
  execFileSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-keyout', keyFile, '-out', certFile, '-days', '1', '-nodes', '-subj', `/CN=${cn}`], { stdio: 'ignore' })
  return { keyFile, certFile }
}

test('--pem flags a cert chaining through the affected root', { skip: !haveOpenssl && 'openssl not available' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emudhra-pem-'))
  try {
    const { certFile } = selfSignedCert('emSign ECC Root CA - G3', dir, 'affected')
    const { code, out } = await run(['--pem', certFile])
    assert.equal(code, 1)
    assert.match(out, /POTENTIALLY_AFFECTED/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('--pem flags an emSign-branded cert that is not the exact root as insufficient evidence', { skip: !haveOpenssl && 'openssl not available' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emudhra-pem-'))
  try {
    const { certFile } = selfSignedCert('emSign Something Unrelated', dir, 'brand')
    const { code, out } = await run(['--pem', certFile])
    assert.equal(code, 3)
    assert.match(out, /INSUFFICIENT_EVIDENCE/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('--pem reports an unrelated cert as NOT_AFFECTED', { skip: !haveOpenssl && 'openssl not available' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emudhra-pem-'))
  try {
    const { certFile } = selfSignedCert('Example Trusted Root', dir, 'unrelated')
    const { code, out } = await run(['--pem', certFile])
    assert.equal(code, 0)
    assert.match(out, /NOT_AFFECTED/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('--pem on a file with no certificates is a usage error', async () => {
  const tmp = path.join(os.tmpdir(), `not-a-cert-${process.pid}.pem`)
  fs.writeFileSync(tmp, 'this is not a PEM file')
  try {
    const { code, out } = await run(['--pem', tmp])
    assert.equal(code, 2)
    assert.match(out, /no PEM certificates found/)
  } finally { fs.rmSync(tmp, { force: true }) }
})

test('--store scans a bundle file the same way --pem does', { skip: !haveOpenssl && 'openssl not available' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emudhra-store-'))
  try {
    const a = selfSignedCert('Example Trusted Root', dir, 'a')
    const b = selfSignedCert('emSign ECC Root CA - G3', dir, 'b')
    const bundle = path.join(dir, 'bundle.pem')
    fs.writeFileSync(bundle, fs.readFileSync(a.certFile, 'utf8') + fs.readFileSync(b.certFile, 'utf8'))
    const { code, out } = await run(['--store', bundle, '--json'])
    assert.equal(code, 1)
    const report = JSON.parse(out)
    assert.equal(report.results.length, 2)
    assert.ok(report.results.some((r) => r.status === 'POTENTIALLY_AFFECTED'))
    assert.ok(report.results.some((r) => r.status === 'NOT_AFFECTED'))
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('missing mode is a usage error', async () => {
  const { code, out } = await run([])
  assert.equal(code, 2)
  assert.match(out, /Usage/)
})

test('--json never claims CONFIRMED_EXPOSURE or MITIGATED', { skip: !haveOpenssl && 'openssl not available' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emudhra-pem-'))
  try {
    const { certFile } = selfSignedCert('emSign ECC Root CA - G3', dir, 'affected')
    const { out } = await run(['--pem', certFile, '--json'])
    assert.ok(!out.includes('CONFIRMED_EXPOSURE'))
    assert.ok(!out.includes('"status":"MITIGATED"'))
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('--url inspects the chain presented by a local TLS server', { skip: !haveOpenssl && 'openssl not available' }, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emudhra-url-'))
  const { keyFile, certFile } = selfSignedCert('emSign ECC Root CA - G3', dir, 'server')
  const server = tls.createServer({ key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) }, (socket) => socket.end())
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  t.after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }) })

  const { code, out } = await run(['--url', `127.0.0.1:${port}`])
  assert.equal(code, 1)
  assert.match(out, /POTENTIALLY_AFFECTED/)
})
