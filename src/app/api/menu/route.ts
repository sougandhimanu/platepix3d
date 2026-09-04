import { NextResponse } from "next/server";
import { DISHES } from "@/lib/data";

export function GET() {
  return NextResponse.json({ dishes: DISHES });
}
