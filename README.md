# PlatePix3D

A working reference implementation of the PlatePix3D AI technology roadmap: an
app that turns 2D dish photos into interactive 3D menu models, manages
inventory with AI-driven portion control, and personalizes the live menu per
guest.

This is a demo/prototype built with mock data — it maps directly onto the
three roadmap phases so you can see (and click through) what the executive
summary describes.

## Modules

| Route | Roadmap phase | What it does |
|---|---|---|
| `/studio` | Phase 1 — R&D | Upload (or pick a sample) dish photo → simulated CNN reconstruction pipeline → rotatable Three.js 3D model. |
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

Then open [http://localhost:3000](http://localhost:3000).

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

## Deploying

This is a standard Next.js app, so it deploys as-is to Vercel, or anywhere
that runs `npm run build && npm run start`.
