import { db } from "./db.js";
import { createAppearanceStore } from "./appearanceStore.js";

export const appearance = createAppearanceStore(db);
