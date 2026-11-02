# /// script
# requires-python = ">=3.11"
# dependencies = ["click"]
# ///
"""Save every drink on the menu as an EZ Health recipe and copy back its kcal.

The menu shows a calorie figure with no way of noticing when a recipe changes
underneath it, so it is generated rather than hand-maintained. EZ Health fills
each ingredient's figures from its catalog, so the menu and a logged drink
always agree, and no figure is copied into this file.

    sops exec-env ~/secrets/shell.env 'uv run tools/barmenu_kcal.py'
"""

import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.request

import click

DRINKS = Path("web/barmenu/recipes/drinks")
API = "https://ezhealth.wtz.app/api"

# Densities in g/ml, needed because recipes pour millilitres and most catalog
# foods state grams. Spirits are lighter than water; syrups and juices heavier.
SPIRIT = 0.948

# Poured ingredients: name -> (source, food id, g/ml). Foods stated per 100 ml
# take millilitres as they are, so they carry 1.0.
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
    # Closest catalog records to Campari, Kahlua and the Martini vermouths.
    "red aperitif": ("usda", "173176", 1.03),
    "coffee liqueur": ("usda", "175097", 1.1),
    "dry vermouth": ("afcd", "F009567", 0.99),
    "sweet vermouth": ("afcd", "F009566", 1.02),
    "diet ginger beer": ("usda", "1879736", 1.0),
    "simple syrup": ("usda", "2396581", 1.0),
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

# Countable items: name -> (source, food id, grams each).
COUNTED = {
    "maraschino cherry": ("usda", "167766", 5.0),
    "olives": ("afcd", "F006198", 5.0),
    "angostura bitters": ("afcd", "F000051", 0.6),
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


def ingredient(name: str, value: str) -> dict | None:
    """The catalog food and weight of an ingredient, or None if not drunk."""
    amount = parse_amount(value)
    if amount is None:
        return None
    qty, unit = amount

    # Poured volumes are the common case.
    if unit in ("ml", "l") and name in LIQUIDS:
        source, food, density = LIQUIDS[name]
        millilitres = qty * (1000 if unit == "l" else 1)
        return {"source": source, "id": food, "grams": millilitres * density}

    if unit == "g" and name in SOLIDS:
        source, food = SOLIDS[name]
        return {"source": source, "id": food, "grams": qty}

    # A garnish counts only when it is eaten, or steeped into a batch.
    if unit in AROMATIC_UNITS and unit not in WHOLE_UNITS:
        return None

    if name in COUNTED:
        source, food, each = COUNTED[name]
        return {"source": source, "id": food, "grams": qty * each}

    return None


def read_field(source: str, key: str) -> str:
    """Read a top-level scalar field, or an empty string."""
    match = re.search(rf"^{key}:\s*(.*)$", source, re.M)

    return match.group(1).strip() if match else ""


def read_block(source: str, key: str) -> list[str]:
    """Read the indented lines under a top-level key, up to the next one."""
    block = re.search(rf"^{key}:\n((?:[ \t]+.*\n?)+)", source, re.M)

    return block.group(1).rstrip("\n").split("\n") if block else []


def read_ingredients(source: str) -> dict[str, str]:
    """Read the `ingredients:` block into names and amounts."""
    pairs = (line.split(":", 1) for line in read_block(source, "ingredients"))

    return {name.strip(): value.strip() for name, value in pairs}


def read_servings(source: str) -> int:
    """Read `serves:`, which batches set and single drinks leave out."""
    serves = read_field(source, "serves")
    serves = int(serves) if serves.isdigit() else 1

    return serves if serves > 0 else 1


def recipe(slug: str, source: str) -> dict:
    """The EZ Health recipe for one drink file."""
    steps = [
        re.sub(r"^\s*-\s*(\(O\)\s*)?", r"- \1", line).replace(
            "(O) ", "Optional: "
        )
        for line in read_block(source, "instructions")
    ]
    items = (ingredient(*pair) for pair in read_ingredients(source).items())

    return {
        "id": slug,
        "name": read_field(source, "name"),
        "servings": read_servings(source),
        "tags": ["category:drinks"],
        "notes": "\n".join([read_field(source, "description"), *steps]),
        "ingredients": [item for item in items if item],
    }


def with_kcal(source: str, kcal: float) -> str:
    """Return the recipe with a `kcal` field set to the given figure."""
    # Drop any previous value first, so re-running never stacks the field.
    stripped = re.sub(r"^kcal:.*\n", "", source, flags=re.M)

    return re.sub(
        r"^ingredients:",
        f"kcal: {round(kcal)}\ningredients:",
        stripped,
        count=1,
        flags=re.M,
    )


def menu(directory: Path) -> list[str]:
    """The drinks on the menu, skipping any commented out of the index."""
    index = (directory / "_index.yml").read_text()

    return re.findall(r"^-\s*(\S+)", index, re.M)


def save_recipe(body: dict, key: str) -> dict:
    """Create or replace the recipe in EZ Health and return its view."""
    request = urllib.request.Request(
        f"{API}/recipe",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as err:
        raise click.ClickException(
            f"saving {body['id']} failed: {err.code} {err.read().decode()}"
        ) from err


@click.command()
@click.option(
    "--dir", "directory", type=click.Path(path_type=Path), default=DRINKS
)
def main(directory: Path) -> None:
    """Save every drink on the menu to EZ Health and update its kcal."""
    key = os.environ.get("EZHEALTH_API_KEY")
    if not key:
        raise click.ClickException("EZHEALTH_API_KEY is not set")

    for slug in menu(directory):
        path = directory / f"{slug}.yml"
        source = path.read_text()
        kcal = save_recipe(recipe(slug, source), key)["per_serving"]["kcal"]
        updated = with_kcal(source, kcal)
        changed = updated != source

        if changed:
            path.write_text(updated)

        click.echo(
            f"{slug:<20} {round(kcal):>4}" + ("  changed" if changed else "")
        )


if __name__ == "__main__":
    main()
