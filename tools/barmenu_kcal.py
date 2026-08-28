# /// script
# requires-python = ">=3.11"
# dependencies = ["click"]
# ///
"""Recompute the `kcal` field of every drink recipe from its ingredients.

The menu shows a calorie figure with no way of noticing when a recipe changes
underneath it, so it is generated rather than hand-maintained. Every nutrient
is read from Pantry at run time: correcting a product there is enough, and no
figure is copied into this file.

    uv run tools/barmenu_kcal.py
"""

from functools import cache
import json
from pathlib import Path
import re
import subprocess

import click

DRINKS = Path("web/barmenu/recipes/drinks")

# Densities in g/ml, needed because recipes pour millilitres and Pantry states
# grams. Spirits are lighter than water; syrups and juices heavier.
SPIRIT = 0.948

# Poured ingredients: name -> (source, product id, g/ml).
LIQUIDS = {
    "gin": ("afcd", "F000051", SPIRIT),
    "vodka": ("afcd", "F000051", SPIRIT),
    "rum": ("afcd", "F000051", SPIRIT),
    "clear rum": ("afcd", "F000051", SPIRIT),
    "dark rum": ("afcd", "F000051", SPIRIT),
    "whiskey": ("afcd", "F000051", SPIRIT),
    "rye whiskey": ("afcd", "F000051", SPIRIT),
    "bourbon": ("afcd", "F000051", SPIRIT),
    "brandy": ("afcd", "F000051", SPIRIT),
    "pisco": ("afcd", "F000051", SPIRIT),
    "red aperitif": ("manual", "campari-aperitivo", 1.03),
    "coffee liqueur": ("manual", "kahlua-coffee-liqueur", 1.0),
    "dry vermouth": ("manual", "martini-extra-dry-vermouth", 1.0),
    "sweet vermouth": ("manual", "martini-rosso-vermouth", 1.0),
    "diet ginger beer": ("manual", "bundaberg-diet-ginger-beer", 1.0),
    "simple syrup": ("manual", "torani-sugar-free-syrup", 1.0),
    "tonic water": ("afcd", "F008460", 1.0),
    "sparkling wine": ("afcd", "F009590", 0.99),
    "red wine": ("afcd", "F009571", 0.99),
    "orange juice": ("afcd", "F004739", 1.04),
    "pineapple juice": ("afcd", "F006710", 1.04),
    "lemon juice": ("afcd", "F004726", 1.03),
    "lime juice": ("afcd", "F004729", 1.03),
    "almond milk": ("afcd", "F009824", 1.03),
    "espresso": ("afcd", "F003041", 1.0),
    "honey": ("afcd", "F004380", 1.42),
    "club soda": ("afcd", "F009516", 1.0),
    "water": ("afcd", "F009516", 1.0),
}

# Ingredients a recipe already measures in grams.
SOLIDS = {"sugar": ("afcd", "F008976")}

# Countable items: name -> (source, product id, grams each).
COUNTED = {
    "maraschino cherry": ("manual", "maraschino-cherry", 5.0),
    "olives": ("afcd", "F006198", 5.0),
    "angostura bitters": ("manual", "angostura-aromatic-bitters", 0.6),
    "orange slices": ("afcd", "F006277", 148.0),
    "lemon slices": ("afcd", "F005174", 64.0),
    "lemon": ("afcd", "F005174", 64.0),
}

# Units naming a whole fruit steeped into a batch, rather than a garnish.
WHOLE_UNITS = ("oranges", "lemons", "pieces")

# Peel and citrus wheels carry aroma to the glass and are left behind.
AROMATIC_UNITS = ("strip", "strips", "slice", "slices", "leaf", "leaves")


def parse_amount(value: str) -> tuple[float, str] | None:
    """Read `60 ml`, `200 g` or `2 dashes` into a quantity and a unit."""
    match = re.match(r"([\d.]+)\s*(\S+)", value.strip())

    return (float(match.group(1)), match.group(2).lower()) if match else None


