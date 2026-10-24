# QueueNova: techstack.md

Audience: both agents and the owner (Shivani). Read design.md for UI rules and architecture.md for data and logic.

## 1. Decisions at a glance

| Area | Choice | Why |
|---|---|---|
| Repo layout | npm workspaces monorepo: `apps/web`, `apps/api`, `packages/queue-engine` | One pure TypeScript queue engine shared by browser and server, so both always compute the same ETA |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 | Small output, fast dev, easy for a coding agent to get right |
| Routing and prerender | React Router with `vite-react-ssg` | Each static route becomes its own HTML file with its own title, description and H1 |
| State | Zustand (about 1 KB gzipped) with a localStorage adapter | Shared state for pass, live view and admin, no boilerplate |
| Icons | `lucide-react`, named imports only | SVG, tree-shakes, no emoji |
| Fonts | `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, self-hosted | No third-party font request, no layout shift |
| Charts | Hand-written SVG (two bars, one gauge) | Chart libraries are the biggest avoidable bundle cost |
| Backend (Phase 2) | Node (current LTS), Fastify, TypeScript, zod | Small, fast, typed |
| Database (Phase 2) | PostgreSQL, one JSONB state row per organisation with a version column | The engine is pure, so load, apply, save with a version check is enough for a demo |
| Realtime (Phase 2) | Server-Sent Events, polling fallback | One-way updates, simpler than WebSockets |
| Tests | Vitest | Same toolchain as Vite |
| Frontend hosting | Netlify | Serves `404.html` automatically, handles custom domain and HTTPS, supports `_headers` |
| Backend hosting | Render web service plus Render Postgres (or Neon) | Simple deploy from Git |
| Domain | One custom domain: apex for the site, `api.` subdomain for the backend | Same-site cookies for admin login |

Version policy: use the current stable major of each tool at install time. After installing, commit the lockfile, run `npm audit`, and do not upgrade majors during the hackathon. Where this file says "verify", the agent must check the package README or run a build instead of relying on memory.

## 2. Phases

- **Phase 1 (build first, matches the one-hour roadmap):** frontend plus engine, state in localStorage, sync between browser tabs with `BroadcastChannel`. No backend needed. This is the version for the hackathon demo.
- **Phase 2 (only after Phase 1 passes the demo script):** API and database, SSE, admin passcode. The web app swaps its storage adapter for an HTTP adapter. No page code changes.

The web app must talk to state through one interface, `QueueStore`, so the swap is a single file:

```ts
interface QueueStore {
  getState(): AppState;
  dispatch(action: Action): Result;      // Phase 1: runs engine locally. Phase 2: POSTs to API.
  subscribe(listener: () => void): () => void;
  resetDemo(): void;
}
```

## 3. Frontend details (`apps/web`)

- Entry uses `vite-react-ssg`. Follow its README for the route object format and check that its supported React and React Router versions match what you installed. If it does not work with the installed versions, fallback: a small Node script that builds with Vite in SSR mode and calls `renderToString` for each static route, writing `dist/<route>/index.html`. Do not skip prerendering, because per-page titles and descriptions must be in the HTML.
- Per-page `<title>`, `<meta name="description">`, canonical, Open Graph and robots tags: use the `Head` component exported by the prerender tool, one per page component. Values come from a single `src/seo.ts` map that mirrors the table in design.md section 3.2. Verify in the built HTML (section 7 of this file).
- Pages are lazy-loaded with `React.lazy` except the landing page. The admin routes are separate chunks.
- Live data (landing panel, /live, /pass, /admin) renders only on the client after mount. Prerendered HTML for those parts shows a plain `Loading queue data` text, never numbers. This avoids hydration mismatch (seed times depend on the current time) and prevents fake numbers in the HTML that crawlers read.
- Tailwind 4 is configured in CSS (`@theme`) using the tokens from design.md section 2.1. No arbitrary hex values in components.
- `lucide-react`: `import { Clock } from "lucide-react"`. Never `import * as`.
- Forms use native elements and small hand-written validators. No form library, no schema library in the browser.
- Time: all engine functions take `now` (milliseconds) as a parameter. The UI passes `Date.now()`. A single `setInterval` of 15 seconds dispatches a `tick` action. Clear it on unmount.

## 4. Backend details (`apps/api`, Phase 2)

- Fastify with `@fastify/cors` (allow only the site origin), `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cookie`.
- Request bodies validated with zod. Zod stays in the API only, so the browser bundle does not pay for it.
- Database access with Drizzle ORM or plain `pg`. Tables: `organisations(id, name)`, `org_state(org_id, version, state jsonb, updated_at)`. Update with `WHERE version = $expected`, retry up to 3 times on conflict.
- Every mutating endpoint runs: load state, call `engine.apply(state, action, Date.now())`, save, broadcast over SSE. The server is the only clock in Phase 2.
- Admin: `POST /api/v1/admin/login` compares the passcode from `ADMIN_PASSCODE` with `crypto.timingSafeEqual`, then sets an httpOnly, Secure, SameSite=Lax cookie holding a signed token (8 hours). All admin routes check it. Mutating requests also require the header `X-Requested-With: queuenova`.
- Build with `tsup` so the shared engine is bundled in. Health check at `GET /healthz`.
- Full endpoint list: architecture.md section 14.

## 5. Hosting, custom domain and DNS

Pick a domain name and check availability at a registrar before anything else. Do not assume a name is free. Examples to check: `queuenova.in`, `queuenova.app`, `queuenova.com`. Write the final choice into `.env` and the sitemap only after it is bought.

Steps (Phase 1, site only):
1. Create the Netlify site from the Git repo. Build command `npm run build -w apps/web`, publish directory `apps/web/dist`.
2. In Netlify, open Domain management and add the custom domain. Netlify shows the exact DNS records for your registrar, or you can delegate the domain to Netlify DNS. Use what the dashboard shows. Do not copy IP addresses from articles.
3. Set the primary domain (apex or `www`) and let Netlify redirect the other one to it.
4. Wait for the HTTPS certificate to be issued, then enable "Force HTTPS".
5. Set `VITE_SITE_URL=https://YOUR-DOMAIN` in the Netlify environment, rebuild, and confirm canonical links, `robots.txt` and `sitemap.xml` use the real domain.
6. Verify: `dig YOUR-DOMAIN`, `curl -I https://YOUR-DOMAIN`, and open `https://YOUR-DOMAIN/this-does-not-exist` to see the custom 404 with a 404 status.

