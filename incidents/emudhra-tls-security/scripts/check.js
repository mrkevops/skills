#!/usr/bin/env node
// Checks X.509 certificates/chains/trust stores for the eMudhra emSign intermediate CA key
// compromise incident (see ../data.json). Read-only certificate inspection only: never fetches
// anything beyond a plain TLS handshake to read what a server itself presents, never attempts to
// forge, impersonate or exploit a certificate, even against the user's own systems. --url only
// inspects a host the caller explicitly names -- never scans a network range or unnamed targets.
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const tls = require('node:tls')
const net = require('node:net')
const crypto = require('node:crypto')
const { parseArgs } = require('node:util')

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data.json'), 'utf8'))
const AFFECTED_ROOT = DATA.affected_root_common_name // "emSign ECC Root CA - G3"

const USAGE = `Usage: check.js <mode> [options] [--json]
  --pem <file>           inspect one or more PEM certificates in a file (a chain or bundle)
  --url <host[:port]>    TLS-connect to a host the caller explicitly names and inspect the chain
                         it presents (read-only handshake, certificate validated by default; port 443)
    --timeout <seconds>  connection timeout, default 10, max 60
    --no-verify          read the chain even if it fails validation (self-signed, untrusted root)
  --store <file>         scan a CA bundle/trust-store PEM file for the affected root/brand
  --json                 machine-readable output

Statuses: NOT_AFFECTED, POTENTIALLY_AFFECTED, INSUFFICIENT_EVIDENCE.
(This skill never emits CONFIRMED_EXPOSURE or MITIGATED for a single cert check -- see
"limitations" in --json output for why.)
Exit codes: 0 no match found, 1 at least one potentially-affected match, 2 usage/error,
3 insufficient evidence only (an 'emSign'-brand match that isn't the specific affected root).`

// --- certificate parsing -----------------------------------------------------------------------

function splitPemCertificates(pemText) {
  const matches = pemText.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)
  return matches || []
}

function describeCert(pem, source) {
  let cert
  try { cert = new crypto.X509Certificate(pem) }
  catch (error) { return { source, error: `could not parse certificate: ${error.message}` } }
  return {
    source,
    subject: cert.subject?.replace(/\n/g, ', ') || '',
    issuer: cert.issuer?.replace(/\n/g, ', ') || '',
    subjectCN: /CN=([^,\n]+)/.exec(cert.subject || '')?.[1] || null,
    issuerCN: /CN=([^,\n]+)/.exec(cert.issuer || '')?.[1] || null,
    validTo: cert.validTo,
    fingerprint256: cert.fingerprint256,
  }
}

function classifyCert(c) {
  if (c.error) return { ...c, status: 'INSUFFICIENT_EVIDENCE', reason: c.error }
  const names = [c.subjectCN, c.issuerCN].filter(Boolean)
  if (names.some((n) => n === AFFECTED_ROOT)) {
    return { ...c, status: 'POTENTIALLY_AFFECTED',
      reason: `chains through or is the root '${AFFECTED_ROOT}', the root tied to the eMudhra incident. ${DATA.no_published_identifiers}` }
  }
  if (names.some((n) => /emSign/i.test(n))) {
    return { ...c, status: 'INSUFFICIENT_EVIDENCE',
      reason: `subject/issuer mentions the 'emSign' brand but does not exactly match the affected root ('${AFFECTED_ROOT}'); verify manually against official eMudhra/CCADB records -- this may be an unrelated, unaffected emSign product.` }
  }
  return { ...c, status: 'NOT_AFFECTED', reason: 'no match against the affected root or the emSign brand, for this certificate only' }
}

// --- sources -------------------------------------------------------------------------------------

function inspectPemFile(file) {
  if (!fs.existsSync(file)) throw new Error(`no such file: ${file}`)
  const pems = splitPemCertificates(fs.readFileSync(file, 'utf8'))
  if (pems.length === 0) throw new Error(`no PEM certificates found in ${file}`)
  return pems.map((pem, i) => describeCert(pem, `${file} [cert ${i + 1}/${pems.length}]`))
}

function inspectStoreFile(file) {
  return inspectPemFile(file) // same mechanics; kept as a separate mode for a clearer report label
}

// TLS validation is on by default. Reading the chain of a server whose certificate does not
// validate (self-signed, expired, untrusted root) needs an explicit --no-verify; the connection
// then only reads what the server presents and sends no application data.
function certErrorHint(error) {
  return /CERT|SELF_SIGNED|UNABLE_TO_(GET|VERIFY)|DEPTH_ZERO|HOSTNAME_MISMATCH|ERR_TLS_CERT/i.test(`${error.code} ${error.message}`)
    ? new Error(`${error.message} (certificate did not validate; re-run with --no-verify to read the presented chain anyway)`)
    : error
}

