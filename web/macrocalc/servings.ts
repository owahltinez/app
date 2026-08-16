/** A recipe is always at least one serving, so the label never divides by zero. */
const MIN_SERVINGS = 1;

/** Coerces the bound input value into a usable serving count. */
export function parseServings(value: unknown): number {
  const parsed = Number(value);

  // Blank, non-numeric and out-of-range input all fall back to a single serving.
  if (!Number.isFinite(parsed) || parsed < MIN_SERVINGS) return MIN_SERVINGS;

  return parsed;
}

/** Splits a recipe total into the amount contained in one serving. */
export function perServing(total: number, servings: unknown): number {
  return total / parseServings(servings);
}
