"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { getProducts, type Product, type ProductVariant } from "@/lib/products";

/* ─────────────────────────────────────────────────────────────────────────
   Types
──────────────────────────────────────────────────────────────────────────── */

type VariantRow = {
  id: string;
  attrLabel: string;
  sku: string;
  quantity: number;
  unitCost: number;
  unitSale: number;
  totalCost: number;
  totalSale: number;
  profit: number;
  margin: number | null;
};

type ProductRow = {
  id: string;
  name: string;
  variantCount: number;
  totalStock: number;
  totalCost: number;
  totalSale: number;
  profit: number;
  margin: number | null;
  variants: VariantRow[];
};

type SortField = "profit" | "totalCost" | "totalSale" | "margin";

/* ─────────────────────────────────────────────────────────────────────────
   Computation
──────────────────────────────────────────────────────────────────────────── */

function buildVariantRow(v: ProductVariant): VariantRow {
  const totalCost = v.price * v.quantity;
  const totalSale = v.salePrice * v.quantity;
  const profit = totalSale - totalCost;
  return {
    id: v.id,
    attrLabel:
      Object.values(v.attributeValues).join(" / ") || "ترکیب ساده",
    sku: v.sku,
    quantity: v.quantity,
    unitCost: v.price,
    unitSale: v.salePrice,
    totalCost,
    totalSale,
    profit,
    margin: totalCost > 0 ? (profit / totalCost) * 100 : null,
  };
}

function buildProductRow(p: Product): ProductRow {
  const variants = p.variants.map(buildVariantRow);
  const totalCost = variants.reduce((s, v) => s + v.totalCost, 0);
  const totalSale = variants.reduce((s, v) => s + v.totalSale, 0);
  const profit = totalSale - totalCost;
  return {
    id: p.id,
    name: p.name,
    variantCount: p.variants.length,
    totalStock: variants.reduce((s, v) => s + v.quantity, 0),
    totalCost,
    totalSale,
    profit,
    margin: totalCost > 0 ? (profit / totalCost) * 100 : null,
    variants,
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   Formatting
──────────────────────────────────────────────────────────────────────────── */

const fa = (n: number) => Math.round(n).toLocaleString("fa-IR");

const faM = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000)
    return `${sign}${(abs / 1_000_000_000).toFixed(1)} میلیارد`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)} میلیون`;
  return fa(n);
};

const faMargin = (m: number | null) => {
  if (m === null) return "—";
  const sign = m > 0 ? "+" : "";
  return `${sign}${Math.round(m).toLocaleString("fa-IR")}٪`;
};

const truncate = (s: string, n = 9) =>
  s.length > n ? s.slice(0, n) + "…" : s;

/* ─────────────────────────────────────────────────────────────────────────
   Small UI helpers
──────────────────────────────────────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "blue" | "orange" | "green" | "red";
}) {
  const colorMap = {
    blue: "text-[#0073bb]",
    orange: "text-[#ec7211]",
    green: "text-[#1d8102]",
    red: "text-[#d13212]",
  };
  return (
    <div className="flex flex-col rounded border border-[#d5dbdb] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#545b64]">
        {label}
      </p>
      <p
        className={`mt-3 text-2xl font-bold ${
          accent ? colorMap[accent] : "text-[#16191f]"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-[#879596]">{sub}</p>}
    </div>
  );
}

function ProfitCell({ profit }: { profit: number }) {
  const cls =
    profit > 0
      ? "text-[#1d8102]"
      : profit < 0
        ? "text-[#d13212]"
        : "text-[#879596]";
  return (
    <span className={`font-semibold tabular-nums ${cls}`}>
      {profit > 0 ? "+" : profit < 0 ? "-" : ""}
      {fa(Math.abs(profit))}
    </span>
  );
}

function StatusBadge({
  profit,
  totalCost,
}: {
  profit: number;
  totalCost: number;
}) {
  if (totalCost === 0 && profit === 0)
    return (
      <span className="rounded bg-[#f2f3f3] px-2 py-0.5 text-xs font-medium text-[#879596]">
        بدون قیمت
      </span>
    );
  if (profit > 0)
    return (
      <span className="rounded bg-[#ebf6e8] px-2 py-0.5 text-xs font-medium text-[#1d8102]">
        سودده
      </span>
    );
  if (profit < 0)
    return (
      <span className="rounded bg-[#fdf3f1] px-2 py-0.5 text-xs font-medium text-[#d13212]">
        زیان‌ده
      </span>
    );
  return (
    <span className="rounded bg-[#f2f3f3] px-2 py-0.5 text-xs font-medium text-[#545b64]">
      سر به سر
    </span>
  );
}

function SortTh({
  label,
  field,
  active,
  dir,
  onClick,
}: {
  label: string;
  field: SortField;
  active: SortField;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th
      className="cursor-pointer select-none px-4 py-3 text-right text-xs font-semibold text-[#545b64] hover:text-[#0073bb] transition"
      onClick={onClick}
    >
      {label}{" "}
      <span className="opacity-60">
        {active === field ? (dir === "desc" ? "↓" : "↑") : "↕"}
      </span>
    </th>
  );
}

