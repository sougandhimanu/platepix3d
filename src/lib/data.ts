import type { Dish, Ingredient } from "./types";

/**
 * Seed data for PlatePix3D. In a production build this would live in a database
 * (Postgres + Prisma) and be written to by the ingestion / POS integrations
 * described in Phase 2 of the roadmap. Here it is an in-memory store so the
 * app runs with zero setup.
 */

export const INGREDIENTS: Ingredient[] = [
  { id: "beef-patty", name: "Beef patty", unit: "g", onHand: 5400, parLevel: 9000, dailyUsage: 3200, costPerUnit: 0.019, shelfLifeDays: 3, wasteRate: 0.11 },
  { id: "brioche-bun", name: "Brioche bun", unit: "unit", onHand: 62, parLevel: 120, dailyUsage: 48, costPerUnit: 0.55, shelfLifeDays: 4, wasteRate: 0.07 },
  { id: "cheddar", name: "Aged cheddar", unit: "g", onHand: 2100, parLevel: 3000, dailyUsage: 900, costPerUnit: 0.022, shelfLifeDays: 21, wasteRate: 0.04 },
  { id: "romaine", name: "Romaine lettuce", unit: "g", onHand: 1600, parLevel: 4000, dailyUsage: 2100, costPerUnit: 0.006, shelfLifeDays: 5, wasteRate: 0.18 },
  { id: "tomato", name: "Roma tomato", unit: "g", onHand: 2600, parLevel: 3500, dailyUsage: 1400, costPerUnit: 0.005, shelfLifeDays: 6, wasteRate: 0.14 },
  { id: "mozzarella", name: "Fresh mozzarella", unit: "g", onHand: 3800, parLevel: 5000, dailyUsage: 1700, costPerUnit: 0.017, shelfLifeDays: 12, wasteRate: 0.05 },
  { id: "pizza-dough", name: "Sourdough pizza base", unit: "unit", onHand: 40, parLevel: 90, dailyUsage: 38, costPerUnit: 0.9, shelfLifeDays: 2, wasteRate: 0.09 },
  { id: "tomato-sauce", name: "San Marzano sauce", unit: "ml", onHand: 5200, parLevel: 6000, dailyUsage: 1900, costPerUnit: 0.004, shelfLifeDays: 10, wasteRate: 0.03 },
  { id: "basil", name: "Fresh basil", unit: "g", onHand: 210, parLevel: 600, dailyUsage: 260, costPerUnit: 0.03, shelfLifeDays: 4, wasteRate: 0.22 },
  { id: "quinoa", name: "Tri-color quinoa", unit: "g", onHand: 7400, parLevel: 8000, dailyUsage: 2100, costPerUnit: 0.007, shelfLifeDays: 60, wasteRate: 0.02 },
  { id: "chickpea", name: "Chickpeas", unit: "g", onHand: 6100, parLevel: 6000, dailyUsage: 1500, costPerUnit: 0.004, shelfLifeDays: 45, wasteRate: 0.02 },
  { id: "avocado", name: "Hass avocado", unit: "unit", onHand: 34, parLevel: 80, dailyUsage: 40, costPerUnit: 0.9, shelfLifeDays: 4, wasteRate: 0.19 },
  { id: "salmon", name: "Atlantic salmon", unit: "g", onHand: 2400, parLevel: 4000, dailyUsage: 1800, costPerUnit: 0.033, shelfLifeDays: 3, wasteRate: 0.08 },
  { id: "tortilla", name: "Corn tortilla", unit: "unit", onHand: 90, parLevel: 150, dailyUsage: 66, costPerUnit: 0.18, shelfLifeDays: 7, wasteRate: 0.06 },
  { id: "black-bean", name: "Black beans", unit: "g", onHand: 5200, parLevel: 5000, dailyUsage: 1300, costPerUnit: 0.004, shelfLifeDays: 40, wasteRate: 0.02 },
  { id: "flour", name: "00 flour", unit: "g", onHand: 12000, parLevel: 15000, dailyUsage: 2600, costPerUnit: 0.002, shelfLifeDays: 180, wasteRate: 0.01 },
  { id: "chocolate", name: "70% chocolate", unit: "g", onHand: 3400, parLevel: 4000, dailyUsage: 800, costPerUnit: 0.021, shelfLifeDays: 120, wasteRate: 0.02 },
  { id: "butter", name: "Cultured butter", unit: "g", onHand: 2900, parLevel: 4000, dailyUsage: 1100, costPerUnit: 0.011, shelfLifeDays: 30, wasteRate: 0.03 },
];