Steps (Phase 2, API): create the Render service, add custom domain `api.YOUR-DOMAIN`, add the CNAME record Render shows, wait for the certificate, set `CORS_ORIGIN=https://YOUR-DOMAIN`, `COOKIE_DOMAIN=.YOUR-DOMAIN`. Free tiers change and may sleep when idle. Check current limits before the demo and open the API once a few minutes before presenting.

## 6. Delivery files (where each required item lives)

| Item | File | Notes |
|---|---|---|
| Favicon set | `apps/web/public/favicon.svg`, `.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest` | Source SVG and commands in design.md 3.3 |
| robots.txt | `apps/web/public/robots.txt` | Content in design.md 3.4 |
| sitemap.xml | generated by `apps/web/scripts/sitemap.mjs` at build | Lists `/`, `/join`, `/live`, `/terms`, `/privacy` only |
| Terms page | `apps/web/src/pages/Terms.tsx` | Text in design.md 3.6 |
| Privacy page | `apps/web/src/pages/Privacy.tsx` | Text in design.md 3.7 |
| Custom 404 | `apps/web/src/pages/NotFound.tsx`, emitted as `dist/404.html` | If the prerender tool does not emit it, add a post-build step that renders it |
| Security and cache headers | `apps/web/public/_headers` | See below |
| Meta tags | `apps/web/src/seo.ts` | One entry per route |

`public/_headers` (Netlify):

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.YOUR-DOMAIN; base-uri 'self'; frame-ancestors 'none'

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

The prerender tool may inline a small hydration script. If the CSP blocks it, the browser console will say so. Fix it by allowing that script by hash, not by adding `'unsafe-inline'` to `script-src`. Replace `YOUR-DOMAIN` before deploying. Remove the `connect-src` API entry in Phase 1.

## 7. Bundle size plan (reduce huge JS bundles)

Budgets (gzipped, measured on the production build):

| Item | Budget |
|---|---|
| Initial JS on `/` | 90 KB or less |
| Any single route chunk | 40 KB or less |
| Total CSS | 20 KB or less |
| Font files loaded on first paint | 2 files (Plex Sans 400 and 600), latin subset only |
| Largest Contentful Paint (mobile, throttled, Lighthouse) | 2.5 s or less |

