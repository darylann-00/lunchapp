# CLAUDE.md

## Role

You are Daryl's expert SWE partner on this project. Daryl is a product manager — she understands the product deeply but will not know the technical implications of decisions unless you explain them. Always advise from an engineering standpoint: surface trade-offs, flag risks, and recommend best practices with a clear reason.

## Session management

At the start of every conversation, fast-forward local `main` to `origin/main`. Run from whatever branch is checked out — do not switch branches. If it fails ("non-fast-forward"), flag it to Daryl rather than forcing:
```
git fetch origin && git fetch origin main:main
```

Before starting any work, always read [CONTEXT.md](CONTEXT.md). Also read [design.md](design.md) for UI work, [architecture.md](architecture.md) for state/data work.

Before opening a PR, sync with main: `git fetch origin && git rebase origin/main`. Resolve any conflicts, verify the build still passes, then update [CONTEXT.md](CONTEXT.md) and include it in the PR. In CONTEXT.md, only update existing sections in-place — rewrite the relevant sentence/row/bullet to reflect current state. Do not append what changed, what was fixed, or what was added this session. If something was completed, remove it from Next Priorities; if a status changed, edit the existing line. The file should read as a snapshot of now, not a history of changes.

When Daryl says "wrap it up", push changes from this session to prod.

Before ending a session, summarize what changed and any decisions made.

## Workflow

For non-trivial implementation tasks: use the current model to research and produce a detailed plan (file paths, exact changes, acceptance criteria), then spawn Haiku agents (`model: "haiku"`) to execute each discrete subtask.

## Guardrails

Don't refactor things that aren't broken without asking while working on a ticket.
Ask before making architectural changes.

---

## What this is

A single-kid weekly lunch planner. Parent enters a kid profile + free-text weekly notes; Claude parses the notes, generates a weekly lunch plan, lets the parent regenerate individual dishes, then builds a deduped grocery list. Auth and persistence via Supabase; two thin Vercel functions proxy Anthropic.

## Stack

- **Vite 8 + React 19 + TypeScript** SPA (not Next.js — `src/pages/` is just a folder name, routing is `react-router-dom` v7)
- **Vercel Functions** in `api/` (`anthropic.ts`, `transcribe.ts`, `_auth.ts`) — plain `export async function POST(request: Request): Promise<Response>` style, no framework
- **Supabase** for all persistence (`profiles` + `weekly_plans` tables, PKCE auth) — no localStorage
- **Vitest + jsdom** for unit tests (scoped to `src/**`); needs `.env.test` (see Env)
- **Tailwind CSS v4** (Vite plugin) + custom moku utilities in [src/index.css](src/index.css) — no shadcn

## Commands

```
npm run dev      # vite dev server
npm run build    # tsc -b && vite build
npm run lint     # eslint .
npm test         # vitest (scoped to src/**/*.{test,spec}.{ts,tsx})
```

There is no Vercel-side `dev` proxy configured — `/api/*` calls only resolve on Vercel deploys or `vercel dev`. Plan accordingly when testing AI flows locally.

## Env

Client-side (prefixed `VITE_`, safe to expose):
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase publishable anon key

Server-side only (Vercel Functions, never expose to client):
- `ANTHROPIC_API_KEY` — read in [api/anthropic.ts](api/anthropic.ts) and [api/transcribe.ts](api/transcribe.ts)
- `SUPABASE_URL` — used by `api/_auth.ts` to validate JWTs server-side
- `SUPABASE_ANON_KEY` — used by `api/_auth.ts`

For tests, add a `.env.test` with dummy values so `src/lib/supabase.ts` doesn't throw at module load:
```
VITE_SUPABASE_URL=https://placeholder.supabase.co
VITE_SUPABASE_ANON_KEY=placeholder_anon_key_for_tests
```

## Architecture

```
Browser (React SPA)
  └─ src/lib/ai.ts        ── fetch('/api/anthropic') ──┐
  └─ ConversationalChat   ── fetch('/api/transcribe') ─┤
                                                       ▼
                                            api/anthropic.ts ──► api.anthropic.com/v1/messages
                                            api/transcribe.ts ──► same endpoint (audio doc + transcribe prompt)
```