/* Custom chart tooltip */
function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const v: number = payload[0].value;
  return (
    <div className="rounded border border-[#d5dbdb] bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-[#16191f]">{label}</p>
      <p
        className={`mt-0.5 font-semibold ${v >= 0 ? "text-[#1d8102]" : "text-[#d13212]"}`}
      >
        {v >= 0 ? "+" : ""}
        {fa(v)} تومان
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Page
──────────────────────────────────────────────────────────────────────────── */

export default function ProfitLossPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("profit");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    const load = async () => setProducts(await getProducts());
    void load();
  }, []);

  /* Build rows */
  const rows = useMemo(() => products.map(buildProductRow), [products]);

  /* Sort */
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = sortField === "margin" ? (a.margin ?? -Infinity) : a[sortField];
      const bv = sortField === "margin" ? (b.margin ?? -Infinity) : b[sortField];
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [rows, sortField, sortDir]);

  /* Totals */
  const totals = useMemo(() => {
    const totalCost = rows.reduce((s, r) => s + r.totalCost, 0);
    const totalSale = rows.reduce((s, r) => s + r.totalSale, 0);
    const profit = totalSale - totalCost;
    return {
      stock: rows.reduce((s, r) => s + r.totalStock, 0),
      totalCost,
      totalSale,
      profit,
      margin: totalCost > 0 ? (profit / totalCost) * 100 : null,
    };
  }, [rows]);

  /* Chart data — sorted by profit */
  const chartData = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.profit - a.profit)
        .map((r) => ({ name: r.name, profit: r.profit })),
    [rows],
  );

  /* Expand / collapse */
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const allExpanded = rows.length > 0 && expanded.size === rows.length;
  const toggleAll = () =>
    setExpanded(allExpanded ? new Set() : new Set(rows.map((r) => r.id)));

  /* Sort handler */
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d5dbdb] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#16191f]">سود و زیان</h1>
          <p className="mt-0.5 text-sm text-[#545b64]">
            محاسبه بر اساس موجودی فعلی — تفاوت قیمت خرید و فروش ضرب در تعداد
          </p>
        </div>
        <Link
          href="/products/manage"
          className="rounded border border-[#aab7b8] bg-white px-4 py-2 text-sm font-medium text-[#16191f] hover:bg-[#f2f3f3] transition"
        >
          مدیریت محصولات
        </Link>
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="ارزش خرید موجودی"
          value={faM(totals.totalCost)}
          sub="تومان — هزینه تمام‌شده"
          accent="orange"
        />
        <KpiCard
          label="ارزش فروش موجودی"
          value={faM(totals.totalSale)}
          sub="تومان — درآمد بالقوه"
          accent="blue"
        />
        <KpiCard
          label="سود / زیان خالص"
          value={`${totals.profit >= 0 ? "+" : ""}${faM(totals.profit)}`}
          sub="تومان — ارزش فروش منهای ارزش خرید"
          accent={totals.profit >= 0 ? "green" : "red"}
        />
        <KpiCard
          label="حاشیه سود کل"
          value={faMargin(totals.margin)}
          sub="درصد سود نسبت به هزینه خرید"
          accent={
            totals.margin === null
              ? undefined
              : totals.margin >= 0
                ? "green"
                : "red"
          }
        />
      </div>

      {/* ── Chart ───────────────────────────────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="rounded border border-[#d5dbdb] bg-white shadow-sm">
          <div className="border-b border-[#d5dbdb] bg-[#f2f3f3] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#16191f]">
              سود / زیان به تفکیک محصول (تومان)
            </h2>
            <p className="mt-0.5 text-xs text-[#879596]">
              سبز = سودده &nbsp;·&nbsp; قرمز = زیان‌ده
            </p>
          </div>
          <div className="p-5" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e8ecee"
                  vertical={false}
                />
                <ReferenceLine y={0} stroke="#aab7b8" strokeWidth={1} />
                <XAxis
                  dataKey="name"
                  tickFormatter={(v) => truncate(v)}
                  tick={{ fill: "#545b64", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#879596", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tickFormatter={(v) =>
                    Math.abs(v) >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(0)}M`
                      : fa(v)
                  }
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTip
                      active={active}
                      payload={payload}
                      label={String(label ?? "")}
                    />
                  )}
                />
                <Bar dataKey="profit" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.profit >= 0 ? "#1d8102" : "#d13212"}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="rounded border border-[#d5dbdb] bg-white shadow-sm">
        {/* Table header */}
        <div className="flex items-center justify-between border-b border-[#d5dbdb] bg-[#f2f3f3] px-5 py-3">
          <h2 className="text-sm font-semibold text-[#16191f]">
            تفکیک محصولات
          </h2>
          {rows.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-xs text-[#0073bb] hover:underline"
            >
              {allExpanded ? "بستن همه" : "بازکردن همه"}
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#879596]">
            هیچ محصولی یافت نشد.{" "}
            <Link
              href="/products/manage/new"
              className="text-[#0073bb] hover:underline"
            >
              افزودن محصول
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#d5dbdb] bg-[#f8f9f9] text-right">
                  {/* expand toggle */}
                  <th className="w-10 px-3 py-3" />
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#545b64]">
                    محصول / ترکیب
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#545b64]">
                    موجودی
                  </th>
                  <SortTh
                    label="ارزش خرید"
                    field="totalCost"
                    active={sortField}
                    dir={sortDir}
                    onClick={() => handleSort("totalCost")}
                  />
                  <SortTh
                    label="ارزش فروش"
                    field="totalSale"
                    active={sortField}
                    dir={sortDir}
                    onClick={() => handleSort("totalSale")}
                  />
                  <SortTh
                    label="سود / زیان"
                    field="profit"
                    active={sortField}
                    dir={sortDir}
                    onClick={() => handleSort("profit")}
                  />
                  <SortTh
                    label="حاشیه ٪"
                    field="margin"
                    active={sortField}
                    dir={sortDir}
                    onClick={() => handleSort("margin")}
                  />
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#545b64]">
                    وضعیت
                  </th>
                </tr>
              </thead>

              <tbody>
                {sorted.map((row) => (
                  <Fragment key={row.id}>
                    {/* ── Product row ─────────────────────────────────── */}
                    <tr
                      className="cursor-pointer border-b border-[#e8ecee] hover:bg-[#f2f8fd] transition"
                      onClick={() => toggle(row.id)}
                    >
                      <td className="px-3 py-3 text-center text-lg text-[#879596] select-none">
                        <span
                          className="inline-block transition-transform duration-200"
                          style={{
                            transform: expanded.has(row.id)
                              ? "rotate(90deg)"
                              : "rotate(0deg)",
                          }}
                        >
                          ›
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#16191f]">
                          {row.name}
                        </p>
                        <p className="text-xs text-[#879596]">
                          {row.variantCount} ترکیب
                        </p>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[#16191f]">
                        {fa(row.totalStock)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[#545b64]">
                        {fa(row.totalCost)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[#545b64]">
                        {fa(row.totalSale)}
                      </td>
                      <td className="px-4 py-3">
                        <ProfitCell profit={row.profit} />
                      </td>
                      <td className="px-4 py-3 text-[#545b64]">
                        {faMargin(row.margin)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          profit={row.profit}
                          totalCost={row.totalCost}
                        />
                      </td>
                    </tr>

                    {/* ── Variant rows (expanded) ─────────────────────── */}
                    {expanded.has(row.id) &&
                      row.variants.map((v) => (
                        <tr
                          key={v.id}
                          className="border-b border-[#f2f3f3] bg-[#f8f9f9]"
                        >
                          <td className="px-3 py-2" />
                          <td className="py-2 pr-10 pl-4">
                            <p className="text-xs font-medium text-[#16191f]">
                              {v.attrLabel}
                            </p>
                            {v.sku && (
                              <p className="font-mono text-[10px] text-[#879596]">
                                {v.sku}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2 text-xs tabular-nums text-[#545b64]">
                            {fa(v.quantity)}
                          </td>
                          <td className="px-4 py-2 text-xs text-[#545b64]">
                            <p className="tabular-nums">{fa(v.totalCost)}</p>
                            <p className="text-[#879596]">
                              {fa(v.unitCost)} × {fa(v.quantity)}
                            </p>
                          </td>
                          <td className="px-4 py-2 text-xs text-[#545b64]">
                            <p className="tabular-nums">{fa(v.totalSale)}</p>
                            <p className="text-[#879596]">
                              {fa(v.unitSale)} × {fa(v.quantity)}
                            </p>
                          </td>
                          <td className="px-4 py-2 text-xs">
                            <ProfitCell profit={v.profit} />
                          </td>
                          <td className="px-4 py-2 text-xs text-[#545b64]">
                            {faMargin(v.margin)}
                          </td>
                          <td className="px-4 py-2 text-xs">
                            <StatusBadge
                              profit={v.profit}
                              totalCost={v.totalCost}
                            />
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                ))}
              </tbody>

              {/* ── Totals footer ────────────────────────────────────── */}
              <tfoot>
                <tr className="border-t-2 border-[#aab7b8] bg-[#f2f3f3] font-semibold">
                  <td className="px-3 py-3" />
                  <td className="px-4 py-3 text-[#16191f]">جمع کل</td>
                  <td className="px-4 py-3 tabular-nums text-[#16191f]">
                    {fa(totals.stock)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[#545b64]">
                    {fa(totals.totalCost)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[#545b64]">
                    {fa(totals.totalSale)}
                  </td>
                  <td className="px-4 py-3">
                    <ProfitCell profit={totals.profit} />
                  </td>
                  <td className="px-4 py-3 text-[#545b64]">
                    {faMargin(totals.margin)}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
