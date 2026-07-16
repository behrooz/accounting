"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getInvoiceById, type Invoice } from "@/lib/invoices";
import { getShopSettings, type ShopSettings } from "@/lib/shop";
import { gregorianISOToJalali } from "@/lib/jalali";

const fa = (n: number) => Math.round(n).toLocaleString("fa-IR");
const faDate = (iso: string) => gregorianISOToJalali(iso, "YYYY/MM/DD") || iso;

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
        <LabelView invoice={invoice} shop={shop} />
      ) : (
        <InvoiceView invoice={invoice} />
      )}
    </div>
  );
}

function LabelView({
  invoice,
  shop,
}: {
  invoice: Invoice;
  shop: ShopSettings;
}) {
  const recipientName = invoice.customerName?.trim() || "—";
  const recipientPhone = invoice.customerPhone?.trim() || "";
  const recipientAddress = invoice.customerAddress?.trim() || "";

  return (
    <div className="mx-auto max-w-[420px] p-6">
      <div className="overflow-hidden rounded-lg border-2 border-[#16191f]">
        <div className="border-b-2 border-[#16191f] bg-[#f2f3f3] px-4 py-2 text-center text-sm font-bold">
          برچسب بسته پستی
          <span className="mr-2 font-normal text-[#545b64]">
            ({invoice.number})
          </span>
        </div>

        {/* گیرنده = مشتری / آدرس سفارش */}
        <div className="border-b-2 border-dashed border-[#aab7b8] p-4">
          <p className="mb-2 text-xs font-bold text-[#1d8102]">گیرنده (آدرس سفارش)</p>
          <p className="text-lg font-bold">{recipientName}</p>
          {recipientPhone ? (
            <p className="mt-1 text-sm tabular-nums" dir="ltr">
              {recipientPhone}
            </p>
          ) : null}
          {recipientAddress ? (
            <p className="mt-2 text-sm leading-6">{recipientAddress}</p>
          ) : (
            <p className="mt-2 text-sm text-[#d13212]">آدرس سفارش ثبت نشده است</p>
          )}
        </div>

        {/* فرستنده = فروشگاه از دیتابیس */}
        <div className="p-4">
          <p className="mb-2 text-xs font-bold text-[#0073bb]">فرستنده (فروشگاه)</p>
          <p className="text-base font-bold">{shop.name?.trim() || "—"}</p>
          {shop.phone?.trim() ? (
            <p className="mt-1 text-sm tabular-nums" dir="ltr">
              {shop.phone}
            </p>
          ) : null}
          {shop.address?.trim() ? (
            <p className="mt-2 text-sm leading-6">{shop.address}</p>
          ) : (
            <p className="mt-2 text-sm text-[#d13212]">
              اطلاعات فروشگاه را از منوی «اطلاعات فروشگاه» تکمیل کنید
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function InvoiceView({ invoice }: { invoice: Invoice }) {
  return (
    <div className="mx-auto max-w-[780px] p-10">
      <div className="mb-8 flex items-start justify-between border-b-2 border-[#16191f] pb-5">
        <div>
          <h1 className="text-2xl font-bold">سیستم حسابداری</h1>
          <p className="mt-1 text-sm text-[#545b64]">فاکتور فروش</p>
        </div>
        <div className="text-left">
          <p className="text-2xl font-bold text-[#0073bb]">{invoice.number}</p>
          <p className="mt-1 text-sm text-[#545b64]">تاریخ: {faDate(invoice.date)}</p>
        </div>
      </div>

      {(invoice.customerName || invoice.customerPhone || invoice.customerAddress) && (
        <div className="mb-6 rounded border border-[#d5dbdb] p-4">
          <p className="mb-2 text-xs font-semibold text-[#545b64]">مشتری / آدرس سفارش</p>
          {invoice.customerName ? (
            <p className="font-bold">{invoice.customerName}</p>
          ) : null}
          {invoice.customerPhone ? (
            <p className="mt-0.5 text-sm text-[#545b64]" dir="ltr">
              تلفن: {invoice.customerPhone}
            </p>
          ) : null}
          {invoice.customerAddress ? (
            <p className="mt-0.5 text-sm text-[#545b64]">آدرس: {invoice.customerAddress}</p>
          ) : null}
        </div>
      )}

      <table className="mb-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-[#16191f] text-right">
            <th className="py-2 pl-4 text-xs font-semibold text-[#545b64]">#</th>
            <th className="py-2 pl-4 text-xs font-semibold text-[#545b64]">شرح کالا</th>
            <th className="py-2 pl-4 text-xs font-semibold text-[#545b64]">کد</th>
            <th className="py-2 pl-4 text-right text-xs font-semibold text-[#545b64]">قیمت واحد</th>
            <th className="py-2 pl-4 text-right text-xs font-semibold text-[#545b64]">تعداد</th>
            <th className="py-2 text-right text-xs font-semibold text-[#545b64]">جمع</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => (
            <tr key={item.id} className="border-b border-[#d5dbdb]">
              <td className="py-2.5 pl-4 text-[#545b64]">{i + 1}</td>
              <td className="py-2.5 pl-4">
                <p className="font-medium">{item.productName}</p>
                {item.variantLabel && item.variantLabel !== "ساده" ? (
                  <p className="text-xs text-[#545b64]">{item.variantLabel}</p>
                ) : null}
              </td>
              <td className="py-2.5 pl-4 font-mono text-xs text-[#545b64]">
                {item.sku || "—"}
              </td>
              <td className="py-2.5 pl-4 tabular-nums text-left">{fa(item.unitPrice)}</td>
              <td className="py-2.5 pl-4 text-left">{item.quantity}</td>
              <td className="py-2.5 tabular-nums font-semibold text-left">{fa(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-72 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#545b64]">جمع کل:</span>
            <span className="tabular-nums">{fa(invoice.subtotal)} تومان</span>
          </div>
          {invoice.discount > 0 ? (
            <div className="flex justify-between">
              <span className="text-[#545b64]">تخفیف:</span>
              <span className="tabular-nums text-[#d13212]">
                ({fa(invoice.discount)}) تومان
              </span>
            </div>
          ) : null}
          {(invoice.shippingFee ?? 0) > 0 ? (
            <div className="flex justify-between">
              <span className="text-[#545b64]">هزینه ارسال:</span>
              <span className="tabular-nums">{fa(invoice.shippingFee ?? 0)} تومان</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-[#16191f] pt-2 text-base font-bold">
            <span>قابل پرداخت:</span>
            <span className="tabular-nums text-[#0073bb]">{fa(invoice.total)} تومان</span>
          </div>
        </div>
      </div>
    </div>
  );
}