These are targets to be measured, not results that have been achieved. Measure after the first working build and after every feature.

Rules that keep the budget:
- Route-level code splitting with `React.lazy`. Admin pages never load for visitors.
- No chart library, no animation library, no UI kit, no date library, no lodash, no axios, no zod in the browser.
- Icons by named import only.
- Do not import the engine's test helpers or seed data into pages that do not need them. Load seed data with dynamic `import()` only when state is empty.
- Images: none beyond favicon files and one Open Graph screenshot (not loaded by pages).
- Fonts: only the weights listed in design.md.
- Enable Vite's default minification and CSS code splitting. Set `build.target` to a modern baseline.

Measure:

```
npm run build -w apps/web
# gzipped size of every JS and CSS file
find apps/web/dist/assets -name "*.js" -o -name "*.css" | while read f; do printf "%s %s\n" "$(gzip -c "$f" | wc -c)" "$f"; done | sort -n
# visual breakdown (dev dependency: rollup-plugin-visualizer)
ANALYZE=1 npm run build -w apps/web
# audit
npx lighthouse https://YOUR-DOMAIN --only-categories=performance,accessibility,seo --view
```

If a budget is exceeded: open the visualizer, find the largest module, and remove or lazy-load it before adding anything new.

## 8. Dependency policy

Allowed (web): `react`, `react-dom`, `react-router-dom` (or the version `vite-react-ssg` requires), `vite-react-ssg`, `zustand`, `lucide-react`, `clsx`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, `tailwindcss`, `@tailwindcss/vite`, `typescript`, `vitest`, `rollup-plugin-visualizer` (dev).

Allowed (api): `fastify`, `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cookie`, `zod`, `pg` or `drizzle-orm`, `tsup`, `tsx` (dev), `vitest`.

Banned: `moment`, `lodash`, `axios`, `framer-motion`, `gsap`, any UI kit (MUI, Chakra, Ant Design), any chart library in v1, any analytics or tracking package, any cursor or particle effect package. Adding a dependency not on this list needs a written reason in the pull request description and a size check.

## 9. Environment variables

`apps/web/.env.example`:
```
VITE_SITE_URL=https://YOUR-DOMAIN
VITE_API_URL=            # empty in Phase 1. In Phase 2: https://api.YOUR-DOMAIN
VITE_DEMO_MODE=true
```

`apps/api/.env.example` (Phase 2):
```
DATABASE_URL=
ADMIN_PASSCODE=           # long random string, never committed
SESSION_SECRET=           # long random string, never committed
CORS_ORIGIN=https://YOUR-DOMAIN
COOKIE_DOMAIN=.YOUR-DOMAIN
DEMO_MODE=true            # enables POST /demo/reset
PORT=8787
```

Never commit `.env`. Commit only `.env.example`. Add `.env*` (except the example) to `.gitignore`.

## 10. Scripts

Root `package.json`:
```
"dev": "npm run dev -w apps/web",
"build": "npm run build -w apps/web",
"test": "npm run test -w packages/queue-engine",
"qa": "bash scripts/qa.sh"
```

`scripts/qa.sh` (create exactly this; it must exit non-zero on any finding):