Routing ([src/App.tsx](src/App.tsx)):
- `/onboarding` — first-run kid + parent prefs setup
- `/` — `BentoShell` (3-tab: Lunch Plan / Grocery / Profile)
- `*` — redirect to `/`
- `RequireKid` wrapper redirects to `/onboarding` when no kids exist

Domain types live in [src/types.ts](src/types.ts): `Kid`, `ParentPrefs`, `Dish`, `LunchItem`, `WeeklyPlan` (status: `'draft' | 'final'`), `GroceryItem`, `ParsedSession`.

Plan lifecycle: one plan per `weekStartDate`. `savePlan` replaces any existing plan for that week. Grocery list is generated on demand and stored on the plan.

## AI layer ([src/lib/ai.ts](src/lib/ai.ts))

Four entry points, all returning typed JSON:
- `parseWeeklyNotes` — free-text + day checkboxes → `ParsedSession`
- `generateWeeklyPlan` — session + kid + prefs → `{ days, items }`, validated for day coverage
- `generateGroceryList` — final plan → deduped `GroceryItem[]`
- `regenerateDish` — single-dish replacement with context of other dishes that week

Conventions worth preserving:
- Model is **`claude-sonnet-4-6`** across all calls.
- **Do not add assistant-message prefills** (e.g. `{ role: 'assistant', content: '{' }` as the last message). They return 400 on `claude-sonnet-4-6` — see commit `dc6ae64`. JSON-only output is enforced via system prompts instead.
- `safeParseJson` strips ```` ``` ```` fences, `//` comments, and trailing commas before `JSON.parse`. There are tests for this in [src/lib/ai.test.ts](src/lib/ai.test.ts) — keep them passing.
- `callWithRetry` does **one** corrective retry on parse/validation failure, then throws. Don't add unbounded retries.
- UUIDs for `LunchItem.id` and `Dish.id` are stamped client-side after generation (the model is told to emit `"id": "uuid"` strings, but we overwrite).
- Safety rules (allergens, vegetarian/vegan, school rules) are encoded in the prompts — if you change those prompts, preserve rule ordering: safety first.

## State management

- Single `AppContext` ([src/context/AppContext.tsx](src/context/AppContext.tsx)) is the source of truth; reads/writes via the Supabase client. Auth state tracked via `supabase.auth.onAuthStateChange`; data loads when a user session exists and clears on sign-out.
- Hooks ([src/hooks/](src/hooks/)) are thin wrappers over context: `useKid` (single-kid v0 — `kids[0]`), `useParentPrefs`, `usePlan`, `useAI` (loading/error wrapping + per-item regenerate state), `useAuth`.

## Voice input

[src/components/ConversationalChat.tsx](src/components/ConversationalChat.tsx) records via `MediaRecorder`, POSTs the blob to `/api/transcribe`, and appends the transcript to the textarea. Falls back gracefully if `MediaRecorder` is unavailable or the user denies the mic.

## Things to be careful about

- **Don't introduce Next.js patterns.** This is a Vite SPA. No App Router, no `'use client'`, no server components. `src/pages/` is convention only.
- **Don't swap the Anthropic proxy for the AI SDK** unless the user asks. The current pattern (server proxy + `fetch('/api/anthropic')` + client-side `callWithRetry`) is intentional.
- **`vercel.json` SPA rewrite** sends everything that isn't `/api/*` to `index.html`. The CSP and security headers are also defined there — keep them intact if you add routes or new external origins.
- **TypeScript is strict** (`tsc -b` runs in build). No `any` smuggling.
- **All API calls require auth.** `api/_auth.ts` → `requireAuth()` must be called at the top of every Vercel Function. Never skip it.
- **Single-kid assumption** (`kids[0]`) is everywhere — if you generalize to multi-kid, audit `useKid`, the nav, and `RequireKid`.
