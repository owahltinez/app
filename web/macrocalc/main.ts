import { Local } from "./local.js";
import { USDA } from "./usda.js";

export const db = {
  local: new Local(),
  usda: new USDA(),
};
