import Link from "next/link";
import DishViewer from "@/components/DishViewer";

const PILLARS = [
  {
    href: "/studio",
    title: "3D Model Creation",
    kicker: "Phase 1 · R&D",
    body: "A CNN pipeline turns a single 2D dish photo into a detailed, interactive 3D model in seconds — no photogrammetry rig required.",
  },
  {
    href: "/inventory",
    title: "Inventory Management",
    kicker: "Phase 2 · Integration",
    body: "Real-time stock analysis drives portion control and reorder timing, cutting spoilage and over-portioning waste.",
  },
  {
    href: "/menu",
    title: "Customer Personalization",
    kicker: "Phase 3 · Deployment",
    body: "Diet, spice, budget and calorie preferences re-rank the live menu per guest, in the browser, with explainable reasons.",
  },
];

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Turn a phone photo into a{" "}
            <span className="text-brand">3D menu</span>, then run the kitchen on it.
          </h1>
          <p className="mt-4 max-w-xl text-slate-400">
            PlatePix3D automates 2D→3D menu creation, optimizes inventory and portioning with AI, and
            personalizes every menu in real time — reducing waste, cutting costs, and lifting customer
            engagement.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/studio" className="btn-primary">
              Try the 3D Studio
            </Link>
            <Link href="/menu" className="btn-ghost">
              See personalized menu
            </Link>
          </div>
        </div>
        <DishViewer kind="burger" className="h-72 md:h-80" />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {PILLARS.map((p) => (
          <Link key={p.href} href={p.href} className="card group transition-colors hover:border-brand/60">
            <p className="label">{p.kicker}</p>
            <h3 className="mt-1 text-lg font-semibold group-hover:text-brand">{p.title}</h3>
            <p className="mt-2 text-sm text-slate-400">{p.body}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
