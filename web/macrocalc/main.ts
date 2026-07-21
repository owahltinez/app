import { Local } from "./local.js";
import { USDA } from "./usda.js";

export { sortIngredients } from "./sort.js";

export const db = {
  local: new Local(),
  usda: new USDA(),
};
