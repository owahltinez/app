export type SortColumn = "name" | "grams" | "kcal" | "protein" | "carbs" | "fat";

// Nutrients are stored per 100g; scale by the amount used so sorting matches
// the totals displayed in the table.
function nutrientTotal(ingredient: any, key: string): number {
  return ((ingredient.grams ?? 0) / 100) * (ingredient.nutrients?.[key] ?? 0);
}

/** Returns a new array sorted by the given column: name A-Z, numeric columns high to low. */
export function sortIngredients(ingredients: any[], column: SortColumn): any[] {
  const sorted = [...ingredients];

  // Name sorts alphabetically; everything else sorts by descending numeric value.
  if (column === "name") {
    sorted.sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
  } else if (column === "grams") {
    sorted.sort((a, b) => (b.grams ?? 0) - (a.grams ?? 0));
  } else {
    sorted.sort((a, b) => nutrientTotal(b, column) - nutrientTotal(a, column));
  }

  return sorted;
}
