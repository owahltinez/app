// Super secret, high-level security.
const API_KEY_1 = "TECNS4mXvDoMJgtBqeJG";
const API_KEY_2 = "OmbTyuzaBlC3eGme0gru";
const BASE_URL = "https://api.nal.usda.gov/fdc/v1";

function titleCase(str) {
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function authenticatedRequest(url) {
  url.searchParams.set("api_key", API_KEY_1 + API_KEY_2);
  return fetch(url);
}

function parseNutrients(nutrients) {
  const x = nutrients.reduce(
    (agg, n) => ({
      ...agg,
      [n.nutrientName || n.nutrient.name]: {
        value: n.value || n.amount || 0,
        unit: n.unitName || n.nutrient.unitName || "",
      },
    }),
    {}
  );
  x["Energy"] =
    x["Energy"] ||
    x["Energy (Atwater Specific Factors)"] ||
    x["Energy (Atwater General Factors)"];
  const energyConversionFactor =
    x["Energy"]?.unit?.toLowerCase() === "kj" ? 0.239006 : 1;
  return {
    kcal: x["Energy"]?.value * energyConversionFactor,
    protein: x["Protein"]?.value || 0,
    fat: x["Total lipid (fat)"]?.value || 0,
    carbs: x["Carbohydrate, by difference"]?.value || 0,
    fiber: x["Fiber, total dietary"]?.value || 0,
    sugar: x["Total Sugars"]?.value || 0,
  };
}

function parseFoodSearchResult(result) {
  result.description = titleCase(result.description);
  result.brandName = titleCase(result.brandName || "Generic");
  return {
    id: result.fdcId,
    name: result.description,
    title: `${result.description} (${result.brandName})`,
    nutrients: parseNutrients(result.foodNutrients),
    serving: {
      size: result.servingSize,
      unit: result.servingSizeUnit,
    },
    url: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${result.fdcId}/nutrients`,
  };
}

function parseFoodIdLookupResult(result) {
  result.description = titleCase(result.description);
  result.brandName = titleCase(result.brandName || "Generic");
  return {
    id: result.fdcId,
    name: result.description,
    title: `${result.description} (${result.brandName})`,
    nutrients: parseNutrients(result.foodNutrients),
    // NOTE: These are different numbers! Probably depends on serving size.
    // nutrients: {
    //   kcal: result.labelNutrients.calories?.value || 0,
    //   protein: result.labelNutrients.protein?.value || 0,
    //   fat: result.labelNutrients.fat?.value || 0,
    //   carbs: result.labelNutrients.carbohydrates?.value || 0,
    //   fiber: result.labelNutrients.fiber?.value || 0,
    //   sugar: result.labelNutrients.sugars?.value || 0,
    // },
    serving: {
      size: result.servingSize,
      unit: result.servingSizeUnit,
    },
    url: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${result.fdcId}/nutrients`,
  };
}

function filterMissingMacros(food) {
  return Object.keys(food.nutrients).some((k) => food.nutrients[k] > 0);
}

export class USDA {
  async lookupFoodId(fdcId) {
    const url = new URL(`${BASE_URL}/food/${fdcId}`);
    const result = await authenticatedRequest(url).then((res) => res.json());
    return { source: "usda", ...parseFoodIdLookupResult(result) };
  }

  async searchFoods(query, { limit = 10 } = {}) {
    this.ingredientChoices = [];
    const url = new URL(`${BASE_URL}/foods/search`);
    url.searchParams.set("query", query);
    url.searchParams.set("dataType", "Branded,Foundation");
    const result = await authenticatedRequest(url).then((res) => res.json());
    if (result.error?.message) throw new Error(result.error.message);
    return result.foods
      .map(parseFoodSearchResult)
      .filter(filterMissingMacros)
      .slice(0, limit)
      .map((food) => ({ source: "usda", ...food }));
  }
}