async function inspectUrl(address, timeoutSeconds, noVerify) {
  const hasScheme = /^[a-z]+:\/\//i.test(address)
  const url = new URL(hasScheme ? address : `https://${address}`)
  const port = Number(url.port) || 443
  const isIpLiteral = net.isIP(url.hostname) !== 0
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: url.hostname, port, ...(isIpLiteral ? {} : { servername: url.hostname }),
      rejectUnauthorized: !noVerify,
      timeout: timeoutSeconds * 1000,
    }, () => {
      const chain = []
      let cert = socket.getPeerCertificate(true)
      const seen = new Set()
      while (cert && cert.subject && !seen.has(cert.fingerprint256)) {
        seen.add(cert.fingerprint256)
        chain.push({
          source: `${url.hostname}:${port}`,
          subject: Object.entries(cert.subject).map(([k, v]) => `${k}=${v}`).join(', '),
          issuer: Object.entries(cert.issuer).map(([k, v]) => `${k}=${v}`).join(', '),
          subjectCN: cert.subject?.CN || null,
          issuerCN: cert.issuer?.CN || null,
          validTo: cert.valid_to,
          fingerprint256: cert.fingerprint256,
        })
        cert = cert.issuerCertificate === cert ? null : cert.issuerCertificate
      }
      socket.end()
      resolve(chain.map((c) => ({ ...c, tls_validated: !noVerify && socket.authorized })))
    })
    socket.on('error', (error) => reject(certErrorHint(error)))
    socket.on('timeout', () => { socket.destroy(); reject(new Error('TLS connection timed out')) })
  })
}

// --- CLI -----------------------------------------------------------------------------------------

async function main() {
  let values
  try {
    const args = parseArgs({
      allowPositionals: false,
      options: {
        pem: { type: 'string' },
        url: { type: 'string' },
        store: { type: 'string' },
        timeout: { type: 'string', default: '10' },
        'no-verify': { type: 'boolean' },
        json: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    })
    values = args.values
    if (values.help) { console.log(USAGE); return }
    const modes = ['pem', 'url', 'store'].filter((m) => values[m] !== undefined)
    if (modes.length !== 1) throw new Error('pass exactly one of --pem, --url, --store')
  } catch (error) {
    console.error(`error: ${error.message}\n\n${USAGE}`)
    process.exitCode = 2
    return
  }

  const timeout = Number(values.timeout)
  if (!(timeout > 0 && timeout <= 60)) {
    console.error('error: --timeout must be greater than 0 and at most 60 seconds\n\n' + USAGE)
    process.exitCode = 2
    return
  }

  let certs
  try {
    if (values.pem !== undefined) certs = inspectPemFile(values.pem)
    else if (values.store !== undefined) certs = inspectStoreFile(values.store)
    else certs = await inspectUrl(values.url, timeout, values['no-verify'])
  } catch (error) {
    console.error(`error: ${error.message}`)
    process.exitCode = 2
    return
  }

  const results = certs.map(classifyCert)
  const rank = { POTENTIALLY_AFFECTED: 1, INSUFFICIENT_EVIDENCE: 3, NOT_AFFECTED: 0 }
  const exitCode = results.length ? Math.max(...results.map((r) => rank[r.status])) : 0

  if (values.json) {
    console.log(JSON.stringify({
      incident: DATA.incident_name, affected_root: AFFECTED_ROOT, results,
      limitations: [
        DATA.no_published_identifiers,
        'A root-name match means the certificate chains through the affected root; it does not confirm the specific certificate is one of the 8 compromised intermediates, since no fingerprint/serial list for those 8 is public.',
        values['no-verify']
          ? '--no-verify was used: certificate validation was disabled to read what the server presents, so this does not tell you whether your own TLS client would accept or reject that chain.'
          : '--url validates the chain against this machine\'s trust store (tls_validated); a chain that validates here may still be rejected, or accepted, by a different client or trust store.',
        'NOT_AFFECTED is scoped to the certificate(s) actually examined -- it is not a system-wide or trust-store-wide claim.',
        `For a live, officially maintained check: ${DATA.official_live_test.url} (${DATA.official_live_test.note})`,
      ],
      exit_code: exitCode,
    }))
  } else {
    console.log(`${DATA.incident_name}`)
    console.log(`Affected root: ${AFFECTED_ROOT}. Data last updated: ${DATA.last_updated}.`)
    console.log()
    for (const r of results) {
      console.log(`${r.status.padEnd(20)} ${r.source}`)
      if (!r.error) console.log(`  subject: ${r.subject}\n  issuer:  ${r.issuer}\n  sha256:  ${r.fingerprint256}\n  reason:  ${r.reason}`)
      else console.log(`  ${r.reason}`)
    }
    console.log()
    console.log(`Official live test (your own browser/clients): ${DATA.official_live_test.url}`)
    console.log('Note: no public fingerprint/serial list exists for the 8 compromised intermediates; a root-name match is the strongest signal this skill can give without one.')
  }
  process.exitCode = exitCode
}

main()
