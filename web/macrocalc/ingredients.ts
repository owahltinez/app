/**
 * Returns a copy of the recipe with the given ingredient's amount changed.
 *
 * The edited ingredient is replaced by a new object rather than mutated: the
 * table rows are keyed, so mancha reuses the existing row and only re-renders
 * its cells when the loop variable points at a different object.
 */
export function updateIngredientAmount(
  ingredients: any[],
  target: any,
  grams: number | string
): any[] {
  return ingredients.map((i) =>
    i.title === target.title ? { ...i, grams: Number(grams) } : i
  );
}
