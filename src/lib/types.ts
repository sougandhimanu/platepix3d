export type FoodKind = "burger" | "pizza" | "bowl" | "salad" | "cake" | "taco";

export type Diet = "omnivore" | "vegetarian" | "vegan" | "pescatarian";

export interface Dish {
  id: string;
  name: string;
  kind: FoodKind;
  description: string;
  price: number;
  calories: number;
  spice: number; // 0 (mild) - 3 (fiery)
  tags: string[]; // e.g. "vegan", "gluten-free", "high-protein"
  prepMinutes: number;
  rating: number; // 0 - 5
  /** ingredient id -> grams used per serving */
  recipe: Record<string, number>;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: "g" | "ml" | "unit";
  onHand: number; // current stock in `unit`
  parLevel: number; // target stock level
  dailyUsage: number; // average consumption per day
  costPerUnit: number; // $ per gram/ml/unit
  shelfLifeDays: number;
  wasteRate: number; // 0 - 1 fraction currently lost to spoilage/over-portioning
}

export interface Preferences {
  diet: Diet;
  maxSpice: number; // 0 - 3
  maxPrice: number;
  maxCalories: number;
  avoidTags: string[]; // e.g. "gluten", "dairy", "nuts"
  favoriteKinds: FoodKind[];
}

export interface ScoredDish extends Dish {
  score: number;
  reasons: string[];
  blocked?: string;
}

export interface ReconstructResult {
  jobId: string;
  sourceName: string;
  kind: FoodKind;
  confidence: number; // 0 - 1
  stages: { label: string; ms: number }[];
  meshStats: { vertices: number; faces: number; textureRes: number };
  suggestedDishId: string | null;
}
