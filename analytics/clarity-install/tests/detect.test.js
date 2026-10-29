'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { detect } = require('../scripts/detect.js');

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clarity-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

test('Next.js app router with pnpm', () => {
  const dir = project({
    'package.json': JSON.stringify({ dependencies: { next: '15', react: '19' } }),
    'pnpm-lock.yaml': '',
    'tsconfig.json': '{}',
    'src/app/layout.tsx': 'export default function L(){}',
  });
  const r = detect(dir);
  assert.equal(r.framework, 'nextjs');
  assert.equal(r.packageManager, 'pnpm');
  assert.equal(r.installCommand, 'pnpm add @microsoft/clarity');
  assert.equal(r.entryPoint, 'src/app/layout.tsx');
  assert.equal(r.env.name, 'NEXT_PUBLIC_CLARITY_PROJECT_ID');
  assert.equal(r.typescript, true);
});

test('Vite + React uses VITE_ env var', () => {
  const dir = project({
    'package.json': JSON.stringify({ dependencies: { react: '19' }, devDependencies: { vite: '6' } }),
    'package-lock.json': '{}',
    'src/main.jsx': '',
  });
  const r = detect(dir);
  assert.equal(r.framework, 'react');
  assert.equal(r.env.name, 'VITE_CLARITY_PROJECT_ID');
  assert.equal(r.entryPoint, 'src/main.jsx');
});

test('plain HTML site recommends script tag', () => {
  const dir = project({ 'index.html': '<html></html>' });
  const r = detect(dir);
  assert.equal(r.framework, 'static-html');
  assert.equal(r.recommendation, 'script-tag');
  assert.equal(r.installCommand, null);
});

test('detects already-installed package and existing init', () => {
  const dir = project({
    'package.json': JSON.stringify({ dependencies: { vue: '3', '@microsoft/clarity': '1.0.2' } }),
    'src/main.ts': "import Clarity from '@microsoft/clarity'; Clarity.init('x');",
  });
  const r = detect(dir);
  assert.equal(r.alreadyInstalled, true);
  assert.equal(r.installCommand, null);
  assert.deepEqual(r.existingMentions, ['src/main.ts'.replace(/\//g, path.sep)]);
});

test('empty directory is unknown', () => {
  const r = detect(project({}));
  assert.equal(r.framework, 'unknown');
  assert.equal(r.hasPackageJson, false);
});
