import type { Ingredient } from "./types";

export interface InventoryRow extends Ingredient {
  daysOfCover: number;
  reorderNow: boolean;
  status: "critical" | "low" | "ok" | "overstock";
  projectedWasteUnits: number;
  projectedWasteCost: number;
  optimizedWasteRate: number;
  savingsPerWeek: number;
}

export interface InventorySummary {
  rows: InventoryRow[];
  totalWasteCostWeek: number;
  optimizedWasteCostWeek: number;
  projectedSavingsWeek: number;
  reorderCount: number;
  atRiskCount: number;
  wasteReductionPct: number;
}

/**
 * Turns raw stock levels into the decisions the AI inventory module surfaces:
 * days of cover, reorder flags, and a portion-control optimization that trims
 * over-portioning + spoilage. Mirrors Phase 2 of the roadmap.
 */
export function analyzeInventory(ingredients: Ingredient[]): InventorySummary {
  const rows = ingredients.map<InventoryRow>((ing) => {
    const daysOfCover = ing.dailyUsage > 0 ? ing.onHand / ing.dailyUsage : 99;
    const reorderNow = ing.onHand < ing.parLevel * 0.5 || daysOfCover < 2;

    let status: InventoryRow["status"] = "ok";
    if (daysOfCover < 1.5) status = "critical";
    else if (daysOfCover < 3) status = "low";
    else if (ing.onHand > ing.parLevel * 1.25 && daysOfCover > ing.shelfLifeDays) status = "overstock";

    // Portion-control model: AR-guided plating + demand forecasting cuts the
    // controllable part of waste (over-portioning) roughly in half and shaves
    // spoilage by trimming over-ordering.
    const optimizedWasteRate = Math.max(0.01, ing.wasteRate * 0.45);

    const weeklyUsage = ing.dailyUsage * 7;
    const projectedWasteUnits = weeklyUsage * ing.wasteRate;
    const projectedWasteCost = projectedWasteUnits * ing.costPerUnit;
    const optimizedWasteCost = weeklyUsage * optimizedWasteRate * ing.costPerUnit;
    const savingsPerWeek = Math.max(0, projectedWasteCost - optimizedWasteCost);

    return {
      ...ing,
      daysOfCover,
      reorderNow,
      status,
      projectedWasteUnits,
      projectedWasteCost,
      optimizedWasteRate,
      savingsPerWeek,
    };
  });

  const totalWasteCostWeek = rows.reduce((s, r) => s + r.projectedWasteCost, 0);
  const optimizedWasteCostWeek = rows.reduce(
    (s, r) => s + r.daysOfCover * 0 + r.projectedWasteCost - r.savingsPerWeek,
    0,
  );
  const projectedSavingsWeek = rows.reduce((s, r) => s + r.savingsPerWeek, 0);

  return {
    rows,
    totalWasteCostWeek,
    optimizedWasteCostWeek,
    projectedSavingsWeek,
    reorderCount: rows.filter((r) => r.reorderNow).length,
    atRiskCount: rows.filter((r) => r.status === "critical" || r.status === "low").length,
    wasteReductionPct: totalWasteCostWeek > 0 ? projectedSavingsWeek / totalWasteCostWeek : 0,
  };
}
