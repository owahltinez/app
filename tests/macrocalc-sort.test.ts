import test from "node:test";
import assert from "node:assert/strict";
import { sortIngredients } from "../web/macrocalc/sort.js";

// Ingredients as stored by the app: nutrients are per 100g, grams is the amount used.
const INGREDIENTS = [
  { name: "almond milk", grams: 150, nutrients: { kcal: 19, protein: 0.5, carbs: 0.8, fat: 1.5 } },
  { name: "buttercream", grams: 15, nutrients: { kcal: 361, protein: 58, carbs: 14, fat: 8 } },
  { name: "choc chips", grams: 15, nutrients: { kcal: 557, protein: 4, carbs: 63, fat: 31 } },
  { name: "salt", grams: 4, nutrients: { kcal: 0, protein: 0, carbs: 0, fat: 0 } },
];

test("sorts by amount from biggest to smallest", () => {
  const sorted = sortIngredients(INGREDIENTS, "grams");
  assert.deepEqual(
    sorted.map((i) => i.name),
    ["almond milk", "buttercream", "choc chips", "salt"]
  );
});

test("sorts by total energy contribution, not per-100g value", () => {
  // choc chips: 557*0.15 = 83.6, buttercream: 361*0.15 = 54.2, almond milk: 19*1.5 = 28.5
  const sorted = sortIngredients(INGREDIENTS, "kcal");
  assert.deepEqual(
    sorted.map((i) => i.name),
    ["choc chips", "buttercream", "almond milk", "salt"]
  );
});

test("sorts by total protein contribution", () => {
  // buttercream: 58*0.15 = 8.7, almond milk: 0.5*1.5 = 0.75, choc chips: 4*0.15 = 0.6
  const sorted = sortIngredients(INGREDIENTS, "protein");
  assert.deepEqual(
    sorted.map((i) => i.name),
    ["buttercream", "almond milk", "choc chips", "salt"]
  );
});

test("sorts by name alphabetically", () => {
  const sorted = sortIngredients(INGREDIENTS, "name");
  assert.deepEqual(
    sorted.map((i) => i.name),
    ["almond milk", "buttercream", "choc chips", "salt"]
  );
});

test("returns a new array and does not mutate the input", () => {
  const input = [...INGREDIENTS];
  const sorted = sortIngredients(input, "kcal");
  assert.notEqual(sorted, input);
  assert.deepEqual(
    input.map((i) => i.name),
    INGREDIENTS.map((i) => i.name)
  );
});

test("tolerates missing nutrients and grams", () => {
  const items = [
    { name: "a", grams: 10, nutrients: { kcal: 100 } },
    { name: "b" },
    { name: "c", grams: 50, nutrients: {} },
  ];
  const sorted = sortIngredients(items, "kcal");
  assert.equal(sorted[0].name, "a");
  assert.equal(sorted.length, 3);
});
