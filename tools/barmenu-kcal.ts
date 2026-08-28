/**
 * Recomputes the `kcal` field of every drink recipe from its ingredients.
 *
 * The menu shows a calorie figure that has no way of noticing when a recipe
 * changes underneath it, so it is generated rather than hand-maintained. Run
 * `npm run kcal` after editing any recipe.
 *
 * Figures come from Pantry: AFCD for spirits, juices, tonic, wine and olives,
 * and published labels for the branded bottles. Editing a value here means
 * editing the matching Pantry record too.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

/** Energy of a liquid ingredient, in kcal per millilitre. */
export const PER_ML: Readonly<Record<string, number>> = {
  // AFCD F000051, 213.2 kcal/100 g at 0.948 g/ml. Every 40% spirit shares it.
  gin: 2.021,
  vodka: 2.021,
  rum: 2.021,
  "clear rum": 2.021,
  "dark rum": 2.021,
  whiskey: 2.021,
  "rye whiskey": 2.021,
  bourbon: 2.021,
  brandy: 2.021,
  pisco: 2.021,

  // Branded bottles, from their own labels.
  "red aperitif": 2.09, // Campari, 25% ABV
  "coffee liqueur": 2.67, // Kahlua, 20% ABV
  "dry vermouth": 1.1, // Martini Extra Dry, 18% ABV
  "sweet vermouth": 1.47, // Martini Rosso, 15% ABV
  "diet ginger beer": 0.067, // Bundaberg Diet
  "simple syrup": 0.0, // Torani sugar free: 0 kcal, 9 g sugar alcohol per 30 ml

  // AFCD.
  "tonic water": 0.339,
  "sparkling wine": 0.724,
  "red wine": 0.793,
  "orange juice": 0.333,
  "pineapple juice": 0.5,
  "lemon juice": 0.25,
  "lime juice": 0.25,
  "almond milk": 0.15,
  espresso: 0.07,
  honey: 4.32,
  "club soda": 0,
  water: 0,
};

/** Energy of a solid ingredient, in kcal per gram. */
export const PER_GRAM: Readonly<Record<string, number>> = { sugar: 4.0 };

/**
 * Energy of a countable garnish, in kcal each.
 *
 * Peels and citrus wheels are zero on purpose: they carry aroma to the glass
 * and are left behind, unlike an olive or a cherry.
 */
export const PER_UNIT: Readonly<Record<string, number>> = {
  "maraschino cherry": 8.0, // USDA, 165 kcal/100 g at ~5 g
  olives: 10.0, // AFCD F006198, 207.5 kcal/100 g at ~5 g
  "angostura bitters": 0.86, // 143 kcal/100 ml at ~0.6 ml per dash
  "fresh mint": 0.0,
  "lemon peel": 0.0,
  "orange peel": 0.0,
};

/** Energy of a whole fruit macerated into a batch, in kcal each. */
export const PER_FRUIT: Readonly<Record<string, number>> = {
  "orange slices": 61.0,
  "lemon slices": 17.0,
  lemon: 17.0,
};

export interface Amount {
  qty: number;
  /** `ml`, `l`, `g`, or the plural noun a countable amount is measured in. */
  unit: string;
}

/** Reads `60 ml`, `200 g` or `2 dashes` into a quantity and a unit. */
export function parseAmount(value: string): Amount | null {
  const match = /^([\d.]+)\s*(\S+)/.exec(value.trim());
  if (!match) return null;

  return { qty: Number(match[1]), unit: match[2].toLowerCase() };
}

/** Energy of one ingredient line, in kcal. Unknown ingredients are zero. */
export function ingredientKcal(name: string, value: string): number {
  const amount = parseAmount(value);
  if (!amount) return 0;

  // Volumes and weights are the common case.
  if (amount.unit === "ml") return (PER_ML[name] ?? 0) * amount.qty;
  if (amount.unit === "l") return (PER_ML[name] ?? 0) * amount.qty * 1000;
  if (amount.unit === "g") return (PER_GRAM[name] ?? 0) * amount.qty;

  // Whole fruit steeped into a punch or a sangria still counts.
  if (/^(oranges|lemons|pieces)$/.test(amount.unit)) {
    return (PER_FRUIT[name] ?? 0) * amount.qty;
  }

  return (PER_UNIT[name] ?? 0) * amount.qty;
}

/** Energy of a whole recipe, in kcal, before it is divided into servings. */
export function recipeKcal(ingredients: Record<string, string>): number {
  return Object.entries(ingredients).reduce(
    (total, [name, value]) => total + ingredientKcal(name, value),
    0,
  );
}

/**
 * Reads the `ingredients:` block of a recipe.
 *
 * The files are edited line by line rather than parsed and re-dumped, because
 * a YAML round trip would reformat all of them for the sake of one field.
 */
export function readIngredients(source: string): Record<string, string> {
  const block = /^ingredients:\n((?:[ \t]+.*\n)+)/m.exec(source);
  if (!block) return {};

  const entries = block[1]
    .trimEnd()
    .split("\n")
    .map((line) => {
      const [name, ...rest] = line.trim().split(":");
      return [name.trim(), rest.join(":").trim()] as const;
    });

  return Object.fromEntries(entries);
}

/** Reads `serves:`, which batch recipes set and single drinks leave out. */
export function readServings(source: string): number {
  const match = /^serves:\s*(\d+)/m.exec(source);
  const serves = match ? Number(match[1]) : 1;

  return Number.isFinite(serves) && serves > 0 ? serves : 1;
}

/** Returns the recipe with a `kcal` field matching its ingredients. */
export function withKcal(source: string): string {
  const kcal = Math.round(
    recipeKcal(readIngredients(source)) / readServings(source),
  );

  // Drop any previous value first, so re-running never stacks the field.
  const stripped = source.replace(/^kcal:.*\n/m, "");

  return stripped.replace(/^ingredients:/m, `kcal: ${kcal}\ningredients:`);
}

const DRINKS = "web/barmenu/recipes/drinks";

/** Rewrites every drink recipe in place, reporting what each one came to. */
async function main(): Promise<void> {
  const names = (await fs.readdir(DRINKS))
    .filter((name) => name.endsWith(".yml") && !name.startsWith("_"))
    .sort();

  for (const name of names) {
    const file = path.join(DRINKS, name);
    const source = await fs.readFile(file, "utf8");
    const updated = withKcal(source);

    if (updated !== source) await fs.writeFile(file, updated);
    console.log(
      `${name.replace(/\.yml$/, "").padEnd(20)} ${/^kcal: (\d+)/m.exec(updated)![1]}`,
    );
  }
}

if (process.argv[1]?.endsWith("barmenu-kcal.js")) await main();