export const DISHES: Dish[] = [
  {
    id: "classic-smash",
    name: "Classic Smash Burger",
    kind: "burger",
    description: "Double smashed beef, aged cheddar, house pickles and burger sauce on a toasted brioche bun.",
    price: 13.5,
    calories: 890,
    spice: 0,
    tags: ["high-protein", "signature"],
    prepMinutes: 9,
    rating: 4.7,
    recipe: { "beef-patty": 160, "brioche-bun": 1, cheddar: 40, tomato: 30 },
  },
  {
    id: "margherita",
    name: "Margherita DOP",
    kind: "pizza",
    description: "San Marzano sauce, fresh mozzarella, basil and cold-pressed olive oil on a 48-hour sourdough base.",
    price: 15,
    calories: 780,
    spice: 0,
    tags: ["vegetarian", "signature"],
    prepMinutes: 12,
    rating: 4.8,
    recipe: { "pizza-dough": 1, "tomato-sauce": 90, mozzarella: 120, basil: 6 },
  },
  {
    id: "diablo",
    name: "Diavola Piccante",
    kind: "pizza",
    description: "Spicy salami, chili honey, mozzarella and Calabrian pepper flakes.",
    price: 17,
    calories: 910,
    spice: 3,
    tags: ["spicy"],
    prepMinutes: 12,
    rating: 4.6,
    recipe: { "pizza-dough": 1, "tomato-sauce": 90, mozzarella: 110 },
  },
  {
    id: "power-bowl",
    name: "Harvest Power Bowl",
    kind: "bowl",
    description: "Tri-color quinoa, roasted chickpeas, avocado, cherry tomato and lemon-tahini dressing.",
    price: 12.5,
    calories: 560,
    spice: 1,
    tags: ["vegan", "gluten-free", "high-fiber"],
    prepMinutes: 6,
    rating: 4.5,
    recipe: { quinoa: 180, chickpea: 90, avocado: 0.5, tomato: 60 },
  },
  {
    id: "salmon-poke",
    name: "Citrus Salmon Poke",
    kind: "bowl",
    description: "Cured Atlantic salmon, quinoa, avocado, pickled cucumber and yuzu ponzu.",
    price: 16.5,
    calories: 620,
    spice: 1,
    tags: ["pescatarian", "high-protein", "gluten-free"],
    prepMinutes: 7,
    rating: 4.7,
    recipe: { salmon: 120, quinoa: 150, avocado: 0.5 },
  },
  {
    id: "garden-salad",
    name: "Little Gem Garden Salad",
    kind: "salad",
    description: "Little gem, shaved radish, tomato, herbs and a champagne vinaigrette.",
    price: 9.5,
    calories: 240,
    spice: 0,
    tags: ["vegan", "gluten-free", "light"],
    prepMinutes: 5,
    rating: 4.2,
    recipe: { romaine: 140, tomato: 70 },
  },
  {
    id: "street-taco",
    name: "Black Bean Street Tacos",
    kind: "taco",
    description: "Charred corn tortillas, smoky black beans, avocado crema, pickled onion and cilantro.",
    price: 11,
    calories: 480,
    spice: 2,
    tags: ["vegan", "spicy"],
    prepMinutes: 8,
    rating: 4.4,
    recipe: { tortilla: 3, "black-bean": 150, avocado: 0.5 },
  },
  {
    id: "lava-cake",
    name: "Molten Chocolate Cake",
    kind: "cake",
    description: "Warm 70% chocolate fondant with a liquid center and creme fraiche.",
    price: 8.5,
    calories: 520,
    spice: 0,
    tags: ["vegetarian", "dessert"],
    prepMinutes: 14,
    rating: 4.9,
    recipe: { chocolate: 90, butter: 60, flour: 40 },
  },
];

export function dishById(id: string): Dish | undefined {
  return DISHES.find((d) => d.id === id);
}

export function ingredientById(id: string): Ingredient | undefined {
  return INGREDIENTS.find((i) => i.id === id);
}
