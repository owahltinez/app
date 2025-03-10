import Fuse from "fuse.js";

async function fetchAndProcessProducts() {
  const products = await fetch("products.json").then((r) => r.json());
  return products.map((product: any) => ({
    ...product,
    search: `${product.name} ${product.brand}`.toLocaleLowerCase(),
  }));
}

function parseProductLookupResult(result: any) {
  return {
    id: result.id,
    name: result.name,
    title: `${result.name} (${result.brand})`,
    nutrients: {
      kcal: result.kcal || 0,
      protein: result.protein || 0,
      fat: result.fat || 0,
      carbs: result.carbs || 0,
      fiber: result.fiber || 0,
      sugar: result.sugar || 0,
    },
    serving: {
      size: result.serving_size,
      unit: result.serving_unit,
    },
    url: result.url,
    source: "local",
  };
}

const fuseOptions = {
  keys: ["search"],
  ignoreDiacritics: true,
  ignoreLocation: true,
  includeScore: true,
  threshold: 0.4,
};

function searchProducts(
  fuse: Fuse<any & { search: string }>,
  query: string
): any & { search: string }[] {
  const queryKeywords = new Set(
    query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 1)
  );
  if (queryKeywords.size === 0) return [];

  // Here we do the following:
  // 1. Iterate over each of the query keywords
  // 2. Perform fuzzy search for each keyword
  // 3. Add up the scores for each product
  const results = new Map();
  for (const keyword of queryKeywords) {
    for (const { item, score } of fuse.search(keyword)) {
      const normScore = 1 - (score || 0);
      if (!score) continue;
      results.set(item.id, {
        item,
        score: (results.get(item.id)?.score || 0) + normScore,
      });
    }
  }

  // Sort the results by score and return them.
  return Array.from(results.values())
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

export class Local {
  _fuse: Promise<Fuse<any>> | null;
  _products: Promise<any> | null;

  constructor() {
    this._fuse = null;
    this._products = null;
  }

  get products() {
    if (!this._products) {
      this._products = fetchAndProcessProducts();
    }
    return this._products;
  }

  get fuse() {
    if (!this._fuse) {
      this._fuse = this.products.then(
        (products) => new Fuse(products, fuseOptions)
      );
    }
    return this._fuse;
  }

  async lookupFoodId(id: string | number) {
    const products = await this.products;
    return parseProductLookupResult(products.find((p: any) => p.id == id));
  }

  async searchFoods(query: string, { limit = 10 } = {}) {
    const fuse = await this.fuse;
    return searchProducts(fuse, query)
      .slice(0, limit)
      .map(parseProductLookupResult);
  }
}
