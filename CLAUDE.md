# CLAUDE.md

Orientation notes for working in this repo. Read before editing.

## What this is

A single-kid weekly lunch planner. Parent enters a kid profile + free-text weekly notes; Claude parses the notes, generates a weekly lunch plan, lets the parent regenerate individual dishes, then builds a deduped grocery list. All client-side state, with two thin Vercel functions proxying Anthropic.

## Stack

- **Vite 8 + React 19 + TypeScript** SPA (not Next.js — `src/pages/` is just a folder name, routing is `react-router-dom` v7)
- **Vercel Functions** in `api/` (`anthropic.ts`, `transcribe.ts`) — plain `export async function POST(request: Request): Promise<Response>` style, no framework
- **localStorage** for all persistence (no DB) via [src/lib/storage.ts](src/lib/storage.ts)
- **Vitest + jsdom** for tests
- **Plain CSS** with CSS variables in [src/index.css](src/index.css) — no Tailwind, no shadcn

## Commands

```
npm run dev      # vite dev server
npm run build    # tsc -b && vite build
npm run lint     # eslint .
npm test         # vitest
```

There is no Vercel-side `dev` proxy configured — `/api/*` calls only resolve on Vercel deploys or `vercel dev`. Plan accordingly when testing AI flows locally.

## Env

- `ANTHROPIC_API_KEY` — required on the server (read in [api/anthropic.ts](api/anthropic.ts) and [api/transcribe.ts](api/transcribe.ts)). Never expose to the client.

## Architecture

```
Browser (React SPA)
  └─ src/lib/ai.ts        ── fetch('/api/anthropic') ──┐
  └─ ConversationalChat   ── fetch('/api/transcribe') ─┤
                                                       ▼
                                            api/anthropic.ts ──► api.anthropic.com/v1/messages
                                            api/transcribe.ts ──► same endpoint (audio doc + transcribe prompt)
```

Routing ([src/App.tsx](src/App.tsx:35)):
- `/onboarding` — first-run kid + parent prefs setup
- `/` — Home: draft summary if one exists, plan history otherwise
- `/plan/new` → `/plan/review` → `/plan/grocery` — three-step planning flow
- `/settings`
- `RequireKid` wrapper redirects to `/onboarding` when no kids exist

Domain types live in [src/types.ts](src/types.ts): `Kid`, `ParentPrefs`, `Dish`, `LunchItem`, `WeeklyPlan` (status: `'draft' | 'final'`), `GroceryItem`, `ParsedSession`.

Plan lifecycle: at most one `draft` plan at a time. `finalizePlan` flips status to `final`. Grocery list is generated after review and stored on the plan.

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

- Single `AppContext` ([src/context/AppContext.tsx](src/context/AppContext.tsx)) is the source of truth; mirrors localStorage.
- All writes go through `persist()` which catches `QUOTA_EXCEEDED` and surfaces `storageError` to the banner in [src/App.tsx:23](src/App.tsx:23).
- Hooks ([src/hooks/](src/hooks/)) are thin wrappers over context: `useKid` (single-kid v0 — `kids[0]`), `useParentPrefs`, `usePlan`, `useAI` (loading/error wrapping + per-item regenerate state).

## Voice input

[src/components/ConversationalChat.tsx](src/components/ConversationalChat.tsx) records via `MediaRecorder`, POSTs the blob to `/api/transcribe`, and appends the transcript to the textarea. Falls back gracefully if `MediaRecorder` is unavailable or the user denies the mic.

## Things to be careful about

- **Don't introduce Next.js patterns.** This is a Vite SPA. No App Router, no `'use client'`, no server components. `src/pages/` is convention only.
- **Don't migrate storage to Vercel KV / Postgres / Blob.** localStorage is intentional for v0 — the QUOTA_EXCEEDED banner exists for a reason.
- **Don't swap the Anthropic proxy for the AI SDK** unless the user asks. The current pattern (server proxy + `fetch('/api/anthropic')` + assistant-prefill JSON) is load-bearing for the parse-retry behavior.
- **`vercel.json` SPA rewrite** sends everything that isn't `/api/*` to `index.html`. Keep that intact if you add routes.
- **TypeScript is strict** (`tsc -b` runs in build). No `any` smuggling.
- Single-kid assumption (`kids[0]`) is everywhere — if you generalize to multi-kid, audit `useKid`, the nav, and `RequireKid`.
