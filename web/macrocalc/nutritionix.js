const AUTH_URL = "http://127.0.0.1:8787";
const BASE_URL = "https://trackapi.nutritionix.com/v2";

function titleCase(str) {
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function authenticatedRequest(url, options = {}) {
  const targetUrl = new URL(AUTH_URL);
  targetUrl.searchParams.set("url", url);
  new URL(url).searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));
  return fetch(targetUrl, options);
}

function parseNutrients(result) {
  let totalGrams;
  const qty = result.nf_metric_qty;
  const unit = result.nf_metric_uom;
  if (result.serving_weight_grams) {
    totalGrams = result.serving_weight_grams;
  } else if (qty && ["g", "ml"].includes(unit)) {
    totalGrams = qty;
  } else {
    console.error(`Unknown unit or missing quantity: ${result}`);
    return null;
  }
  return {
    kcal: ((result.nf_calories || 0) / totalGrams) * 100,
    protein: ((result.nf_protein || 0) / totalGrams) * 100,
    fat: ((result.nf_total_fat || 0) / totalGrams) * 100,
    carbs: ((result.nf_total_carbohydrate || 0) / totalGrams) * 100,
    fiber: ((result.nf_dietary_fiber || 0) / totalGrams) * 100,
    sugar: ((result.nf_sugars || 0) / totalGrams) * 100,
  };
}

async function parseFoodSearchResult(result) {
  const branded = !!result.nix_item_id;
  const id = result.nix_item_id || result.food_name;
  const nutritionResult = await (branded
    ? lookupBrandedFood(id)
    : lookupCommonFood(id));
  return {
    id,
    name: result.food_name,
    title: `${titleCase(result.food_name)} (${result.brand_name || "Generic"})`,
    nutrients: parseNutrients(nutritionResult.foods[0]),
    serving: {
      size: result.serving_qty,
      unit: result.serving_unit,
    },
    url: `https://www.nutritionix.com/food/${result.food_name}`,
  };
}

function lookupCommonFood(name) {
  const url = new URL(`${BASE_URL}/natural/nutrients`);
  const options = {
    method: "POST",
    body: JSON.stringify({ query: name }),
    headers: { "Content-Type": "application/json" },
  };
  return authenticatedRequest(url, options).then((res) => res.json());
}

function lookupBrandedFood(nixId) {
  const url = new URL(`${BASE_URL}/search/item`);
  url.searchParams.set("nix_item_id", nixId);
  return authenticatedRequest(url).then((res) => res.json());
}

export class Nutritionix {
  async searchFoods(query, { limit = 10 } = {}) {
    const url = new URL(`${BASE_URL}/search/instant`);
    url.searchParams.set("query", query);
    const result = await authenticatedRequest(url).then((res) => res.json());
    if (result.message) throw new Error(result.message);
    const commonFoods = await Promise.all(
      result.common.slice(0, limit).map(parseFoodSearchResult)
    );
    const brandedFoods = await Promise.all(
      result.branded.slice(0, limit).map(parseFoodSearchResult)
    );
    return [...commonFoods, ...brandedFoods].filter((x) => x.nutrients);
  }

  async lookupFoodId(foodId, branded = true) {
    let result;
    if (branded) {
      result = await lookupBrandedFood(foodId);
    } else {
      result = await lookupCommonFood(foodId);
    }
    if (result.message) throw new Error(result.message);
    return parseFoodSearchResult(result.foods[0]);
  }
}
