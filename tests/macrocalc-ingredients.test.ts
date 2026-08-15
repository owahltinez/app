import test from "node:test";
import assert from "node:assert/strict";
import { updateIngredientAmount } from "../web/macrocalc/ingredients.js";

const INGREDIENTS = [
  { title: "almond milk (generic)", grams: 150, nutrients: { kcal: 19 } },
  { title: "choc chips (generic)", grams: 15, nutrients: { kcal: 557 } },
];

test("updates the amount of the matching ingredient", () => {
  const updated = updateIngredientAmount(INGREDIENTS, INGREDIENTS[0], 250);
  assert.equal(updated[0].grams, 250);
  assert.equal(updated[1].grams, 15);
});

test("keeps the rest of the ingredient data intact", () => {
  const updated = updateIngredientAmount(INGREDIENTS, INGREDIENTS[1], 30);
  assert.deepEqual(updated[1], { ...INGREDIENTS[1], grams: 30 });
});

// The keyed `:for` rows only re-render when the ingredient object identity
// changes, so mutating in place leaves the table showing the old amount.
test("replaces the edited ingredient instead of mutating it", () => {
  const updated = updateIngredientAmount(INGREDIENTS, INGREDIENTS[0], 250);
  assert.notEqual(updated[0], INGREDIENTS[0]);
  assert.equal(INGREDIENTS[0].grams, 150);
});

test("returns a new array and leaves untouched ingredients as-is", () => {
  const updated = updateIngredientAmount(INGREDIENTS, INGREDIENTS[0], 250);
  assert.notEqual(updated, INGREDIENTS);
  assert.equal(updated[1], INGREDIENTS[1]);
});

test("coerces string amounts coming from the prompt", () => {
  const updated = updateIngredientAmount(INGREDIENTS, INGREDIENTS[0], "250");
  assert.equal(updated[0].grams, 250);
});

test("leaves the recipe unchanged when the ingredient is not found", () => {
  const updated = updateIngredientAmount(INGREDIENTS, { title: "salt" }, 10);
  assert.deepEqual(updated, INGREDIENTS);
});
