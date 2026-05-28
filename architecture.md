# BentoBot — Architecture Reference

Read this when touching state, data, the AI layer, or non-trivial component wiring.

---

## Project Structure

```
/src
  /pages
    Onboarding.tsx         — first-run multi-step kid + parent prefs setup (RequireAuth protected)
    SignIn.tsx             — Google OAuth + magic link + dev password form
  /components
    WizardOverlay.tsx      — 2-step plan generation overlay
    LunchPlanTab.tsx       — weekly plan display + per-dish regenerate
    EditDayModal.tsx       — single-day dish editor
    GroceryTab.tsx         — grocery list generation + display
    ProfileTab.tsx         — edit kid + parent prefs, sign out, reset
    ConversationalChat.tsx — voice → transcript → textarea append
  /context
    AppContext.tsx          — single source of truth; all reads/writes go to Supabase
  /hooks
    useAuth.ts             — Supabase session, signInWithGoogle, signInWithEmail, signOut
    useKid.ts              — returns kids[0] (single-kid v0)
    useParentPrefs.ts      — returns parentPrefs from context
    useAI.ts               — loading/error wrappers + per-item regenerate state
  /lib
    ai.ts                  — AI entry points + safeParseJson + callWithRetry; orchestrates the 3-stage weekly plan flow
    recipes.ts             — catalog: getCandidateRecipes, autoTagRecipe, saveAIRecipe, recipeToDish
    supabase.ts            — Supabase client (PKCE, persistSession, autoRefreshToken)
    dateUtils.ts           — getMondayISO, addWeeks, formatWeekRange, weekRelativeLabel
  types.ts                 — Kid, ParentPrefs, Dish, LunchItem, WeeklyPlan, GroceryItem, ParsedSession
  index.css                — Tailwind v4 @theme + moku utility classes
  App.tsx                  — Router, AppProvider, RequireAuth, RequireKid, BentoShell
/api
  _auth.ts                 — requireAuth(request) → validates Supabase JWT server-side
  anthropic.ts             — Vercel Function: requireAuth → proxy to api.anthropic.com/v1/messages
  transcribe.ts            — Vercel Function: requireAuth → audio blob → Claude transcription
/supabase/migrations
  20260526_create_profiles.sql
  20260526_create_weekly_plans.sql
  20260526_enable_rls.sql
/tests/e2e
  sign_in.spec.ts          — Playwright e2e: sign-in flow
```

---

## State Architecture

`AppContext` (`src/context/AppContext.tsx`) is the single source of truth. All data lives in Supabase — there is no localStorage layer.

On mount, `AppContext` subscribes to `supabase.auth.onAuthStateChange`. When a user signs in, it fires two parallel queries to load `profiles` and `weekly_plans` for that user. When they sign out, it clears all state.

All context write methods are `async` — they await the Supabase call before updating React state. Errors are caught by `wrap()` and set on `storageError`, surfaced in an error banner in `BentoShell`.

### Context API

```ts
kids: Kid[]
parentPrefs: ParentPrefs | null
plans: WeeklyPlan[]
loading: boolean                   // true while initial Supabase fetch is in-flight
saveKid(kid): Promise<void>
saveParentPrefs(prefs): Promise<void>
savePlan(weekStartDate, days, sessionNotes, items): Promise<WeeklyPlan>
updatePlanItems(planId, items): Promise<void>
setGroceryList(planId, list): Promise<void>
deletePlan(planId): Promise<void>
clearAll(): Promise<void>          // deletes all Supabase rows for this user
storageError: string | null
```

### Auth guards

- `RequireAuth` — redirects to `/signin` if no session; renders `null` while loading
- `RequireKid` — redirects to `/onboarding` if `kids.length === 0`; renders `null` while loading

### Hooks

- `useAuth()` — `{ session, user, loading, signInWithGoogle, signInWithEmail, signInWithPassword, signOut }`
- `useKid()` → `{ kid: kids[0] | undefined }` — single-kid assumption everywhere
- `useParentPrefs()` → `{ parentPrefs }` from context
- `useAI()` — `generatePlan` and `regenerateItem` as `{ loading, error, call }` objects

