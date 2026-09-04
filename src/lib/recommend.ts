import type { Dish, Preferences, ScoredDish } from "./types";

const DIET_ALLOWS: Record<Preferences["diet"], (d: Dish) => boolean> = {
  omnivore: () => true,
  pescatarian: (d) => d.tags.includes("pescatarian") || d.tags.includes("vegetarian") || d.tags.includes("vegan"),
  vegetarian: (d) => d.tags.includes("vegetarian") || d.tags.includes("vegan"),
  vegan: (d) => d.tags.includes("vegan"),
};

const TAG_TO_ALLERGEN: Record<string, string[]> = {
  gluten: ["burger", "pizza", "cake"],
  dairy: [],
};

/**
 * Lightweight content-based ranker. Stands in for the personalization model in
 * the roadmap: in production this is a gradient-boosted ranker trained on order
 * history + session signals, served behind /api/personalize.
 */
export function rankDishes(dishes: Dish[], prefs: Preferences): ScoredDish[] {
  const scored = dishes.map<ScoredDish>((dish) => {
    const reasons: string[] = [];
    let score = 0;
    let blocked: string | undefined;

    if (!DIET_ALLOWS[prefs.diet](dish)) {
      blocked = `Not ${prefs.diet}`;
    }

    for (const avoid of prefs.avoidTags) {
      const key = avoid.toLowerCase();
      if (dish.tags.map((t) => t.toLowerCase()).includes(key)) {
        blocked = `Contains ${avoid}`;
      }
      const kinds = TAG_TO_ALLERGEN[key];
      if (kinds && kinds.includes(dish.kind) && !dish.tags.includes("gluten-free")) {
        blocked = `Likely contains ${avoid}`;
      }
    }

    if (dish.spice > prefs.maxSpice) blocked = "Too spicy";
    if (dish.price > prefs.maxPrice) blocked = "Over budget";
    if (dish.calories > prefs.maxCalories) blocked = "Over calorie target";

    // Positive signals
    if (prefs.favoriteKinds.includes(dish.kind)) {
      score += 40;
      reasons.push("Matches a category you love");
    }
    const spiceFit = 1 - Math.abs(dish.spice - prefs.maxSpice) / 3;
    score += Math.round(spiceFit * 15);
    if (spiceFit > 0.66) reasons.push("Spice level is dialed in for you");

    const priceHeadroom = (prefs.maxPrice - dish.price) / prefs.maxPrice;
    score += Math.round(Math.max(0, priceHeadroom) * 20);
    if (priceHeadroom > 0.3) reasons.push("Comfortably under your budget");

    const calHeadroom = (prefs.maxCalories - dish.calories) / prefs.maxCalories;
    score += Math.round(Math.max(0, calHeadroom) * 15);
    if (calHeadroom > 0.25) reasons.push("Light on calories for the portion");

    score += Math.round((dish.rating - 4) * 25);
    if (dish.rating >= 4.7) reasons.push(`Guest rating ${dish.rating.toFixed(1)}/5`);

    if (dish.prepMinutes <= 7) {
      score += 8;
      reasons.push("Ready fast");
    }

    if (blocked) score = -1;

    return { ...dish, score, reasons: reasons.slice(0, 3), blocked };
  });

  return scored.sort((a, b) => b.score - a.score);
}

export const DEFAULT_PREFS: Preferences = {
  diet: "omnivore",
  maxSpice: 2,
  maxPrice: 18,
  maxCalories: 950,
  avoidTags: [],
  favoriteKinds: ["burger", "pizza"],
};
