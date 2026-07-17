"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getInvoiceById, type Invoice } from "@/lib/invoices";
import { getShopSettings, type ShopSettings } from "@/lib/shop";
import {
  InvoiceLabelPrintContent,
  InvoicePrintContent,
} from "@/components/InvoicePrintContent";

export default function InvoicePrintPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const mode = searchParams?.get("mode") === "label" ? "label" : "invoice";

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [inv, settings] = await Promise.all([
          getInvoiceById(id),
          getShopSettings(),
        ]);
        if (cancelled) return;
        if (!inv) {
          setError("فاکتور یافت نشد.");
          return;
        }
        setInvoice(inv);
        setShop(settings);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "خطا در بارگذاری");
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!invoice || !shop) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [invoice, shop]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 print:hidden">
        <p className="text-[#545b64]">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/sales")}
          className="rounded bg-[#0073bb] px-4 py-2 text-sm text-white"
        >
          بازگشت
        </button>
      </div>
    );
  }

  if (!invoice || !shop) {
    return (
      <div className="flex min-h-screen items-center justify-center print:hidden">
        <p className="animate-pulse text-sm text-[#879596]">آماده‌سازی چاپ…</p>
      </div>
    );
  }

  return (
    <div className="bg-white text-[#16191f]">
      <div className="flex items-center justify-between gap-3 border-b border-[#d5dbdb] p-4 print:hidden">
        <p className="text-sm text-[#545b64]">
          {mode === "label" ? "چاپ برچسب بسته" : "چاپ فاکتور"} — {invoice.number}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded bg-[#ec7211] px-4 py-2 text-sm font-medium text-white"
          >
            چاپ مجدد
          </button>
          <button
            type="button"
            onClick={() => router.push("/sales")}
            className="rounded border border-[#aab7b8] bg-white px-4 py-2 text-sm"
          >
            بازگشت به لیست
          </button>
        </div>
      </div>

      {mode === "label" ? (
        <InvoiceLabelPrintContent invoice={invoice} shop={shop} />
      ) : (
        <InvoicePrintContent invoice={invoice} />
      )}
    </div>
  );
}