---

## AI Layer (`src/lib/ai.ts` + `src/lib/recipes.ts`)

### Entry points

| Function | Input | Output |
|----------|-------|--------|
| `parseWeeklyNotes` | notes string, days[], kid, parentPrefs | `ParsedSession` |
| `generateWeeklyPlan` | ParsedSession, kid, parentPrefs | `{ days, items: LunchItem[] }` |
| `generateRecipeForGap` | kid, parentPrefs, session, day, mealType, gapReason | invented recipe payload |
| `generateGroceryList` | WeeklyPlan[], kid, parentPrefs | `GroceryItem[]` |
| `regenerateDish` | kid, parentPrefs, sessionNotes, day, mealType, currentDish, userNote, otherDishes | `Dish` |

### Weekly plan: 3-stage flow

`generateWeeklyPlan` orchestrates three stages. Its public signature is unchanged — internally:

1. **Candidate retrieval** (`recipes.ts:getCandidateRecipes`, no AI). Pulls `recipes` rows (RLS scopes to global + user-owned), joins tag names, excludes recipes the user disliked, drops any whose `ingredients[].name` contains a kid allergy (substring match), filters by dietary flags via tags (vegan/vegetarian), then boosts favorites (+2) and on-hand-ingredient matches (+1) and trims to ~50 — split ~30 mains + ~20 snacks.
2. **AI selection** (`ai.ts:runPlanSelection`). Sends Sonnet the kid/prefs/session plus a compact pool (`{ id, name, description, mealType, tags }` — no full ingredients) and asks it to output `{ days: [{ day, mainRecipeId, snackRecipeIds, gap? }] }`. Validates that every requested day comes back. Hallucinated IDs are dropped in Stage 3 and treated as gaps.
3. **Gap-filling** (`ai.ts:generateRecipeForGap` → `recipes.ts:saveAIRecipe` → `recipeToDish`). For each missing main or snack, asks Sonnet to invent one recipe matching the gap reason, auto-tags it via `autoTagRecipe` (substring → controlled-vocab heuristic), saves it to `recipes` with `source='ai'` and `created_by=auth.uid()`, and hydrates as `Dish`. Picks that came from the pool are hydrated directly via `recipeToDish` (fresh `Dish.id` per plan instance).

Safety is defense in depth: Stage 1 drops allergen-containing recipes at the data layer; Stage 2 and Stage 3 prompts both repeat the rules in priority order (allergens → school/camp rules → dietary flags).

### Key conventions

- Model is `claude-sonnet-4-6` on every call.
- **No assistant-message prefills.** They return HTTP 400 on `claude-sonnet-4-6`. JSON-only output enforced via system prompt (see commit `dc6ae64`).
- `safeParseJson` strips ` ``` ` fences, `//` line comments, and trailing commas before `JSON.parse`.
- `callWithRetry` makes one corrective retry on parse/validation failure, then throws. No unbounded retries.
- UUIDs for `LunchItem.id` and `Dish.id` are stamped client-side. `recipeToDish` always stamps a fresh `Dish.id` so two days reusing the same recipe don't share an id.
- Safety rules are encoded in prompts — allergens, vegetarian/vegan, school rules — priority order: safety first.
- Stage 2 validates that all `session.daysNeeded` appear in the response; triggers retry if not.
- `parseWeeklyNotes` exists but is **not called** in the current wizard path — `WizardOverlay` builds `ParsedSession` directly from its own state.
- `regenerateDish` and `generateGroceryList` are catalog-unaware for now (next PR will fold `regenerateDish` into the catalog).

### API auth

Both `/api/anthropic` and `/api/transcribe` call `requireAuth(request)` from `api/_auth.ts`. This validates the Supabase JWT by hitting `${SUPABASE_URL}/auth/v1/user`. Returns 401 if missing or invalid.

The client sends the token via `Authorization: Bearer <token>` header. `useAI` / `src/lib/ai.ts` must include the token on every request.

---

## Routing

