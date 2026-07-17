"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "recharts";
import { getProducts, productTotalStock, type Product } from "@/lib/products";
import { getExpensesSum } from "@/lib/expenses";

/* ─────────────────────────────────────────────────────────────────────────
   Stats computation
──────────────────────────────────────────────────────────────────────────── */

type LowStockRow = {
  productName: string;
  attrLabel: string;
  sku: string;
  quantity: number;
};

type ChartRow = { name: string; value: number };

type Stats = {
  totalProducts: number;
  totalVariants: number;
  totalStock: number;
  purchaseValue: number;
  saleValue: number;
  profit: number;
  topByStock: ChartRow[];
  topBySaleValue: ChartRow[];
  lowStock: LowStockRow[];
};

const LOW_STOCK_THRESHOLD = 5;

function computeStats(products: Product[]): Stats {
  let totalVariants = 0;
  let totalStock = 0;
  let purchaseValue = 0;
  let saleValue = 0;
  const topByStock: ChartRow[] = [];
  const topBySaleValue: ChartRow[] = [];
  const lowStock: LowStockRow[] = [];

  for (const p of products) {
    totalVariants += p.variants.length;
    const stock = productTotalStock(p);
    totalStock += stock;

    let pSaleVal = 0;
    for (const v of p.variants) {
      purchaseValue += v.price * v.quantity;
      saleValue += v.salePrice * v.quantity;
      pSaleVal += v.salePrice * v.quantity;

      if (v.quantity <= LOW_STOCK_THRESHOLD) {
        lowStock.push({
          productName: p.name,
          attrLabel: Object.values(v.attributeValues).join(" / ") || "—",
          sku: v.sku || "—",
          quantity: v.quantity,
        });
      }
    }

    topByStock.push({ name: p.name, value: stock });
    topBySaleValue.push({ name: p.name, value: pSaleVal });
  }

  return {
    totalProducts: products.length,
    totalVariants,
    totalStock,
    purchaseValue,
    saleValue,
    profit: saleValue - purchaseValue,
    topByStock: topByStock.sort((a, b) => b.value - a.value).slice(0, 6),
    topBySaleValue: topBySaleValue
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
    lowStock: lowStock.sort((a, b) => a.quantity - b.quantity),
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   Sub-components
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
  const colors = {
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
        className={`mt-3 text-2xl font-bold ${accent ? colors[accent] : "text-[#16191f]"}`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-[#879596]">{sub}</p>}
    </div>
  );
}

/* Custom recharts tooltip */
function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-[#d5dbdb] bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-[#16191f]">{label}</p>
      <p className="mt-0.5 text-[#0073bb]">
        {payload[0].value.toLocaleString("fa-IR")}
        {unit ? ` ${unit}` : ""}
      </p>
    </div>
  );
}

/* Truncate long product names for chart ticks */
function truncate(s: string, n = 10) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

const BAR_COLORS = [
  "#0073bb",
  "#006499",
  "#005580",
  "#004666",
  "#ec7211",
  "#d4640f",
];

/* ─────────────────────────────────────────────────────────────────────────
   Page
──────────────────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [expensesTotal, setExpensesTotal] = useState(0);

  useEffect(() => {
    const load = async () => {
      setProducts(await getProducts());
      setExpensesTotal(await getExpensesSum());
    };
    void load();
  }, []);

  const stats = useMemo(() => computeStats(products), [products]);

  const fmt = (n: number) => n.toLocaleString("fa-IR");
  const fmtM = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} میلیارد`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} میلیون`;
    return fmt(n);
  };

  const today = new Date().toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d5dbdb] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#16191f]">داشبورد</h1>
          <p className="mt-0.5 text-sm text-[#545b64]">{today}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/expenses"
            className="rounded border border-[#0073bb] bg-white px-4 py-2 text-sm font-medium text-[#0073bb] hover:bg-[#e7f2f8] transition"
          >
            + ثبت هزینه
          </Link>
          <Link
            href="/products/manage"
            className="rounded bg-[#ec7211] px-4 py-2 text-sm font-medium text-white hover:bg-[#eb5f07] transition"
          >
            + محصول جدید
          </Link>
        </div>
      </div>

      {/* ── KPI row 1 ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="تعداد محصولات"
          value={fmt(stats.totalProducts)}
          sub="کل محصولات ثبت‌شده"
        />
        <KpiCard
          label="تعداد ترکیب‌ها"
          value={fmt(stats.totalVariants)}
          sub="مجموع تمام ترکیب‌ها"
        />
        <KpiCard
          label="کل موجودی"
          value={fmt(stats.totalStock)}
          sub="مجموع تعداد واحدها"
          accent="blue"
        />
        <Link href="/expenses" className="block">
          <KpiCard
            label="جمع هزینه‌ها"
            value={fmtM(expensesTotal)}
            sub="تومان — کلیک برای مدیریت"
            accent="red"
          />
        </Link>
      </div>

      {/* ── KPI row 2 ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="ارزش موجودی خرید"
          value={fmtM(stats.purchaseValue)}
          sub="تومان — قیمت خرید × تعداد"
          accent="orange"
        />
        <KpiCard
          label="ارزش موجودی فروش"
          value={fmtM(stats.saleValue)}
          sub="تومان — قیمت فروش × تعداد"
          accent="blue"
        />
        <KpiCard
          label="سود بالقوه"
          value={fmtM(stats.profit)}
          sub="تومان — ارزش فروش منهای ارزش خرید"
          accent={stats.profit >= 0 ? "green" : "red"}
        />
      </div>

      {/* ── Charts ──────────────────────────────────────────────────────── */}
      {stats.totalProducts > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Chart 1 — Top by stock */}
          <div className="rounded border border-[#d5dbdb] bg-white shadow-sm">
            <div className="border-b border-[#d5dbdb] bg-[#f2f3f3] px-5 py-3">
              <h2 className="text-sm font-semibold text-[#16191f]">
                بیشترین موجودی (واحد)
              </h2>
            </div>
            <div className="p-4" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.topByStock}
                  margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e8ecee"
                    vertical={false}
                  />
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
                    width={40}
                    tickFormatter={(v) => v.toLocaleString("fa-IR")}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => (
                      <ChartTooltip
                        active={active}
                        payload={payload as readonly { value: number }[]}
                        label={String(label ?? "")}
                        unit="واحد"
                      />
                    )}
                  />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {stats.topByStock.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2 — Top by sale value */}
          <div className="rounded border border-[#d5dbdb] bg-white shadow-sm">
            <div className="border-b border-[#d5dbdb] bg-[#f2f3f3] px-5 py-3">
              <h2 className="text-sm font-semibold text-[#16191f]">
                بیشترین ارزش فروش (تومان)
              </h2>
            </div>
            <div className="p-4" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.topBySaleValue}
                  margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e8ecee"
                    vertical={false}
                  />
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
                    width={56}
                    tickFormatter={(v) =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(0)}M`
                        : v.toLocaleString("fa-IR")
                    }
                  />
                  <Tooltip
                    content={({ active, payload, label }) => (
                      <ChartTooltip
                        active={active}
                        payload={payload as readonly { value: number }[]}
                        label={String(label ?? "")}
                        unit="تومان"
                      />
                    )}
                  />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {stats.topBySaleValue.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Low stock alert ─────────────────────────────────────────────── */}
      <div className="rounded border border-[#d5dbdb] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#d5dbdb] bg-[#f2f3f3] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#d13212] text-[10px] font-bold text-white">
              {stats.lowStock.length}
            </span>
            <h2 className="text-sm font-semibold text-[#16191f]">
              هشدار کم‌موجودی
            </h2>
            <span className="text-xs text-[#879596]">
              (موجودی ≤ {LOW_STOCK_THRESHOLD} واحد)
            </span>
          </div>
          <Link
            href="/products/manage"
            className="text-xs text-[#0073bb] hover:underline"
          >
            مشاهده همه محصولات
          </Link>
        </div>

        {stats.lowStock.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-[#879596]">
            همه محصولات موجودی کافی دارند ✓
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#d5dbdb] text-right">
                  <th className="px-5 py-2.5 text-xs font-semibold text-[#545b64]">
                    محصول
                  </th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-[#545b64]">
                    ترکیب
                  </th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-[#545b64]">
                    کد
                  </th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-[#545b64]">
                    موجودی
                  </th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-[#545b64]">
                    وضعیت
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.lowStock.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-[#f2f3f3] hover:bg-[#f8f9f9] transition"
                  >
                    <td className="px-5 py-3 font-medium text-[#16191f]">
                      {row.productName}
                    </td>
                    <td className="px-5 py-3 text-[#545b64]">
                      {row.attrLabel}
                    </td>
                    <td className="px-5 py-3 font-mono text-[#545b64]">
                      {row.sku}
                    </td>
                    <td className="px-5 py-3 font-bold text-[#16191f]">
                      {row.quantity.toLocaleString("fa-IR")}
                    </td>
                    <td className="px-5 py-3">
                      {row.quantity === 0 ? (
                        <span className="inline-flex items-center rounded bg-[#fdf3f1] px-2 py-0.5 text-xs font-medium text-[#d13212]">
                          ناموجود
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-[#fef9f0] px-2 py-0.5 text-xs font-medium text-[#ec7211]">
                          رو به اتمام
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {stats.totalProducts === 0 && (
        <div className="rounded border border-dashed border-[#aab7b8] bg-white py-16 text-center">
          <p className="text-[#545b64]">هنوز محصولی ثبت نشده است.</p>
          <Link
            href="/products/manage/new"
            className="mt-4 inline-block rounded bg-[#ec7211] px-4 py-2 text-sm font-medium text-white hover:bg-[#eb5f07] transition"
          >
            + افزودن اولین محصول
          </Link>
        </div>
      )}
    </div>
  );
}
