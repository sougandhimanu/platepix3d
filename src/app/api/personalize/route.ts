import { NextResponse } from "next/server";
import { DISHES } from "@/lib/data";
import { rankDishes, DEFAULT_PREFS } from "@/lib/recommend";
import type { Preferences } from "@/lib/types";

export async function POST(req: Request) {
  let prefs: Preferences = DEFAULT_PREFS;
  try {
    const body = (await req.json()) as Partial<Preferences>;
    prefs = { ...DEFAULT_PREFS, ...body };
  } catch {
    // fall back to defaults
  }

  const ranked = rankDishes(DISHES, prefs);
  return NextResponse.json({ prefs, dishes: ranked });
}
