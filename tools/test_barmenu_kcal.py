"""Tests for the drink recipe generator.

EZ Health is never called: these check what is sent to it and how its answer
is written back.
"""

import barmenu_kcal as gen
import pytest

MARTINI = """name: Martini
description: dry and crisp
container: martini glass
ingredients:
  gin: 60 ml
  dry vermouth: 30 ml
  olives: 1 olive
  lemon peel: 1 strip
instructions:
  - Stir with ice
  - (O) Add a lemon twist
tags:
  - classic
"""


def test_reads_a_volume_a_weight_and_a_count():
    assert gen.parse_amount("60 ml") == (60.0, "ml")
    assert gen.parse_amount("200 g") == (200.0, "g")
    assert gen.parse_amount("2 dashes") == (2.0, "dashes")
    assert gen.parse_amount("1.5 l") == (1.5, "l")


def test_returns_none_for_an_unreadable_amount():
    assert gen.parse_amount("") is None
    assert gen.parse_amount("a splash") is None


def test_applies_density_to_a_poured_volume():
    item = gen.ingredient("gin", "60 ml")
    assert item["source"] == "afcd"
    assert item["grams"] == pytest.approx(60 * gen.SPIRIT)


def test_converts_litres_to_millilitres():
    assert gen.ingredient("red wine", "1.5 l")["grams"] == pytest.approx(
        1500 * 0.99
    )


def test_takes_a_weight_as_given():
    assert gen.ingredient("sugar", "200 g")["grams"] == 200


def test_counts_a_garnish_that_is_eaten():
    assert gen.ingredient("maraschino cherry", "1 cherry")["grams"] == 5.0
    assert gen.ingredient("olives", "2 olives")["grams"] == 10.0


def test_ignores_a_garnish_that_is_not_eaten():
    assert gen.ingredient("lemon peel", "1 strip") is None
    assert gen.ingredient("orange slices", "1 slice") is None
    assert gen.ingredient("fresh mint", "8 leaves") is None


def test_counts_whole_fruit_steeped_into_a_batch():
    assert gen.ingredient("orange slices", "4 oranges")["grams"] == 4 * 148.0
    assert gen.ingredient("lemon", "3 pieces")["grams"] == 3 * 64.0


def test_ignores_an_unknown_ingredient():
    assert gen.ingredient("unobtainium", "30 ml") is None


def test_reads_the_ingredients_block_and_stops_at_the_next_key():
    assert gen.read_ingredients(MARTINI) == {
        "gin": "60 ml",
        "dry vermouth": "30 ml",
        "olives": "1 olive",
        "lemon peel": "1 strip",
    }


def test_defaults_to_a_single_serving():
    assert gen.read_servings(MARTINI) == 1
    assert gen.read_servings("serves: 16\n") == 16
    assert gen.read_servings("serves: 0\n") == 1


def test_builds_the_recipe_from_the_drink():
    body = gen.recipe("martini", MARTINI)
    assert body["id"] == "martini"
    assert body["name"] == "Martini"
    assert body["servings"] == 1
    assert [i["id"] for i in body["ingredients"]] == [
        "F000051",
        "F009567",
        "F006198",
    ]
    assert body["notes"] == (
        "dry and crisp\n- Stir with ice\n- Optional: Add a lemon twist"
    )


def test_inserts_the_field_above_the_ingredients():
    assert "kcal: 165\ningredients:" in gen.with_kcal(MARTINI, 164.6)


def test_is_idempotent():
    once = gen.with_kcal(MARTINI, 165)
    assert gen.with_kcal(once, 165) == once
    assert once.count("kcal:") == 1


def test_reads_the_menu_without_commented_drinks(tmp_path):
    (tmp_path / "_index.yml").write_text("- martini\n# - punch\n- mimosa\n")
    assert gen.menu(tmp_path) == ["martini", "mimosa"]
