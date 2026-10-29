#!/usr/bin/env node
// Scans a site the caller explicitly names with the isitagentready.com scanner (Cloudflare's
// agent-readiness scanner) and prints a prioritized fix list mapped to ../references/.
// Network use: exactly one `POST https://isitagentready.com/api/scan` with {"url": <the URL>}.
// Nothing else is sent anywhere; this script never fetches the target site itself and never
// changes anything. --from-file re-reads a saved response fully offline.
'use strict'

const fs = require('node:fs')
const net = require('node:net')
const { parseArgs } = require('node:util')

const API = 'https://isitagentready.com/api/scan'

const USAGE = `Usage: scan.js <url> [--json] [--timeout <seconds>]
       scan.js --from-file <scan.json> [--json]
  <url>                site you own or are authorized to change (http/https)
  --from-file <file>   read a saved scan response instead of calling the API (offline)
  --timeout <seconds>  API timeout, default 60, max 120
  --json               machine-readable output
Exit codes: 0 no failing checks, 1 at least one failing check, 2 usage/error.`

// check key -> [reference file, section hint]
const REF = {
  robotsTxt: ['discoverability.md', 'robots.txt'],
  sitemap: ['discoverability.md', 'sitemap.xml'],
  linkHeaders: ['discoverability.md', 'Link response headers'],
  dnsAid: ['discoverability.md', 'DNS-AID'],
  robotsTxtAiRules: ['discoverability.md', 'AI bot rules'],
  contentSignals: ['discoverability.md', 'Content Signals'],
  webBotAuth: ['discoverability.md', 'Web Bot Auth'],
  markdownNegotiation: ['content-accessibility.md', 'Markdown content negotiation'],
  apiCatalog: ['protocol-discovery.md', 'API Catalog'],
  oauthDiscovery: ['protocol-discovery.md', 'OAuth / OIDC discovery'],
  oauthProtectedResource: ['protocol-discovery.md', 'OAuth Protected Resource'],
  authMd: ['protocol-discovery.md', 'Auth.md'],
  mcpServerCard: ['protocol-discovery.md', 'MCP Server Card'],
  a2aAgentCard: ['protocol-discovery.md', 'A2A Agent Card'],
  agentSkills: ['protocol-discovery.md', 'Agent Skills index'],
  webMcp: ['protocol-discovery.md', 'WebMCP'],
  ard: ['protocol-discovery.md', 'ARD'],
  personalAgentProtocol: ['protocol-discovery.md', 'Personal Agent Protocol'],
  x402: ['commerce.md', 'x402'],
  mpp: ['commerce.md', 'MPP'],
  ucp: ['commerce.md', 'UCP'],
  acp: ['commerce.md', 'ACP'],
  ap2: ['commerce.md', 'AP2'],
}

// Fix order follows the level ladder: L1 -> L2 -> L3 -> L4 (one of) -> L5 -> informational.
const ORDER = [
  ['Level 1', ['robotsTxt', 'sitemap', 'linkHeaders']],
  ['Level 2', ['robotsTxtAiRules', 'contentSignals']],
  ['Level 3', ['markdownNegotiation']],
  ['Level 4 (need only one)', ['agentSkills', 'mcpServerCard', 'a2aAgentCard', 'apiCatalog']],
  ['Level 5', ['webBotAuth', 'oauthDiscovery', 'oauthProtectedResource', 'authMd']],
  ['Informational (no level impact)', ['dnsAid', 'webMcp', 'ard', 'personalAgentProtocol']],
  ['Commerce (only if the site sells/charges)', ['x402', 'mpp', 'ucp', 'acp', 'ap2']],
]

function flatten(scan) {
  const out = {}
  for (const [category, checks] of Object.entries(scan.checks || {})) {
    for (const [key, value] of Object.entries(checks)) {
      out[key] = { category, status: value.status, message: value.message }
    }
  }
  return out
}

