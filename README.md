# PlatePix3D

A working reference implementation of the PlatePix3D AI technology roadmap: an
app that turns 2D dish photos into interactive 3D menu models, manages
inventory with AI-driven portion control, and personalizes the live menu per
guest.

This is a demo/prototype built with mock data — it maps directly onto the
three roadmap phases so you can see (and click through) what the executive
summary describes.

**Status:** uploaded photos are now turned into a 3D model built from that
photo itself (via in-browser depth estimation), so any dish works — not just
the 9 modeled categories. The 9 reference dishes are real photos (CC0 /
public domain) rebuilt in 3D the same way — see
[Known limitations](#known-limitations) below.

## Modules

| Route | Roadmap phase | What it does |
|---|---|---|
| `/studio` | Phase 1 — R&D | Upload a dish photo → on-device depth estimation (Depth Anything V2) builds a solid, photo-textured 3D mesh of *that* dish, with depth/background-cutout controls and `.glb` export. MobileNet classification runs alongside and also shows the matching reference dish. Sample buttons show the 9 reference dishes (real photos rebuilt in 3D). |
| `/inventory` | Phase 2 — Integration & testing | Live-refreshing dashboard: days-of-cover per ingredient, reorder flags, and projected waste-cost savings from AI-guided portioning. |
| `/menu` | Phase 3 — Deployment | Diet / spice / budget / calorie preferences re-rank the menu client-side against a scoring model, with explainable "why this dish" reasons. |

## Stack

- [Next.js 14](https://nextjs.org/) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [react-three-fiber](https://docs.pmnd.rs/react-three-fiber) + [drei](https://github.com/pmndrs/drei) for the 3D viewer
- Free, no-attribution assets only: reference dish photos from Wikimedia Commons (CC0 / public domain, `public/dishes/`) — sources listed in `public/dishes/SOURCES.md`
- [Transformers.js](https://huggingface.co/docs/transformers.js) running [Depth Anything V2 (small)](https://huggingface.co/onnx-community/depth-anything-v2-small) for photo → depth, fully in the browser (WebGPU when available, otherwise WASM)
- [TensorFlow.js](https://www.tensorflow.org/js) + MobileNet for dish classification
- [Recharts](https://recharts.org/) for the inventory chart
- Next.js Route Handlers (`src/app/api/*`) as a mock backend — swap these for real services (POS integration, a trained CNN endpoint, a ranking model) without touching the UI

## Getting started

```bash
npm install
npm run dev
```

The app runs on localhost.

On the first photo upload, the browser downloads the depth model (~27 MB) from
the Hugging Face hub and caches it; later uploads start immediately. The
Transformers.js library itself is loaded from the jsDelivr CDN at runtime (the
npm package is only a dev dependency for types), since Next 14's bundler can't
process its ONNX Runtime modules.

## Project layout

```
src/
  app/
    page.tsx            landing page (roadmap overview)
    studio/page.tsx      2D -> 3D reconstruction UI
    inventory/page.tsx   AI inventory dashboard
    menu/page.tsx        personalized menu
    api/
      menu/route.ts        GET  full dish list
      inventory/route.ts    GET  inventory analysis
      personalize/route.ts  POST preferences -> ranked dishes
      reconstruct/route.ts  POST photo -> simulated 3D reconstruction result
  components/
    DishViewer.tsx        reference 3D model per dish (photo + precomputed depth)
    PhotoRelief.tsx       viewer for photo-derived 3D meshes (+ .glb export)
    Nav.tsx
  lib/
    depth.ts        in-browser depth estimation (Depth Anything V2)
    photoMesh.ts    depth map -> table-plane fit, dish cutout, solid textured mesh
    classify.ts     MobileNet dish classification
public/
  dishes/          reference dish photos + precomputed 16-bit depth maps
    data.ts        seed dishes + ingredients
    types.ts        shared types
    recommend.ts    personalization scoring model
    inventory.ts     waste/reorder analysis
    reconstruct.ts   simulated 2D->3D pipeline
```

## Where the real integrations go

Everything under `src/lib/*.ts` and `src/app/api/*` is intentionally isolated
from the UI so each mock can be swapped for a real system:

- `reconstruct.ts` → replace with a call to a trained CNN / implicit-surface
  model served on a GPU worker, returning a real glTF asset for `DishViewer`.
- `data.ts` → replace with a database (Postgres/Prisma) fed by POS + supplier
  integrations.
- `inventory.ts` → replace the heuristic waste model with the actual
  forecasting model once historical usage data is available.
- `recommend.ts` → replace the content-based ranker with a trained model
  (e.g. gradient-boosted ranker on order history + session signals).

## Known limitations

- **Photo-derived models only show what the photo shows.** The photo covers
  the front only; the back is a plain shell and is never faked from the
  photo. Side-on dishes (burger, hot dog, cake, ice cream) stand upright and
  turn up to ~75° either side. Overhead shots (pizza, bowl, salad, tacos,
  pasta) lie flat on the table and can be circled a full 360° from above.
- **Background cutout works best on a plain table.** The dish is separated
  from its surroundings by its height above the fitted table plane; cluttered
  scenes or extreme close-ups may not separate, in which case the cutout
  switches off and the full photo is shown in relief.
- **If the depth model can't load** (offline, blocked CDN), a clearly labeled
  center-weighted heuristic depth is used instead of a real estimate.
- **True all-round detail needs real scans.** No free no-credit (CC0) 3D
  scans of these dishes exist online, so the reference dishes are photos.
  Scanning the real plated dishes (e.g. Polycam / RealityScan → `.glb`) would
  capture their actual backs and allow full rotation of upright dishes too.
- **Classification covers few cuisines.** It only picks the category-model
  tab (the photo-derived model doesn't depend on it), but its vocabulary is
  ImageNet's 1,000 categories, which has no coverage of most world cuisines.
  Still actively working on covering more dishes/cuisines — the planned next step
  is swapping in CLIP-based zero-shot classification (a custom vocabulary
  instead of ImageNet's fixed list) alongside a few more generic 3D shape
  archetypes (dumpling/fritter, flatbread, skewer, rice dish) that can
  represent many more dishes without hand-modeling each one.

## Deploying

This is a standard Next.js app, so it deploys as-is to Vercel, or anywhere
that runs `npm run build && npm run start`.
