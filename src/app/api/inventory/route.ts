import { NextResponse } from "next/server";
import { INGREDIENTS } from "@/lib/data";
import { analyzeInventory } from "@/lib/inventory";

/**
 * Adds a small deterministic-per-minute jitter to stock levels so the dashboard
 * looks live during a demo without a real POS feed.
 */
function withDrift() {
  const minute = Math.floor(Date.now() / 60000);
  return INGREDIENTS.map((ing, i) => {
    const wobble = Math.sin(minute / 7 + i) * 0.06 + 1;
    return { ...ing, onHand: Math.max(0, Math.round(ing.onHand * wobble)) };
  });
}

export function GET() {
  const summary = analyzeInventory(withDrift());
  return NextResponse.json(summary);
}