@cache
def pantry_kcal(source: str, product: str, grams: float) -> float:
    """Ask Pantry what this weight of a product comes to, in kcal."""
    argv = [
        "pantry",
        "lookup",
        source,
        product,
        "--grams",
        f"{grams:.4f}",
        "--json",
    ]
    result = subprocess.run(argv, capture_output=True, text=True, check=True)
    payload = json.loads(result.stdout)

    if not payload.get("ok") or not payload["data"].get("found"):
        raise click.ClickException(f"pantry has no {source}:{product}")

    return float(payload["data"]["product"]["kcal"])


def ingredient_kcal(name: str, value: str) -> float:
    """Energy of one ingredient line. An unknown ingredient counts as zero."""
    amount = parse_amount(value)
    if amount is None:
        return 0.0
    qty, unit = amount

    # Poured volumes are the common case.
    if unit in ("ml", "l") and name in LIQUIDS:
        source, product, density = LIQUIDS[name]
        millilitres = qty * (1000 if unit == "l" else 1)
        return pantry_kcal(source, product, millilitres * density)

    if unit == "g" and name in SOLIDS:
        return pantry_kcal(*SOLIDS[name], qty)

    # A garnish counts only when it is eaten, or steeped into a batch.
    if unit in AROMATIC_UNITS and unit not in WHOLE_UNITS:
        return 0.0

    if name in COUNTED:
        source, product, each = COUNTED[name]
        return pantry_kcal(source, product, qty * each)

    return 0.0


def read_ingredients(source: str) -> dict[str, str]:
    """Read the `ingredients:` block, stopping at the next top-level key."""
    block = re.search(r"^ingredients:\n((?:[ \t]+.*\n)+)", source, re.M)
    if not block:
        return {}

    lines = block.group(1).rstrip("\n").split("\n")
    pairs = (line.split(":", 1) for line in lines)

    return {name.strip(): value.strip() for name, value in pairs}


def read_servings(source: str) -> int:
    """Read `serves:`, which batches set and single drinks leave out."""
    match = re.search(r"^serves:\s*(\d+)", source, re.M)
    serves = int(match.group(1)) if match else 1

    return serves if serves > 0 else 1


def recipe_kcal(ingredients: dict[str, str]) -> float:
    """Energy of a whole recipe, before it is divided into servings."""
    return sum(
        ingredient_kcal(name, value) for name, value in ingredients.items()
    )


def serving_kcal(source: str) -> int:
    """Energy of one serving of a recipe, rounded as the menu prints it."""
    return round(recipe_kcal(read_ingredients(source)) / read_servings(source))


def with_kcal(source: str) -> str:
    """Return the recipe with a `kcal` field matching its ingredients."""
    total = serving_kcal(source)

    # Drop any previous value first, so re-running never stacks the field.
    stripped = re.sub(r"^kcal:.*\n", "", source, flags=re.M)

    return re.sub(
        r"^ingredients:",
        f"kcal: {round(total)}\ningredients:",
        stripped,
        count=1,
        flags=re.M,
    )


@click.command()
@click.option(
    "--dir", "directory", type=click.Path(path_type=Path), default=DRINKS
)
@click.option(
    "--dry-run", is_flag=True, help="Report the figures without writing."
)
def main(directory: Path, dry_run: bool) -> None:
    """Rewrite every drink recipe so its kcal matches its ingredients."""
    recipes = sorted(
        p for p in directory.glob("*.yml") if not p.name.startswith("_")
    )

    for recipe in recipes:
        source = recipe.read_text()
        updated = with_kcal(source)
        changed = updated != source

        if changed and not dry_run:
            recipe.write_text(updated)

        kcal = serving_kcal(source)
        click.echo(
            f"{recipe.stem:<20} {kcal:>4}" + ("  changed" if changed else "")
        )


if __name__ == "__main__":
    main()
