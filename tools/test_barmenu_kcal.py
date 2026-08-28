"""Tests for the drink calorie generator.

Pantry is stubbed so the arithmetic is checked without the tool installed, and
so a corrected product record cannot break an unrelated assertion.
"""

import barmenu_kcal as gen
import pytest

MARTINI = """name: Martini
container: martini glass
ingredients:
  gin: 60 ml
  dry vermouth: 30 ml
  olives: 1 olive
instructions:
  - Stir with ice
"""


@pytest.fixture(autouse=True)
def stub_pantry(monkeypatch):
    """Answer every lookup with 1 kcal per gram, so weights are readable."""
    monkeypatch.setattr(
        gen, "pantry_kcal", lambda source, product, grams: grams
    )


def test_reads_a_volume_a_weight_and_a_count():
    assert gen.parse_amount("60 ml") == (60.0, "ml")
    assert gen.parse_amount("200 g") == (200.0, "g")
    assert gen.parse_amount("2 dashes") == (2.0, "dashes")
    assert gen.parse_amount("1.5 l") == (1.5, "l")


def test_returns_none_for_an_unreadable_amount():
    assert gen.parse_amount("") is None
    assert gen.parse_amount("a splash") is None


def test_applies_density_to_a_poured_volume():
    assert gen.ingredient_kcal("gin", "60 ml") == pytest.approx(60 * gen.SPIRIT)


def test_converts_litres_to_millilitres():
    assert gen.ingredient_kcal("red wine", "1.5 l") == pytest.approx(
        1500 * 0.99
    )


def test_counts_a_garnish_that_is_eaten():
    assert gen.ingredient_kcal(
        "maraschino cherry", "1 cherry"
    ) == pytest.approx(5.0)
    assert gen.ingredient_kcal("olives", "1 olive") == pytest.approx(5.0)


def test_ignores_a_garnish_that_is_not_eaten():
    assert gen.ingredient_kcal("lemon peel", "1 strip") == 0.0
    assert gen.ingredient_kcal("orange slices", "1 slice") == 0.0
    assert gen.ingredient_kcal("fresh mint", "8 leaves") == 0.0


def test_counts_whole_fruit_steeped_into_a_batch():
    assert gen.ingredient_kcal("orange slices", "4 oranges") == pytest.approx(
        4 * 148.0
    )
    assert gen.ingredient_kcal("lemon", "3 pieces") == pytest.approx(3 * 64.0)


def test_treats_an_unknown_ingredient_as_zero():
    assert gen.ingredient_kcal("unobtainium", "30 ml") == 0.0


def test_reads_the_ingredients_block_and_stops_at_the_next_key():
    assert gen.read_ingredients(MARTINI) == {
        "gin": "60 ml",
        "dry vermouth": "30 ml",
        "olives": "1 olive",
    }


def test_defaults_to_a_single_serving():
    assert gen.read_servings(MARTINI) == 1
    assert gen.read_servings("serves: 16\n") == 16
    assert gen.read_servings("serves: 0\n") == 1


def test_divides_a_batch_into_servings():
    batch = "serves: 2\ningredients:\n  gin: 60 ml\n"
    assert "kcal: 28\n" in gen.with_kcal(batch)


def test_inserts_the_field_above_the_ingredients():
    assert "kcal: 92\ningredients:" in gen.with_kcal(MARTINI)


def test_is_idempotent():
    once = gen.with_kcal(MARTINI)
    assert gen.with_kcal(once) == once
    assert once.count("kcal:") == 1
