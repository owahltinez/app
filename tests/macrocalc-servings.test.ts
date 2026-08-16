import test from "node:test";
import assert from "node:assert/strict";
import { parseServings, perServing } from "../web/macrocalc/servings.js";

test("keeps a valid serving count", () => {
  assert.equal(parseServings(8), 8);
  assert.equal(parseServings(1), 1);
});

// The input is bound to a text field, so the value arrives as a string.
test("coerces numeric strings", () => {
  assert.equal(parseServings("8"), 8);
  assert.equal(parseServings("2.5"), 2.5);
});

test("falls back to a single serving for empty input", () => {
  assert.equal(parseServings(""), 1);
  assert.equal(parseServings(null), 1);
  assert.equal(parseServings(undefined), 1);
});

test("falls back to a single serving for junk input", () => {
  assert.equal(parseServings("abc"), 1);
  assert.equal(parseServings(Number.NaN), 1);
  assert.equal(parseServings(Number.POSITIVE_INFINITY), 1);
});

// Zero servings would divide the label by zero and render Infinity.
test("falls back to a single serving for zero and negatives", () => {
  assert.equal(parseServings(0), 1);
  assert.equal(parseServings(-4), 1);
});

test("divides a total into servings", () => {
  assert.equal(perServing(400, 4), 100);
  assert.equal(perServing(141, 2), 70.5);
});

test("leaves the total untouched for a single serving", () => {
  assert.equal(perServing(141, 1), 141);
});

test("never returns a non-finite amount", () => {
  for (const bad of [0, -1, "", null, undefined, "abc"]) {
    const result = perServing(141, bad);
    assert.ok(
      Number.isFinite(result),
      `expected finite for ${JSON.stringify(bad)}`,
    );
    assert.equal(result, 141);
  }
});