```bash
#!/usr/bin/env bash
set -u
fail=0
check() { # description, command that should print nothing
  out=$(eval "$2" 2>/dev/null)
  if [ -n "$out" ]; then echo "FAIL: $1"; echo "$out" | head -20; fail=1; fi
}
SRC="apps/web/src apps/web/public apps/web/index.html README.md design.md techstack.md architecture.md"
check "non-ASCII characters (em dash, en dash, emoji)" "grep -rnP '[^\\x00-\\x7F]' $SRC"
check "gradients or purple" "grep -rniE 'gradient|purple|violet|indigo' apps/web/src apps/web/public apps/web/index.html"
check "pill buttons" "grep -rniE 'rounded-full|border-radius: *9999|rounded-\\[999' apps/web/src"
check "banned copy" "grep -rniE 'revolutioni|seamless|cutting-edge|next-generation|unlock|leverage|empower|supercharge|game-chang|effortless|elevate|harness|delve|tapestry' apps/web/src apps/web/public apps/web/index.html"
check "AI tags or fake social proof" "grep -rniE 'made with ai|built with ai|powered by ai|testimonial|trusted by' apps/web/src apps/web/public apps/web/index.html"
check "scroll animation or cursor effects" "grep -rniE 'IntersectionObserver|scroll-timeline|animation-timeline|cursor: *url|mousemove' apps/web/src"
if [ -d apps/web/dist ]; then
  [ -f apps/web/dist/404.html ] || { echo "FAIL: dist/404.html missing"; fail=1; }
  [ -f apps/web/dist/robots.txt ] || { echo "FAIL: robots.txt missing"; fail=1; }
  [ -f apps/web/dist/sitemap.xml ] || { echo "FAIL: sitemap.xml missing"; fail=1; }
  [ -f apps/web/dist/favicon.svg ] || { echo "FAIL: favicon.svg missing"; fail=1; }
  dups=$(find apps/web/dist -name '*.html' -exec grep -ohP '(?<=<title>)[^<]*' {} \; | sort | uniq -d)
  [ -z "$dups" ] || { echo "FAIL: duplicate titles:"; echo "$dups"; fail=1; }
  dh1=$(find apps/web/dist -name '*.html' -exec grep -ohP '(?<=<h1)[^>]*>[^<]*' {} \; | sort | uniq -d)
  [ -z "$dh1" ] || { echo "FAIL: duplicate H1:"; echo "$dh1"; fail=1; }
  nodesc=$(find apps/web/dist -name '*.html' -exec grep -L 'name="description"' {} \;)
  [ -z "$nodesc" ] || { echo "FAIL: missing meta description:"; echo "$nodesc"; fail=1; }
fi
[ $fail -eq 0 ] && echo "QA passed" || exit 1
```

Note: `design.md`, `techstack.md` and `architecture.md` are included in the ASCII check, so keep these three files free of dash characters too. The IntersectionObserver check will also flag legitimate non-scroll uses. If it fires, review the match and remove the rule only if the use is not scroll animation.

## 11. Antigravity plan (who builds what)

I could not verify the model names "Gemini 3.8 Flash" and "Claude Opus 4.6" or their availability in Antigravity from here. Use the names as they appear in your Antigravity model picker. The plan below does not depend on the exact model version.

### 11.1 Roles

| Agent | Owns | Must not touch |
|---|---|---|
| Frontend agent (Gemini 3.8 Flash) | `apps/web` except `src/store/*` adapters for the API, `design.md` compliance | `packages/queue-engine` internals, `apps/api` |
| Backend agent (Claude Opus 4.6) | `packages/queue-engine`, `apps/api`, tests, `architecture.md` compliance | UI components, styles |

Reason for this split: the engine holds the rules where mistakes are expensive (ordering, ETA, guards), so the stronger reasoning model writes and tests it first. The frontend agent builds pages and layout in parallel and consumes the engine through its typed exports.

### 11.2 Order of work

1. Both agents read all three markdown files. Create the monorepo skeleton and commit it before agents split.
2. In parallel:
   - Backend agent: `packages/queue-engine` (types, actions, selectors, seed data, tests). Done when `npm test` passes the cases in architecture.md section 17.
   - Frontend agent: layout, header, footer, landing page (without live panel), terms, privacy, 404, favicon set, `seo.ts`, robots, sitemap script, prerender config, `_headers`.
3. Frontend agent wires `QueueStore` (localStorage adapter, BroadcastChannel) to the engine and builds /join, /pass, /live, /admin, /admin/counters.
4. Run `npm run qa`, build, measure bundle, run the demo script in architecture.md section 18 by hand.
5. Deploy Phase 1 to Netlify with the custom domain. Replace all bracketed placeholders in the legal pages.
6. Phase 2: backend agent builds `apps/api` and the Postgres schema. Frontend agent adds the HTTP adapter and the admin passcode form. Update the privacy policy in the same commit.

Mapping to the one-hour roadmap in your original document: steps 2 and 3 are the first 40 minutes of that roadmap with two agents working at once. Missed-turn recovery and queue confidence are in the engine from the start, but their UI can be added last.

### 11.3 Workspace rule (put in every session)

If your Antigravity version supports workspace rules, paste design.md section 0 there. Otherwise paste it at the start of each session. Also add:

