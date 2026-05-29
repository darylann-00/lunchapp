// Per-dish prep progress: each dish's `prepNotes` string is split into discrete
// checkable steps. A dish is "prepped" (DONE) when every one of its steps is checked.
// Checked steps are stored per plan as { [dishId]: number[] } (the checked indices).

export type PrepProgress = Record<string, number[]>;

const LIST_MARKER = /^(?:step\s*\d+\s*[:.)-]?\s*|\d+\s*[.)-]\s*|[-•*]\s*)/i;

/**
 * Split a dish's freeform prepNotes into discrete steps.
 * Prefers explicit line breaks; falls back to sentence boundaries.
 * Strips leading list markers ("1.", "- ", "Step 2:", etc.).
 */
export function splitPrepSteps(prepNotes: string): string[] {
  const trimmed = (prepNotes ?? '').trim();
  if (!trimmed) return [];

  let parts = trimmed
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    parts = trimmed
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return parts.map((p) => p.replace(LIST_MARKER, '').trim()).filter(Boolean);
}

/**
 * Steps to show for a dish in the prep checklist. Always returns at least one
 * step so packaged/no-prep items can still be marked done.
 */
export function dishSteps(name: string, prepNotes: string): string[] {
  const steps = splitPrepSteps(prepNotes);
  return steps.length > 0 ? steps : [`Pack ${name}`.trim()];
}

/** True when every step of the dish has been checked. */
export function isDishPrepped(
  dishId: string,
  name: string,
  prepNotes: string,
  prepProgress: PrepProgress,
): boolean {
  const steps = dishSteps(name, prepNotes);
  const checked = prepProgress[dishId] ?? [];
  return steps.length > 0 && steps.every((_, i) => checked.includes(i));
}

/** Toggle a single step index for a dish, returning a new progress map. */
export function toggleStep(
  prepProgress: PrepProgress,
  dishId: string,
  stepIndex: number,
): PrepProgress {
  const current = prepProgress[dishId] ?? [];
  const next = current.includes(stepIndex)
    ? current.filter((i) => i !== stepIndex)
    : [...current, stepIndex].sort((a, b) => a - b);
  return { ...prepProgress, [dishId]: next };
}
