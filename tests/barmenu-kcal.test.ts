import test from "node:test";
import assert from "node:assert/strict";
import {
  ingredientKcal,
  parseAmount,
  readIngredients,
  readServings,
  recipeKcal,
  withKcal,
} from "../tools/barmenu-kcal.js";

test("reads a volume, a weight and a count", () => {
  assert.deepEqual(parseAmount("60 ml"), { qty: 60, unit: "ml" });
  assert.deepEqual(parseAmount("200 g"), { qty: 200, unit: "g" });
  assert.deepEqual(parseAmount("2 dashes"), { qty: 2, unit: "dashes" });
  assert.deepEqual(parseAmount("1.5 l"), { qty: 1.5, unit: "l" });
});

test("returns null for an amount it cannot read", () => {
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("a splash"), null);
});

test("converts litres to millilitres", () => {
  assert.equal(ingredientKcal("red wine", "1.5 l"), 0.793 * 1500);
});

test("counts a garnish that is eaten", () => {
  assert.equal(ingredientKcal("maraschino cherry", "1 cherry"), 8);
  assert.equal(ingredientKcal("olives", "1 olive"), 10);
});

// Peels carry aroma to the glass and are left behind.
test("ignores a garnish that is not eaten", () => {
  assert.equal(ingredientKcal("lemon peel", "1 strip"), 0);
  assert.equal(ingredientKcal("orange slices", "1 slice"), 0);
});

// The same key means whole fruit when a batch recipe counts it in oranges.
test("counts whole fruit macerated into a batch", () => {
  assert.equal(ingredientKcal("orange slices", "4 oranges"), 244);
  assert.equal(ingredientKcal("lemon", "3 pieces"), 51);
});

test("treats an unknown ingredient as zero rather than failing", () => {
  assert.equal(ingredientKcal("unobtainium", "30 ml"), 0);
});

test("sums a recipe", () => {
  const kcal = recipeKcal({
    gin: "60 ml",
    "dry vermouth": "30 ml",
    olives: "1 olive",
  });
  assert.equal(Math.round(kcal), 164);
});

const MARTINI = `name: Martini
container: martini glass
ingredients:
  gin: 60 ml
  dry vermouth: 30 ml
  olives: 1 olive
instructions:
  - Stir with ice
`;

test("reads the ingredients block and stops at the next key", () => {
  assert.deepEqual(readIngredients(MARTINI), {
    gin: "60 ml",
    "dry vermouth": "30 ml",
    olives: "1 olive",
  });
});

test("defaults to a single serving", () => {
  assert.equal(readServings(MARTINI), 1);
  assert.equal(readServings("serves: 16\n"), 16);
  assert.equal(readServings("serves: 0\n"), 1);
});

test("divides a batch into servings", () => {
  const batch = "serves: 2\ningredients:\n  gin: 60 ml\n";
  assert.match(withKcal(batch), /^kcal: 61$/m);
});

test("inserts the field above the ingredients", () => {
  assert.match(withKcal(MARTINI), /^kcal: 164\ningredients:$/m);
});

// Re-running after a recipe edit must replace the field, never stack it.
test("is idempotent", () => {
  const once = withKcal(MARTINI);
  assert.equal(withKcal(once), once);
  assert.equal(once.match(/^kcal:/gm)!.length, 1);
});
