import type { FoodKind } from "./types";
import { mapImageNetLabelToKind } from "./reconstruct";
import type { MobileNet } from "@tensorflow-models/mobilenet";

/**
 * Real, in-browser image classification via TensorFlow.js + MobileNet
 * (trained on ImageNet-1k). This actually looks at the uploaded photo's
 * pixels — unlike the filename-keyword fallback used for the curated sample
 * buttons. Both TF.js and the model package are loaded lazily (dynamic
 * import) so they're not in the initial bundle, and the ~16MB of pretrained
 * weights are fetched once from Google's public model CDN on first use, then
 * cached by the browser.
 */

export interface Prediction {
  className: string;
  probability: number;
}

export interface ClassificationResult {
  top: Prediction[];
  /** First prediction (by confidence) that maps to one of our modeled dish kinds, if any. */
  matchedKind: FoodKind | null;
  matchedLabel: string | null;
}

let modelPromise: Promise<MobileNet> | null = null;

async function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      await import("@tensorflow/tfjs");
      const mobilenet = await import("@tensorflow-models/mobilenet");
      return mobilenet.load({ version: 2, alpha: 1.0 });
    })();
  }
  return modelPromise;
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function classifyImageFile(file: File): Promise<ClassificationResult> {
  const [model, img] = await Promise.all([loadModel(), fileToImage(file)]);
  const predictions: Prediction[] = await model.classify(img, 5);
  URL.revokeObjectURL(img.src);

  for (const p of predictions) {
    const kind = mapImageNetLabelToKind(p.className);
    if (kind) {
      return { top: predictions, matchedKind: kind, matchedLabel: p.className };
    }
  }
  return { top: predictions, matchedKind: null, matchedLabel: null };
}
