# BentoBot — Design Reference

Read this when touching any UI component.

---

## Visual Theme: Moku

Bold, playful neo-brutalist style — thick dark borders, hard drop shadows, chunky rounded corners, flat colors. Inspired by craft/sticker aesthetics. All defined in `src/index.css`.

---

## Colors

```js
moku-blue   = '#00bcf2'  // primary blue — header, wizard, tab active, day chip (Thu)
moku-coral  = '#f36c57'  // coral red — announcement strip, day chip (Mon), send button
moku-yellow = '#f9b922'  // yellow — FAB, generate button, active step indicator, day chip (Wed)
moku-peach  = '#f9a65d'  // peach — day chip (Tue)
moku-dark   = '#134e9e'  // navy — borders, shadows, text on light, drop-shadows
moku-beige  = '#f0ede6'  // warm beige — card/shell background, bottom nav background
```

Background: `craft-bg` — `#f7f5f0` with a subtle `24px` navy grid (4% opacity).

---

## Typography

- **Fredoka** (Google Fonts) — display. App name, section labels, button text, day chips, tab labels, wizard copy. Use `font-fredoka`.
- **Inter** — body. Everything else. Default `font-sans`.

---

## Logo / Wordmark

SVG bento box icon (coral lid, white interior, two navy eyes + a smile) on a moku-yellow rotated tile (`-rotate-3`). "BentoBot!" in Fredoka Bold white with `drop-shadow-[1.5px_1.5px_0px_#134e9e]`.

---

## Moku Utility Classes

Defined in `src/index.css` — use these consistently, don't recreate inline:

| Class | Effect |
|-------|--------|
| `moku-border` | `3.5px solid #134e9e` on all sides |
| `moku-border-t` | top border only |
| `moku-border-b` | bottom border only |
| `moku-shadow` | `4px 4px 0px #134e9e` (standard hard shadow) |
| `moku-shadow-sm` | `2.5px 2.5px 0px #134e9e` |
| `moku-shadow-lg` | `6px 6px 0px #134e9e` |
| `moku-press` | shrink + shadow reduction on `:active` (press-down feel) |
| `craft-bg` | gridded beige outer background |
| `scallop-wave` | SVG scallop edge (used at base of header) |

---

## Layout

The app is a fixed-size card centered on the page:

```
max-w-md  /  h-[92vh] sm:h-[820px]  /  rounded-[32px]  /  moku-border + shadow-2xl
```

Internal structure (top to bottom):
1. Announcement strip (`bg-moku-coral`, 2 lines text)
2. Header (`bg-moku-blue`) — logo + kid name badge + week nav (Lunch tab only) + scallop-wave bottom
3. Storage error banner (conditional, red)
4. Tab content (flex-1, overflow-y-auto, `pb-20` to clear nav)
5. FAB (`absolute bottom-20 right-4 z-30`) — Lunch tab only
6. Bottom nav (`h-16`, white, `moku-border-t`) — 3 tabs

---

## Day Colors

Each weekday has an assigned chip color used in the wizard and plan cards:

| Day | Class |
|-----|-------|
| Monday | `bg-moku-coral` |
| Tuesday | `bg-moku-peach` |
| Wednesday | `bg-moku-yellow` |
| Thursday | `bg-moku-blue` |
| Friday | `bg-emerald-500` |

---

## UX Rules

| Don't | Do instead |
|-------|------------|
| Use plain modal dialogs | Use full-screen overlays (`absolute inset-0 z-40`) consistent with WizardOverlay |
| Add more than 3 tabs | Keep Lunch / Grocery / Profile |
| Use Tailwind shadcn components | Use plain Tailwind + moku utilities |
| Skip `moku-press` on interactive elements | Every tappable card/button should feel physical |
| Use thin borders or soft shadows | Always `moku-border` + `moku-shadow` for primary UI elements |