```
/signin       → SignIn (public)
/onboarding   → RequireAuth → Onboarding
/             → RequireAuth → RequireKid → BentoShell
*             → redirect to /
```

`vercel.json` SPA rewrite sends everything that isn't `/api/*` to `index.html`. Also sets CSP and security headers.

---

## Supabase Schema

```sql
profiles (
  id            uuid PK → auth.users,
  kid           jsonb,         -- serialized Kid type
  parent_prefs  jsonb,         -- serialized ParentPrefs type
  created_at    timestamptz,
  updated_at    timestamptz
)

weekly_plans (
  id               uuid PK default gen_random_uuid(),
  user_id          uuid → auth.users,
  week_start_date  date,
  status           text ('draft' | 'final'),
  days             text[],
  items            jsonb,       -- LunchItem[]
  grocery_list     jsonb,       -- GroceryItem[] | null
  session_notes    text,
  created_at       timestamptz,
  UNIQUE (user_id, week_start_date)
)

recipes (
  id                  uuid PK default gen_random_uuid(),
  name                text,
  description         text,                       -- null until backfilled
  prep_notes          text,
  ingredients         jsonb,                      -- Ingredient[]
  meal_type           text ('main' | 'snack'),
  is_packaged         boolean default false,
  source              text ('curated' | 'ai' | 'user'),
  source_url          text,
  source_attribution  text,                       -- e.g. 'Yummy Toddler Food'
  prep_time_minutes   integer,
  created_by          uuid → auth.users,          -- NULL = global; else user-private
  created_at          timestamptz,
  updated_at          timestamptz
)

recipe_tags (
  id        uuid PK default gen_random_uuid(),
  name      text UNIQUE,
  category  text ('dietary' | 'format' | 'ingredient' | 'occasion')
)

recipe_tag_assignments (
  recipe_id  uuid → recipes ON DELETE CASCADE,
  tag_id     uuid → recipe_tags ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, tag_id)
)

recipe_feedback (
  user_id     uuid → auth.users,
  recipe_id   uuid → recipes ON DELETE CASCADE,
  reaction    text ('like' | 'dislike' | 'favorite'),
  created_at  timestamptz,
  PRIMARY KEY (user_id, recipe_id)
)
```

RLS is enabled on all tables. See `supabase/migrations/20260526_enable_rls.sql` (profiles, weekly_plans) and `supabase/migrations/20260528_recipes.sql` (recipes + tags + feedback). Recipe-table policies: any authenticated user can SELECT global recipes (`created_by IS NULL`) or their own; INSERT/UPDATE/DELETE only their own. `recipe_tags` is read-only to clients (managed by the seed script via service role). `recipe_feedback` is owner-only.

## Recipe seed script

`scripts/import_recipes.ts` is a one-time Node script (not browser code). Two modes:

- Default: reads `scripts/seed/lunchbox_snack_recipes_ALL.csv`, calls Claude per row to clean + tag + split multi-variants, writes `scripts/seed/recipes_seed.json` for review.
- `--apply`: reads the JSON, upserts tags, inserts recipes (`source='curated'`, `created_by=null`), inserts tag assignments. Requires `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.

Run via `npm run import-recipes` then `npm run import-recipes:apply`. Tag vocabulary is fixed (see `TAG_CATEGORY_MAP` in the script) — Claude can only pick from that list.

---

## Key Implementation Notes

- `activePlan` in `BentoShell` is derived by matching `weekStart` ISO string to `plan.weekStartDate`.
- All `AppContext` write methods are `async` — callers in `BentoShell` don't `await` them (fire-and-forget with optimistic UI); `wrap()` sets `storageError` on failure.
- `RequireAuth` and `RequireKid` both return `null` while loading to prevent flashes of the wrong route.
- `ConversationalChat` POSTs a `MediaRecorder` blob to `/api/transcribe`. Falls back gracefully if `MediaRecorder` is unavailable.
- TypeScript is strict — `tsc -b` runs in build. No `any` smuggling.
- Dev-only password sign-in form (`import.meta.env.DEV`) on `SignIn` page — tree-shaken in production builds.
