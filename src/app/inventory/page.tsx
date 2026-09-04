"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { InventorySummary } from "@/lib/inventory";

const STATUS_COLOR: Record<string, string> = {
  critical: "#ef4444",
  low: "#f59e0b",
  ok: "#3ddc97",
  overstock: "#60a5fa",
};

function fmtUSD(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function InventoryPage() {
  const [data, setData] = useState<InventorySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/inventory", { cache: "no-store" });
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        const json: InventorySummary = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load inventory");
      }
    }
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <p className="label mb-2">Phase 2 · Inventory management</p>
        <h1 className="text-2xl font-semibold">AI stock, portion control & waste forecast</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Live stock is compared against forecast usage to flag reorders early and quantify the
          waste that AI-guided portioning and demand forecasting would remove. Refreshes every 15s.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!data ? (
        <p className="text-sm text-slate-500">Loading inventory…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Items needing reorder" value={data.reorderCount.toString()} tone="warn" />
            <Stat label="At-risk ingredients" value={data.atRiskCount.toString()} tone="warn" />
            <Stat label="Projected waste / wk" value={fmtUSD(data.totalWasteCostWeek)} tone="danger" />
            <Stat
              label="AI savings / wk"
              value={fmtUSD(data.projectedSavingsWeek)}
              sub={`${Math.round(data.wasteReductionPct * 100)}% waste reduction`}
              tone="good"
            />
          </div>

          <div className="card">
            <p className="label mb-4">Days of cover by ingredient</p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.rows} margin={{ left: -12, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#233040" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#8b96a5", fontSize: 11 }}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis tick={{ fill: "#8b96a5", fontSize: 11 }} label={{ value: "days", angle: -90, fill: "#8b96a5", position: "insideLeft" }} />
                  <Tooltip
                    contentStyle={{ background: "#141b24", border: "1px solid #233040", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v.toFixed(1)} days`, "Cover"]}
                  />
                  <Bar dataKey="daysOfCover" radius={[4, 4, 0, 0]}>
                    {data.rows.map((r) => (
                      <Cell key={r.id} fill={STATUS_COLOR[r.status]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-slate-400">
              {Object.entries(STATUS_COLOR).map(([k, c]) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                  {k}
                </span>
              ))}
            </div>
          </div>

          <div className="card overflow-x-auto">
            <p className="label mb-4">Ingredient detail</p>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-edge">
                  <th className="py-2 pr-4 font-medium">Ingredient</th>
                  <th className="py-2 pr-4 font-medium">On hand</th>
                  <th className="py-2 pr-4 font-medium">Days of cover</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Current waste</th>
                  <th className="py-2 pr-4 font-medium">AI-optimized</th>
                  <th className="py-2 pr-0 font-medium">Weekly savings</th>
                </tr>
              </thead>
              <tbody>
                {data.rows
                  .slice()
                  .sort((a, b) => a.daysOfCover - b.daysOfCover)
                  .map((r) => (
                    <tr key={r.id} className="border-b border-edge/60 last:border-0">
                      <td className="py-2 pr-4">{r.name}</td>
                      <td className="py-2 pr-4 text-slate-400">
                        {r.onHand.toLocaleString()} {r.unit}
                      </td>
                      <td className="py-2 pr-4">{r.daysOfCover.toFixed(1)}</td>
                      <td className="py-2 pr-4">
                        <span
                          className="pill"
                          style={{ borderColor: STATUS_COLOR[r.status], color: STATUS_COLOR[r.status] }}
                        >
                          {r.reorderNow ? "reorder now" : r.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-slate-400">{Math.round(r.wasteRate * 100)}%</td>
                      <td className="py-2 pr-4 text-accent">{Math.round(r.optimizedWasteRate * 100)}%</td>
                      <td className="py-2 pr-0 font-medium text-accent">{fmtUSD(r.savingsPerWeek)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "warn" | "danger" | "good";
}) {
  const toneColor = { warn: "text-amber-400", danger: "text-red-400", good: "text-accent" }[tone];
  return (
    <div className="card">
      <p className="label">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneColor}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
