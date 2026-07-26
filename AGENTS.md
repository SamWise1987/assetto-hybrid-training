# AGENTS.md

## Cursor Cloud specific instructions

RobertaFunctional / Assetto is a single Next.js 16 (App Router, React 19) hybrid-training PWA
with Capacitor iOS/Android wrappers. Node `>=20.19` (the VM has Node 22). Package manager is
**npm** (`package-lock.json`). Standard commands live in `README.md` and `package.json`
`scripts` (`dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`) — use those; the
notes below only cover non-obvious setup gotchas.

### The app is account-first and needs Supabase env vars to render its real UI
- Without `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `isSupabaseConfigured()`
  is false and every screen renders **"Servizio account non configurato"** instead of the app.
- The update script copies `.env.example` → `.env.local` (only if missing) so the app is
  "configured". The values in `.env.example` are a real project URL + **placeholder** keys, so
  real Supabase auth will NOT succeed — but the login UI renders and the whole e2e suite passes
  (see below). For real authenticated flows against a live backend, replace the placeholder
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` with real values.
- Restart the dev server after editing `.env.local` (Next.js reads env at startup).

### E2E tests mock the backend — no live Supabase needed
- `e2e/platform-helpers.ts` injects a fake session into `localStorage` under key
  `sb-navyoqbpldsptejnnopk-auth-token` (the project ref must match the URL in `.env.example`)
  and mocks every `/api/**` + `/auth/v1/token` route. So e2e only needs the env vars set, not a
  working backend.
- `playwright.config.ts` `webServer` runs **`npm run start`** (a production build) with
  `reuseExistingServer: true`. Run `npm run build` first, or free port 3000 and let Playwright
  start it. The service worker only registers in **production**, so the offline/cache tests
  (`roberta-functional-shell-v6`) FAIL against `npm run dev` — always e2e against a prod build.
  First run needs `npx playwright install chromium`.

### Known date-sensitive e2e failure (not an environment problem)
- `e2e/platform-flows.spec.ts` "tab e griglia calendario supportano frecce e focus roving"
  (and the mobile 200%-text test) fail when **today is a Sunday**: the week view is Monday-start,
  Sunday is the last cell, and `moveCalendarFocus` clamps ArrowRight at the grid edge, so focus
  can't move to a "next" day. These pass on any non-Sunday date.

### Demoing the authenticated platform without a live backend
- Reuse the e2e mock harness: launch Playwright's Chromium
  (`~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`, headed on `DISPLAY=:1`),
  `context.addInitScript` the fake session + `page.route` the API mocks from
  `e2e/platform-helpers.ts`, then navigate `http://localhost:3000`. This renders the real
  athlete/coach/admin UI.

### Optional services (all degrade gracefully; not required to run/test)
- OpenAI (`OPENAI_API_KEY`) → AI weekly coach, else deterministic local fallback.
- Web Push (VAPID), Strava, FCM/APNs → native/push features only.
- Local Supabase via Docker is only needed for the SQL RLS contract test
  (`supabase/tests/rls_platform.test.sql`); there is no `supabase/config.toml` in the repo.
