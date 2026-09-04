# PlatePix3D

A working reference implementation of the PlatePix3D AI technology roadmap: an
app that turns 2D dish photos into interactive 3D menu models, manages
inventory with AI-driven portion control, and personalizes the live menu per
guest.

This is a demo/prototype built with mock data — it maps directly onto the
three roadmap phases so you can see (and click through) what the executive
summary describes.

**Status:** still actively working on more realistic 3D rendering (the dish
models are procedurally generated, not photorealistic scans) and on covering
more dishes/cuisines — see [Known limitations](#known-limitations) below.

## Modules

| Route | Roadmap phase | What it does |
|---|---|---|
| `/studio` | Phase 1 — R&D | Upload (or pick a sample) dish photo → real on-device image classification (TensorFlow.js + MobileNet) → rotatable Three.js 3D model for one of 9 modeled dish shapes. |
| `/inventory` | Phase 2 — Integration & testing | Live-refreshing dashboard: days-of-cover per ingredient, reorder flags, and projected waste-cost savings from AI-guided portioning. |
| `/menu` | Phase 3 — Deployment | Diet / spice / budget / calorie preferences re-rank the menu client-side against a scoring model, with explainable "why this dish" reasons. |

## Stack

- [Next.js 14](https://nextjs.org/) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [react-three-fiber](https://docs.pmnd.rs/react-three-fiber) + [drei](https://github.com/pmndrs/drei) for the 3D viewer (procedural food geometry — no external model files needed)
- [Recharts](https://recharts.org/) for the inventory chart
- Next.js Route Handlers (`src/app/api/*`) as a mock backend — swap these for real services (POS integration, a trained CNN endpoint, a ranking model) without touching the UI

## Getting started

```bash
npm install
npm run dev
```

The app runs on localhost.

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
    DishViewer.tsx        Three.js canvas wrapper (lighting, controls, shadows)
    food/FoodModel.tsx     procedural 3D geometry per dish kind
    Nav.tsx
  lib/
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

- **3D models are procedurally generated, not a reconstruction of the photo.**
  Classification is real (MobileNet actually looks at the uploaded photo's
  pixels), but the 3D shape shown is one of 9 hand-built stand-in models for
  that dish *category* — not a mesh derived from the specific photo. Still
  actively working on rendering more realistic 3D models.
- **Only 9 dish shapes exist today** (burger, pizza, bowl, salad, cake, taco,
  pasta, hot dog, ice cream), and the classifier's vocabulary is ImageNet's
  1,000 categories, which has no coverage of most world cuisines. A photo of
  an unfamiliar dish (e.g. vada pav, dosa, biryani) gets the model's closest
  visual guess among categories it does know, honestly labeled as such in the
  UI. Still actively working on covering more dishes/cuisines — the planned
  next step is swapping in CLIP-based zero-shot classification (a
  custom vocabulary instead of ImageNet's fixed list) alongside a few more
  generic 3D shape archetypes (dumpling/fritter, flatbread, skewer, rice
  dish) that can represent many more dishes without hand-modeling each one.

## Deploying

This is a standard Next.js app, so it deploys as-is to Vercel, or anywhere
that runs `npm run build && npm run start`.
