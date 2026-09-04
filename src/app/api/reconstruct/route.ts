import { NextResponse } from "next/server";
import { reconstructFromName } from "@/lib/reconstruct";
import type { FoodKind } from "@/lib/types";

export async function POST(req: Request) {
  let sourceName = "dish.jpg";
  let detectedKind: FoodKind | null = null;
  let detection: { label: string; probability: number } | null = null;

  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("image");
      if (file && typeof file !== "string") sourceName = file.name || sourceName;
    } else {
      const body = (await req.json()) as {
        sourceName?: string;
        detectedKind?: FoodKind;
        detection?: { label: string; probability: number };
      };
      if (body.sourceName) sourceName = body.sourceName;
      if (body.detectedKind) detectedKind = body.detectedKind;
      if (body.detection) detection = body.detection;
    }
  } catch {
    // keep defaults
  }

  const result = reconstructFromName(sourceName, detectedKind, detection);

  // Simulate the GPU worker latency (sum of pipeline stages, capped for the demo).
  const totalMs = Math.min(
    2500,
    result.stages.reduce((s, st) => s + st.ms, 0),
  );
  await new Promise((r) => setTimeout(r, totalMs));

  return NextResponse.json(result);
}
