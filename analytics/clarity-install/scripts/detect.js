#!/usr/bin/env node
'use strict';
// Read-only project detector for the clarity-install skill.
// Usage: node detect.js [projectDir]
// Reads package.json, lockfiles and a few well-known file names in projectDir. Makes no network
// calls and writes nothing. Prints one JSON object describing the project.

const fs = require('node:fs');
const path = require('node:path');

const LOCKFILES = [
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
];

// Order matters: meta-frameworks before the UI library they build on.
const FRAMEWORKS = [
  ['next', 'nextjs'],
  ['nuxt', 'nuxt'],
  ['@sveltejs/kit', 'sveltekit'],
  ['astro', 'astro'],
  ['@remix-run/react', 'remix'],
  ['@angular/core', 'angular'],
  ['vue', 'vue'],
  ['svelte', 'svelte'],
  ['react', 'react'],
];

const exists = (dir, rel) => fs.existsSync(path.join(dir, rel));
const firstExisting = (dir, rels) => rels.find((r) => exists(dir, r)) || null;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function detectPackageManager(dir, pkg) {
  for (const [file, pm] of LOCKFILES) if (exists(dir, file)) return pm;
  const declared = pkg && typeof pkg.packageManager === 'string' ? pkg.packageManager.split('@')[0] : null;
  return declared || (pkg ? 'npm' : null);
}

function detectFramework(deps) {
  for (const [dep, name] of FRAMEWORKS) if (dep in deps) return name;
  return null;
}

function entryPoint(dir, framework) {
  const c = {
    nextjs: ['app/layout.tsx', 'app/layout.jsx', 'app/layout.js', 'src/app/layout.tsx', 'src/app/layout.jsx', 'src/app/layout.js', 'pages/_app.tsx', 'pages/_app.jsx', 'pages/_app.js', 'src/pages/_app.tsx', 'src/pages/_app.js'],
    nuxt: ['app.vue', 'app/app.vue', 'plugins'],
    sveltekit: ['src/routes/+layout.svelte', 'src/app.html'],
    astro: ['src/layouts/Layout.astro', 'src/layouts/BaseLayout.astro', 'src/layouts'],
    remix: ['app/root.tsx', 'app/root.jsx', 'app/root.js'],
    angular: ['src/main.ts', 'src/app/app.component.ts'],
    vue: ['src/main.ts', 'src/main.js'],
    svelte: ['src/main.ts', 'src/main.js'],
    react: ['src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx', 'src/main.ts', 'src/index.js'],
  }[framework];
  if (c) return firstExisting(dir, c);
  return firstExisting(dir, ['index.html', 'public/index.html', 'src/index.html']);
}

function detectEnvConvention(framework, deps) {
  switch (framework) {
    case 'nextjs': return { name: 'NEXT_PUBLIC_CLARITY_PROJECT_ID', read: 'process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID' };
    case 'nuxt': return { name: 'NUXT_PUBLIC_CLARITY_PROJECT_ID', read: 'useRuntimeConfig().public.clarityProjectId' };
    case 'sveltekit': return { name: 'PUBLIC_CLARITY_PROJECT_ID', read: "$env/static/public → PUBLIC_CLARITY_PROJECT_ID" };
    case 'astro': return { name: 'PUBLIC_CLARITY_PROJECT_ID', read: 'import.meta.env.PUBLIC_CLARITY_PROJECT_ID' };
    case 'angular': return { name: null, read: 'src/environments/environment.ts (clarityProjectId)' };
    case 'remix': return { name: 'CLARITY_PROJECT_ID', read: 'return from root loader; browser cannot read process.env' };
    default:
      if ('vite' in deps || framework === 'vue' || framework === 'svelte' || framework === 'react') {
        return { name: 'VITE_CLARITY_PROJECT_ID', read: 'import.meta.env.VITE_CLARITY_PROJECT_ID' };
      }
      return { name: null, read: null };
  }
}

function detect(dir) {
  const root = path.resolve(dir);
  const pkg = readJson(path.join(root, 'package.json'));
  const deps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {};
  const framework = pkg ? detectFramework(deps) : null;
  const pm = detectPackageManager(root, pkg);
  const installCmd = { npm: 'npm install @microsoft/clarity', pnpm: 'pnpm add @microsoft/clarity', yarn: 'yarn add @microsoft/clarity', bun: 'bun add @microsoft/clarity' }[pm] || null;
  const tsconfig = exists(root, 'tsconfig.json');
  const htmlEntry = firstExisting(root, ['index.html', 'public/index.html', 'src/index.html']);
  const alreadyInstalled = '@microsoft/clarity' in deps;

  return {
    dir: root,
    hasPackageJson: !!pkg,
    framework: framework || (pkg ? 'unknown-js' : htmlEntry ? 'static-html' : 'unknown'),
    packageManager: pm,
    typescript: tsconfig || 'typescript' in deps,
    alreadyInstalled,
    installCommand: alreadyInstalled ? null : installCmd,
    entryPoint: pkg ? entryPoint(root, framework) : htmlEntry,
    htmlEntry,
    env: detectEnvConvention(framework, deps),
    envFiles: ['.env', '.env.local', '.env.example'].filter((f) => exists(root, f)),
    // Path to be checked by the caller for an existing integration (script snippet or init call).
    existingMentions: findMentions(root),
    // Lets the skill choose npm package vs. official script tag for sites with no bundler.
    recommendation: !pkg ? 'script-tag' : 'npm-package',
  };
}

function findMentions(root) {
  const hits = [];
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', '.output', '.astro', 'coverage']);
  const exts = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.astro', '.html', '.mjs', '.cjs']);
  let budget = 3000;
  (function walk(d, depth) {
    if (depth > 6 || budget <= 0) return;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (budget-- <= 0) return;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!skip.has(e.name)) walk(p, depth + 1); continue; }
      if (!exts.has(path.extname(e.name))) continue;
      let txt;
      try { txt = fs.readFileSync(p, 'utf8'); } catch { continue; }
      if (/clarity\.ms\/tag|@microsoft\/clarity|Clarity\.init\(/.test(txt)) hits.push(path.relative(root, p));
    }
  })(root, 0);
  return hits;
}

if (require.main === module) {
  process.stdout.write(JSON.stringify(detect(process.argv[2] || '.'), null, 2) + '\n');
}

module.exports = { detect };