function analyze(scan) {
  const checks = flatten(scan)
  const plan = ORDER.map(([stage, keys]) => ({
    stage,
    items: keys
      .filter((key) => checks[key] && checks[key].status !== 'pass')
      .map((key) => ({
        key,
        status: checks[key].status,
        message: checks[key].message,
        reference: REF[key] ? `references/${REF[key][0]} -> ${REF[key][1]}` : null,
      })),
  })).filter((s) => s.items.length)
  const failing = Object.entries(checks).filter(([, c]) => c.status === 'fail').map(([k]) => k)
  const unknown = Object.keys(checks).filter((k) => !REF[k])
  return {
    url: scan.url,
    level: scan.level,
    levelName: scan.levelName,
    nextLevel: scan.nextLevel ? { target: scan.nextLevel.target, name: scan.nextLevel.name } : null,
    isCommerce: Boolean(scan.isCommerce),
    passing: Object.entries(checks).filter(([, c]) => c.status === 'pass').map(([k]) => k),
    failing,
    plan,
    unmappedChecks: unknown,
  }
}

function render(result) {
  const lines = [`${result.url}: level ${result.level} (${result.levelName})`]
  if (result.nextLevel) lines.push(`Next: level ${result.nextLevel.target} (${result.nextLevel.name})`)
  lines.push(`Passing: ${result.passing.join(', ') || 'none'}`, '')
  for (const { stage, items } of result.plan) {
    lines.push(stage)
    for (const i of items) {
      lines.push(`  [${i.status}] ${i.key}: ${i.message}`)
      if (i.reference) lines.push(`         see ${i.reference}`)
    }
  }
  if (!result.isCommerce) lines.push('', 'Not a commerce site: ignore the Commerce group.')
  if (result.unmappedChecks.length) {
    lines.push('', `Unmapped checks (upstream added them?): ${result.unmappedChecks.join(', ')}`)
  }
  return lines.join('\n')
}

// The target is only forwarded to the public scanner, never fetched here, but a private or internal
// host can't be scanned from the internet and would leak internal hostnames to a third party.
function assertPublicTarget(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const internalName = host === 'localhost' || /\.(localhost|local|internal|lan|home|corp)$/.test(host) || !host.includes('.') && !net.isIP(host)
  const v4 = net.isIPv4(host) && /^(0|10|127)\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\.|^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)
  const v6 = net.isIPv6(host) && (host === '::' || host === '::1' || /^f[cd]|^fe[89ab]|^::ffff:/.test(host))
  if (internalName || v4 || v6) throw new Error(`refusing to scan non-public host ${host}`)
}

async function fetchScan(url, timeoutSeconds) {
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(timeoutSeconds * 1000),
  })
  if (!response.ok) throw new Error(`scanner returned HTTP ${response.status}`)
  return response.json()
}

async function main(argv) {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        json: { type: 'boolean' },
        'from-file': { type: 'string' },
        timeout: { type: 'string' },
      },
    })
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  const timeout = values.timeout === undefined ? 60 : Number(values.timeout)
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 120) {
    console.error(`invalid --timeout\n${USAGE}`)
    return 2
  }

  let scan
  try {
    if (values['from-file']) {
      scan = JSON.parse(fs.readFileSync(values['from-file'], 'utf8'))
    } else {
      const [target] = positionals
      let url
      try { url = new URL(target) } catch { url = null }
      if (!url || !['http:', 'https:'].includes(url.protocol)) {
        console.error(USAGE)
        return 2
      }
      assertPublicTarget(url.hostname)
      scan = await fetchScan(url.origin, timeout)
    }
    if (!scan || typeof scan.checks !== 'object') throw new Error('response has no "checks"')
  } catch (error) {
    console.error(`error: ${error.message}`)
    return 2
  }

  const result = analyze(scan)
  console.log(values.json ? JSON.stringify(result, null, 2) : render(result))
  return result.failing.length ? 1 : 0
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code))
}

module.exports = { analyze, render, REF, ORDER }
