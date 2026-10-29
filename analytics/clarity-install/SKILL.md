---
name: clarity-install
description: Install Microsoft Clarity (the @microsoft/clarity npm package) in a web project the user owns. Use when the user asks to add, install, set up or integrate Microsoft Clarity, session replays, heatmaps or Clarity analytics in a Next.js, React, Vue, Nuxt, Svelte/SvelteKit, Astro, Angular, Remix, plain JS or static HTML site, or asks to wire up the Clarity project ID, cookie consent, identify/custom tags/events.
---

# clarity-install

Adds [Microsoft Clarity](https://clarity.microsoft.com) to a project in a few steps: detect the
stack → install `@microsoft/clarity` → initialize it once, client-side, with the project ID from
an env var → verify. Package reference: <https://www.npmjs.com/package/@microsoft/clarity>
(API docs: <https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api>).

## Hard rules

- **Only change projects the user owns or is authorized to change.**
- **Never invent a project ID.** Ask for it (Clarity → Project → Settings → Overview). If the user
  doesn't have it yet, wire everything to the env var and leave it blank in `.env.example`, and
  tell them where to put the real value.
- **Don't hardcode the ID in source**; read it from the framework's public env var. (It's not a
  secret — it ships to the browser — but env keeps staging/prod separate.)
- **Initialize once, in the browser only.** `Clarity.init` touches `window`/`document`; calling it
  during SSR crashes. Never call it per-component-render or per-route.
- **Privacy:** Clarity records sessions. If the site serves EU/UK/etc. visitors, or the user has
  a consent banner, gate it with the consent API (below) and mention masking of sensitive fields
  (`data-clarity-mask="true"`). Don't add Clarity to pages with credentials/payment/health data
  without raising this.
- Make the minimal edit: don't refactor the entry file, don't reformat unrelated code, don't
  commit or push unless asked.

## Workflow

### 1. Detect

Run the read-only detector (no network, no writes) from the project root:

```bash
node <skill-dir>/scripts/detect.js .
```

It reports `framework`, `packageManager`, `typescript`, `entryPoint`, the right env var name for
that framework, `installCommand`, `alreadyInstalled` and `existingMentions` (files that already
reference Clarity). If `alreadyInstalled` or `existingMentions` is non-empty, **don't add a second
init** — review what's there and offer to fix it instead. If `framework` is `unknown`, read the
project yourself and ask one question if still unclear.

### 2. Get the project ID

Ask the user for it unless it's already in an env file. Treat it as an opaque string.

### 3. Install

- `recommendation: "npm-package"` → run `installCommand` (npm/pnpm/yarn/bun detected from the
  lockfile).
- `recommendation: "script-tag"` (static HTML, no `package.json`) → use the official snippet
  instead of npm (see "Static HTML").

### 4. Initialize (pick the matching recipe)

Replace `PROJECT_ID` reads with the env var the detector reported. Add the var to `.env.example`
(empty value) and, if the user gave the ID, to the local env file (`.env.local` / `.env`, whichever
the project already gitignores — check `.gitignore` first).

**Next.js (App Router)** — a client component rendered once from `app/layout.tsx`:

```tsx
// app/clarity.tsx
'use client';
import { useEffect } from 'react';
import Clarity from '@microsoft/clarity';

export function ClarityInit() {
  useEffect(() => {
    const id = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
    if (id) Clarity.init(id);
  }, []);
  return null;
}
```
Then add `<ClarityInit />` inside `<body>` in `layout.tsx`. **Pages Router:** same `useEffect`
inside `pages/_app.tsx`'s `App` component.

**React / Vite** — in `src/main.tsx`, before `createRoot(...).render(...)`:

```ts
import Clarity from '@microsoft/clarity';

const clarityId = import.meta.env.VITE_CLARITY_PROJECT_ID;
if (clarityId) Clarity.init(clarityId);
```

**Vue 3** — same snippet in `src/main.ts` before `app.mount`.

**Nuxt** — `plugins/clarity.client.ts` (the `.client` suffix keeps it out of SSR):

```ts
import Clarity from '@microsoft/clarity';

export default defineNuxtPlugin(() => {
  const id = useRuntimeConfig().public.clarityProjectId;
  if (id) Clarity.init(id);
});
```
and `runtimeConfig: { public: { clarityProjectId: '' } }` in `nuxt.config.ts`.

**SvelteKit** — `src/routes/+layout.svelte`:

```svelte
<script>
  import { onMount } from 'svelte';
  import { PUBLIC_CLARITY_PROJECT_ID } from '$env/static/public';
  onMount(async () => {
    if (!PUBLIC_CLARITY_PROJECT_ID) return;
    const { default: Clarity } = await import('@microsoft/clarity');
    Clarity.init(PUBLIC_CLARITY_PROJECT_ID);
  });
</script>
<slot />
```

**Astro** — in the shared layout:

```astro
<script>
  import Clarity from '@microsoft/clarity';
  const id = import.meta.env.PUBLIC_CLARITY_PROJECT_ID;
  if (id) Clarity.init(id);
</script>
```
(With View Transitions, Astro runs this module script once — which is what we want.)

**Angular** — in `src/main.ts` before `bootstrapApplication`, guarded for SSR with
`typeof window !== 'undefined'`; take the ID from `environment.clarityProjectId`.

**Remix** — in `app/root.tsx`: return the ID from the loader, then `useEffect(() => { if (id)
Clarity.init(id); }, [id])` in the `App` component.

**Other JS (webpack, plain bundle)** — import and call `Clarity.init(id)` once in the client
entry file.

**Static HTML (no bundler)** — put the official snippet in `<head>` (replace `PROJECT_ID`):

```html
<script type="text/javascript">
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "PROJECT_ID");
</script>
```

### 5. Optional APIs (only if the user asks)

```js
Clarity.identify('user-id', 'session-id', 'page-id', 'Friendly name'); // only the first is required
Clarity.setTag('plan', 'pro');            // value may be string or string[]
Clarity.event('checkout-started');
Clarity.upgrade('cart-abandon');          // prioritize this session for recording
Clarity.consentV2({ ad_Storage: 'denied', analytics_Storage: 'granted' }); // recommended
Clarity.consent(false);                   // v1, legacy
```

If the user has a cookie banner: call `Clarity.consentV2(...)` when the visitor makes a choice
(defaults to both `granted` when called with no args). Pass hashed or opaque IDs to `identify` —
never raw emails or other PII (Clarity hashes `customId` client-side, but the other fields are
sent as-is).

### 6. Verify

1. Run the project's type-check/build (`npm run build` or the equivalent) — no SSR `window`
   errors.
2. Start the dev server, open the site, and in DevTools → Network confirm a request to
   `clarity.ms` (and `window.clarity` is defined in the console).
3. Tell the user that the Clarity dashboard can take a few minutes to show first sessions, and
   that ad-blockers/Brave hide the traffic when they test.
4. Show a summary: package added, files changed, env var names, and anything left for the user
   (real project ID, consent wiring, production env var in their host/CI).

## Common problems

| Symptom | Cause / fix |
|---|---|
| `window is not defined` | Init ran during SSR — move into `useEffect`/`onMount`/`.client` plugin. |
| No requests to `clarity.ms` | Env var empty or not exposed to the browser (wrong prefix), or an ad-blocker. |
| Dashboard shows nothing | Wrong project ID, or consent denied (`analytics_Storage: 'denied'`), or domain mismatch in the Clarity project settings. |
| Duplicate sessions | `init` called twice (React Strict Mode double-effect is harmless; multiple call sites are not). |
| CSP blocks it | Allow `https://www.clarity.ms`, `https://*.clarity.ms` in `script-src`/`connect-src`. |