```
Read design.md, architecture.md and techstack.md before changing anything.
Do not invent requirements. If something is missing or conflicts, stop and ask.
After each task run: npm run qa && npm test && npm run build
Commit messages: plain English, no emoji, no dash characters.
Do not add dependencies that are not on the allowed list in techstack.md.
```

### 11.4 Starter prompt for the backend agent

```
You are building the queue engine for QueueNova.
Read architecture.md fully. Implement packages/queue-engine exactly as specified
in sections 4 to 12 and 17: types, the apply() function with all actions,
selectors (estimateWaitFor, getPulse, getRecommendations, getConfidence,
getFlowScore, getStats), seed data, and Vitest tests for every case in section 17.
The package is pure TypeScript with no runtime dependencies. All functions take
`now` as an argument and never call Date.now() or Math.random() inside the engine
(pass a random function for passKey generation). Do not build UI.
Finish when npm test passes. Then list any rule in architecture.md that was
ambiguous and what you assumed.
```

### 11.5 Starter prompt for the frontend agent

```
You are building the QueueNova web app (apps/web).
Read design.md fully, then techstack.md sections 3, 6, 7, 8 and 10.
Start with the static pages: layout, landing (live panel as a placeholder component),
terms, privacy, 404, seo.ts, favicon set, robots.txt, sitemap script, _headers,
and prerendering. Then run npm run build and npm run qa and fix every finding.
Do not use gradients, pill buttons, emoji, em dashes, en dashes, fake numbers,
testimonials, scroll animations or cursor effects. Use the exact titles, H1s
and descriptions from design.md section 3.2. Do not guess content, ask.
```

## 12. Requirement checklist (tick each before launch)

| Requirement | Where specified | How to verify |
|---|---|---|
| Terms and conditions page | design.md 3.6 | Open `/terms`, linked in footer, placeholders replaced |
| Privacy policy page | design.md 3.7 | Open `/privacy`, matches what the code stores |
| Favicon | design.md 3.3 | Tab shows icon in Chrome and Firefox, `dist/favicon.svg` exists |
| Custom domain | techstack.md 5 | `curl -I https://YOUR-DOMAIN` returns 200 over HTTPS |
| Meta description per page | design.md 3.2 | `npm run qa` finds no page without one |
| Unique title and H1 per page | design.md 3.2 | `npm run qa` finds no duplicates |
| robots.txt | design.md 3.4 | `https://YOUR-DOMAIN/robots.txt` loads |
| sitemap.xml | design.md 3.4 | `https://YOUR-DOMAIN/sitemap.xml` lists 5 URLs on the real domain |
| Custom 404 | design.md 3.5 | Unknown URL shows the custom page and returns status 404 |
| Reduced JS bundle | techstack.md 7 | Budgets met on the production build |
| No purple gradient | design.md 0 | `npm run qa` |
| No vague hero text | design.md 4.1 | Hero says what the product does in plain words |
| No fake reviews | design.md 0 | `npm run qa`, no testimonial section |
| No fake metrics | design.md 0 | Every number traces to state, seeded data labelled "Demo data" |
| No scroll animations or cursor effects | design.md 2.4 | `npm run qa`, manual scroll test |
| No pill buttons | design.md 2.3 | `npm run qa` |
| No emoji icons | design.md 2.5 | `npm run qa` (non-ASCII check) |
| No AI images | design.md 2.5 | Only favicon files and one real screenshot in `public` |
| No em dashes | design.md 0 | `npm run qa` (non-ASCII check) |
| No "made with AI" tag | design.md 3.8 | `npm run qa`, footer text matches design.md |
| No AI-sounding copy | design.md 0 | Banned-word check, plus read every line aloud and cut anything vague |

## 13. Things this plan cannot guarantee

- The legal pages are drafts. Have them reviewed before real users enter data.
- Library compatibility (`vite-react-ssg` with your React Router version, Tailwind 4 plugin with Vite) must be confirmed by installing and building. Fix by pinning versions, not by guessing.
- Hosting free tiers, build minutes and sleep behaviour change. Check them on the day.
- The browser-only prototype does not sync across devices. For a demo on two phones, use Phase 2 or show two browser tabs on one machine.
- Wait estimates are simple calculations from recent durations. They are not predictions from a trained model, and the UI must never say otherwise.
