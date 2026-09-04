"use client";

import { useEffect, useState } from "react";
import DishViewer from "@/components/DishViewer";
import { DEFAULT_PREFS } from "@/lib/recommend";
import type { Diet, FoodKind, Preferences, ScoredDish } from "@/lib/types";

const DIETS: Diet[] = ["omnivore", "pescatarian", "vegetarian", "vegan"];
const KINDS: FoodKind[] = ["burger", "pizza", "bowl", "salad", "cake", "taco"];
const ALLERGENS = ["gluten", "dairy"];

export default function MenuPage() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [dishes, setDishes] = useState<ScoredDish[] | null>(null);
  const [active, setActive] = useState<ScoredDish | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/personalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prefs),
        });
        const json = await res.json();
        if (!cancelled) {
          setDishes(json.dishes);
          setActive((prev) => prev ?? json.dishes.find((d: ScoredDish) => !d.blocked) ?? json.dishes[0]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200); // debounce slider changes
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [prefs]);

  function toggleAllergen(tag: string) {
    setPrefs((p) => ({
      ...p,
      avoidTags: p.avoidTags.includes(tag) ? p.avoidTags.filter((t) => t !== tag) : [...p.avoidTags, tag],
    }));
  }

  function toggleFavorite(kind: FoodKind) {
    setPrefs((p) => ({
      ...p,
      favoriteKinds: p.favoriteKinds.includes(kind)
        ? p.favoriteKinds.filter((k) => k !== kind)
        : [...p.favoriteKinds, kind],
    }));
  }

  const visible = dishes?.filter((d) => !d.blocked) ?? [];
  const blocked = dishes?.filter((d) => d.blocked) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <p className="label mb-2">Phase 3 · Customer personalization</p>
        <h1 className="text-2xl font-semibold">Menu, ranked for you in real time</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Adjust preferences and watch the personalization model re-rank the live menu — the same
          signals a guest&apos;s profile or session behavior would drive in production.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
        <aside className="card h-fit space-y-6">
          <div>
            <p className="label mb-2">Diet</p>
            <div className="flex flex-wrap gap-2">
              {DIETS.map((d) => (
                <button
                  key={d}
                  onClick={() => setPrefs((p) => ({ ...p, diet: d }))}
                  className={`pill capitalize hover:border-brand ${prefs.diet === d ? "border-brand text-brand" : ""}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <SliderField
            label={`Max spice: ${prefs.maxSpice}`}
            min={0}
            max={3}
            value={prefs.maxSpice}
            onChange={(v) => setPrefs((p) => ({ ...p, maxSpice: v }))}
          />
          <SliderField
            label={`Max price: $${prefs.maxPrice}`}
            min={8}
            max={20}
            value={prefs.maxPrice}
            onChange={(v) => setPrefs((p) => ({ ...p, maxPrice: v }))}
          />
          <SliderField
            label={`Max calories: ${prefs.maxCalories}`}
            min={300}
            max={1000}
            step={25}
            value={prefs.maxCalories}
            onChange={(v) => setPrefs((p) => ({ ...p, maxCalories: v }))}
          />

          <div>
            <p className="label mb-2">Avoid</p>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleAllergen(a)}
                  className={`pill capitalize hover:border-red-400 ${
                    prefs.avoidTags.includes(a) ? "border-red-400 text-red-400" : ""
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label mb-2">Loves</p>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => toggleFavorite(k)}
                  className={`pill capitalize hover:border-brand ${
                    prefs.favoriteKinds.includes(k) ? "border-brand text-brand" : ""
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          {active && (
            <div className="grid gap-4 sm:grid-cols-[220px,1fr]">
              <DishViewer kind={active.kind} className="h-56" />
              <div className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{active.name}</h2>
                    <p className="mt-1 text-sm text-slate-400">{active.description}</p>
                  </div>
                  <span className="whitespace-nowrap text-lg font-semibold text-brand">
                    ${active.price.toFixed(2)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {active.reasons.map((r) => (
                    <span key={r} className="pill border-accent/50 text-accent">
                      {r}
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  {active.calories} cal · spice {active.spice}/3 · match score {active.score}
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="label">Recommended for you {loading && "· updating…"}</p>
              <span className="text-xs text-slate-500">{visible.length} of {dishes?.length ?? 0} dishes match</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setActive(d)}
                  className={`card text-left transition-colors hover:border-brand/60 ${
                    active?.id === d.id ? "border-brand" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium">{d.name}</h3>
                    <span className="whitespace-nowrap text-sm font-semibold text-brand">${d.price.toFixed(2)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{d.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {d.reasons.slice(0, 2).map((r) => (
                      <span key={r} className="pill text-[11px]">
                        {r}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {blocked.length > 0 && (
            <div>
              <p className="label mb-3">Filtered out by your preferences</p>
              <div className="flex flex-wrap gap-2">
                {blocked.map((d) => (
                  <span key={d.id} className="pill text-slate-500">
                    {d.name} — {d.blocked}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SliderField({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="label mb-2">{label}</p>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
