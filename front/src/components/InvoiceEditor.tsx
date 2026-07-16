"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getProducts, type Product } from "@/lib/products";
import { getCustomers, type Customer } from "@/lib/customers";
import {
  computeItemTotal,
  computeInvoiceTotals,
  nextInvoiceNumber,
  saveInvoice,
  type Invoice,
  type InvoiceItem,
} from "@/lib/invoices";
import ShamsiDatePicker from "@/components/ShamsiDatePicker";

/* ─────────────────────────────────────────────────────────────────────────
   Local item state (same shape as InvoiceItem)
──────────────────────────────────────────────────────────────────────────── */

type ItemRow = InvoiceItem;

function emptyItem(): ItemRow {
  return {
    id: crypto.randomUUID(),
    productId: "",
    variantId: "",
    productName: "",
    variantLabel: "",
    sku: "",
    unitPrice: 0,
    quantity: 1,
    total: 0,
  };
}

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const fa = (n: number) => Math.round(n).toLocaleString("fa-IR");

/* ─────────────────────────────────────────────────────────────────────────
   Props
──────────────────────────────────────────────────────────────────────────── */

type Props = {
  initialInvoice?: Invoice;
  isNew?: boolean;
};

/* ─────────────────────────────────────────────────────────────────────────
   Component
──────────────────────────────────────────────────────────────────────────── */

export default function InvoiceEditor({
  initialInvoice,
  isNew = true,
}: Props) {
  const router = useRouter();
  const invoiceId = useRef(initialInvoice?.id ?? crypto.randomUUID());

  /* ── Data from localStorage ─────────────────────────────────────────── */
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Product picker state
  const [activeProductPicker, setActiveProductPicker] = useState<string | null>(
    null,
  ); // item.id
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [pickerPos, setPickerPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  /* ── Invoice header fields ──────────────────────────────────────────── */
  const [invNumber, setInvNumber] = useState(initialInvoice?.number ?? "");
  const [date, setDate] = useState(initialInvoice?.date ?? todayIso());
  const [customerId, setCustomerId] = useState(
    initialInvoice?.customerId ?? "",
  );
  const [customerName, setCustomerName] = useState(
    initialInvoice?.customerName ?? "",
  );
  const [customerPhone, setCustomerPhone] = useState(
    initialInvoice?.customerPhone ?? "",
  );
  const [customerAddress, setCustomerAddress] = useState(
    initialInvoice?.customerAddress ?? "",
  );
  const [notes, setNotes] = useState(initialInvoice?.notes ?? "");
  const [discount, setDiscount] = useState(initialInvoice?.discount ?? 0);
  const [items, setItems] = useState<ItemRow[]>(initialInvoice?.items ?? []);

  useEffect(() => {
    const load = async () => {
      setProducts(await getProducts());
      setCustomers(await getCustomers());
      if (isNew) setInvNumber(await nextInvoiceNumber());
    };
    void load();
  }, [isNew]);

  /* ── Customer select → auto-fill fields ─────────────────────────────── */
  const handleCustomerSelect = (id: string) => {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (c) {
      setCustomerName(c.name);
      setCustomerPhone(c.phone);
      setCustomerAddress(c.address);
    }
  };

  /* ── Item helpers ────────────────────────────────────────────────────── */
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const openProductPicker = (itemId: string, initial = "") => {
    setActiveProductPicker(itemId);
    setProductSearchQuery(initial);
    // compute button position for anchoring the dropdown
    setTimeout(() => {
      const btn = document.querySelector(
        `[data-item-button="${itemId}"]`,
      ) as HTMLElement | null;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        setPickerPos({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      } else {
        setPickerPos(null);
      }
    }, 0);
  };

  const closeProductPicker = () => {
    setActiveProductPicker(null);
    setProductSearchQuery("");
    setPickerPos(null);
  };

  const selectProductForItem = (itemId: string, productId: string) => {
    // delegate to updateItem which already populates first variant and unitPrice
    updateItem(itemId, { productId });
    closeProductPicker();
  };

  // close picker when clicking outside
  useEffect(() => {
    if (!activeProductPicker) return;
    const handler = (ev: MouseEvent) => {
      const target = ev.target as Node | null;
      const picker = document.getElementById(
        `product-picker-${activeProductPicker}`,
      );
      const button = document.querySelector(
        `[data-item-button="${activeProductPicker}"]`,
      );
      if (picker && picker.contains(target)) return;
      if (button && button.contains(target)) return;
      // inline close to avoid extra deps
      setActiveProductPicker(null);
      setProductSearchQuery("");
      setPickerPos(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [activeProductPicker]);

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  const updateItem = useCallback(
    (id: string, changes: Partial<ItemRow>) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const next = { ...item, ...changes };

          /* Product changed → auto-select first variant */
          if (changes.productId !== undefined) {
            const product = products.find((p) => p.id === changes.productId);
            if (product) {
              next.productName = product.name;
              const v = product.variants[0];
              if (v) {
                next.variantId = v.id;
                next.variantLabel =
                  Object.values(v.attributeValues).join(" / ") || "ساده";
                next.sku = v.sku;
                next.unitPrice = v.salePrice;
              } else {
                next.variantId = "";
                next.variantLabel = "";
                next.sku = "";
                next.unitPrice = 0;
              }
            }
          }

          /* Variant changed → update label / sku / price */
          if (
            changes.variantId !== undefined &&
            changes.productId === undefined
          ) {
            const product = products.find((p) => p.id === next.productId);
            const v = product?.variants.find((x) => x.id === changes.variantId);
            if (v) {
              next.variantLabel =
                Object.values(v.attributeValues).join(" / ") || "ساده";
              next.sku = v.sku;
              next.unitPrice = v.salePrice;
            }
          }

          next.total = computeItemTotal(next.unitPrice, next.quantity);
          return next;
        }),
      );
    },
    [products],
  );

  /* ── Computed totals ─────────────────────────────────────────────────── */
  const { subtotal, total } = computeInvoiceTotals(items, discount);

  /* ── Build final Invoice object ─────────────────────────────────────── */
  const buildInvoice = (status: Invoice["status"]): Invoice => ({
    id: invoiceId.current,
    number: invNumber,
    date,
    customerId,
    customerName,
    customerPhone,
    customerAddress,
    items,
    notes,
    discount,
    subtotal,
    total,
    status,
    createdAt: initialInvoice?.createdAt ?? new Date().toISOString(),
  });

  const handleSave = async (status: Invoice["status"]) => {
    if (!invNumber.trim()) {
      alert("شماره فاکتور را وارد کنید.");
      return;
    }
    await saveInvoice(buildInvoice(status));
    router.push("/sales");
  };

  const currentStatus: Invoice["status"] =
    initialInvoice?.status === "confirmed" ? "confirmed" : "draft";

  const handlePrint = async () => {
    await saveInvoice(buildInvoice(currentStatus));
    router.push(`/sales/${invoiceId.current}/print?mode=invoice`);
  };

  const handlePrintLabel = async () => {
    if (!customerName.trim() && !customerPhone.trim() && !customerAddress.trim()) {
      alert("اطلاعات مشتری / آدرس سفارش برای برچسب بسته ناقص است.");
      return;
    }
    await saveInvoice(buildInvoice(currentStatus));
    router.push(`/sales/${invoiceId.current}/print?mode=label`);
  };

  /* ── Input class helper ──────────────────────────────────────────────── */
  const inp =
    "rounded border border-[#aab7b8] bg-white px-3 py-2 text-sm text-[#16191f] placeholder:text-[#879596] outline-none focus:border-[#0073bb] focus:ring-1 focus:ring-[#0073bb]";

  const smallInp =
    "rounded border border-[#aab7b8] bg-white px-2 py-1.5 text-xs text-[#16191f] outline-none focus:border-[#0073bb] w-full tabular-nums";

  /* ───────────────────────────────────────────────────────────────────── */
  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════
          SCREEN VIEW  (hidden when printing)
      ══════════════════════════════════════════════════════════════════ */}
      <div className="flex w-full flex-col gap-5 p-6 print:hidden">
        {/* ── Page header ───────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d5dbdb] pb-4">
          <div>
            <h1 className="text-xl font-bold text-[#16191f]">
              {isNew ? "فاکتور جدید" : `فاکتور ${invNumber}`}
            </h1>
            <p className="mt-0.5 text-sm text-[#545b64]">
              اقلام را وارد کنید، سپس ذخیره یا چاپ کنید.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/sales")}
              className="rounded border border-[#aab7b8] bg-white px-4 py-2 text-sm font-medium text-[#16191f] hover:bg-[#f2f3f3] transition"
            >
              انصراف
            </button>
            {!isNew && (
              <>
                <button
                  onClick={() => void handlePrint()}
                  className="rounded border border-[#0073bb] bg-white px-4 py-2 text-sm font-medium text-[#0073bb] hover:bg-[#e7f2f8] transition"
                >
                  چاپ فاکتور
                </button>
                <button
                  onClick={() => void handlePrintLabel()}
                  className="rounded border border-[#1d8102] bg-white px-4 py-2 text-sm font-medium text-[#1d8102] hover:bg-[#ebf6e8] transition"
                >
                  برچسب بسته
                </button>
              </>
            )}
            <button
              onClick={() => void handleSave("draft")}
              className="rounded border border-[#aab7b8] bg-white px-4 py-2 text-sm font-medium text-[#16191f] hover:bg-[#f2f3f3] transition"
            >
              ذخیره پیش‌نویس
            </button>
            <button
              onClick={() => void handleSave("confirmed")}
              className="rounded bg-[#ec7211] px-4 py-2 text-sm font-medium text-white hover:bg-[#eb5f07] transition"
            >
              تأیید و ذخیره
            </button>
          </div>
        </div>

        {/* ── Invoice info + customer ────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Invoice details */}
          <div className="rounded border border-[#d5dbdb] bg-white shadow-sm">
            <div className="border-b border-[#d5dbdb] bg-[#f2f3f3] px-4 py-3">
              <h2 className="text-sm font-semibold text-[#16191f]">
                اطلاعات فاکتور
              </h2>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[#545b64]">
                  شماره فاکتور
                </span>
                <input
                  value={invNumber}
                  onChange={(e) => setInvNumber(e.target.value)}
                  className={inp}
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[#545b64]">
                  تاریخ
                </span>
                <ShamsiDatePicker
                  value={date}
                  onChange={setDate}
                  inputClassName={inp}
                />
              </div>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-[#545b64]">
                  توضیحات
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={`${inp} resize-none`}
                />
              </label>
            </div>
          </div>

          {/* Customer */}
          <div className="rounded border border-[#d5dbdb] bg-white shadow-sm">
            <div className="border-b border-[#d5dbdb] bg-[#f2f3f3] px-4 py-3">
              <h2 className="text-sm font-semibold text-[#16191f]">
                اطلاعات مشتری
              </h2>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-[#545b64]">
                  انتخاب از لیست مشتریان
                </span>
                <select
                  value={customerId}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className={inp}
                >
                  <option value="">— وارد کردن دستی —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[#545b64]">
                  نام مشتری
                </span>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="نام"
                  className={inp}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[#545b64]">تلفن</span>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="09xxxxxxxxx"
                  className={inp}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-[#545b64]">آدرس</span>
                <input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="آدرس"
                  className={inp}
                />
              </label>
            </div>
          </div>
        </div>

        {/* ── Invoice items ──────────────────────────────────────────── */}
        <div className="rounded border border-[#d5dbdb] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#d5dbdb] bg-[#f2f3f3] px-4 py-3">
            <h2 className="text-sm font-semibold text-[#16191f]">
              اقلام فاکتور
            </h2>
            <button
              onClick={addItem}
              className="rounded border border-[#0073bb] bg-white px-3 py-1.5 text-xs font-medium text-[#0073bb] hover:bg-[#e7f2f8] transition"
            >
              + افزودن قلم
            </button>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-[#879596]">
              هیچ قلمی ثبت نشده — روی «افزودن قلم» کلیک کنید.
            </p>
          ) : (
            <div className="overflow-x-auto" style={{ paddingBottom: 500 }}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#d5dbdb] text-right">
                    <th className="px-3 py-2.5 text-xs font-semibold text-[#545b64] w-8">
                      #
                    </th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-[#545b64]">
                      محصول
                    </th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-[#545b64]">
                      ترکیب
                    </th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-[#545b64] w-24">
                      کد SKU
                    </th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-[#545b64] w-32">
                      قیمت واحد
                    </th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-[#545b64] w-20">
                      تعداد
                    </th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-[#545b64] w-32">
                      جمع (تومان)
                    </th>
                    <th className="px-3 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const product = products.find(
                      (p) => p.id === item.productId,
                    );
                    const variants = product?.variants ?? [];
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-[#f2f3f3] hover:bg-[#f8f9f9]"
                      >
                        <td className="px-3 py-2 text-[#879596] text-xs">
                          {idx + 1}
                        </td>

                        {/* Product */}
                        <td className="px-3 py-2">
                          <div className="relative">
                            <button
                              type="button"
                              data-item-button={item.id}
                              onClick={() =>
                                openProductPicker(
                                  item.id,
                                  item.productName ?? "",
                                )
                              }
                              className="w-36 text-left rounded border border-[#aab7b8] bg-white px-2 py-1.5 text-xs text-[#16191f] outline-none hover:border-[#0073bb] flex items-center justify-between"
                            >
                              <span>{item.productName || "انتخاب محصول…"}</span>
                              <span className="ml-2 text-xs text-[#879596]">
                                ▾
                              </span>
                            </button>

                            {activeProductPicker === item.id && (
                              <div
                                id={`product-picker-${item.id}`}
                                className="absolute z-50 mt-1 left-0 right-0 rounded bg-white shadow-lg border border-[#d5dbdb]"
                              >
                                <div className="flex items-center gap-3 border-b border-[#e6e6e6] p-2">
                                  <input
                                    autoFocus
                                    value={productSearchQuery}
                                    onChange={(e) =>
                                      setProductSearchQuery(e.target.value)
                                    }
                                    placeholder="Search product by name, SKU or attribute..."
                                    className="w-full rounded border border-[#aab7b8] px-3 py-2 text-sm outline-none"
                                  />
                                  <button
                                    onClick={closeProductPicker}
                                    className="text-sm text-[#d13212]"
                                  >
                                    ×
                                  </button>
                                </div>
                                <div
                                  style={{ maxHeight: 360 }}
                                  className="overflow-auto"
                                >
                                  <table className="w-full border-collapse text-sm">
                                    <thead>
                                      <tr className="border-b bg-[#f8f9f9]">
                                        <th className="px-3 py-2 text-right text-xs text-[#545b64]">
                                          نام
                                        </th>
                                        <th className="px-3 py-2 text-right text-xs text-[#545b64]">
                                          ترکیبات
                                        </th>
                                        <th className="px-3 py-2 text-right text-xs text-[#545b64]">
                                          قیمت فروش
                                        </th>
                                        <th className="px-3 py-2 w-24" />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {products
                                        .filter((p) => {
                                          const q = productSearchQuery
                                            .trim()
                                            .toLowerCase();
                                          if (!q) return true;
                                          if (p.name.toLowerCase().includes(q))
                                            return true;
                                          for (const v of p.variants) {
                                            if (
                                              v.sku?.toLowerCase().includes(q)
                                            )
                                              return true;
                                            const av = Object.values(
                                              v.attributeValues,
                                            )
                                              .join(" ")
                                              .toLowerCase();
                                            if (av.includes(q)) return true;
                                          }
                                          return false;
                                        })
                                        .map((p) => (
                                          <tr
                                            key={p.id}
                                            className="border-b hover:bg-[#f8f9f9]"
                                          >
                                            <td className="px-3 py-2 text-right font-medium">
                                              {p.name}
                                            </td>
                                            <td className="px-3 py-2 text-right text-xs text-[#545b64]">
                                              {p.attributes
                                                .map((a) => a.name)
                                                .join("، ") || "—"}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono">
                                              {p.variants.length
                                                ? Number(
                                                    p.variants[0].salePrice,
                                                  ).toLocaleString("fa-IR")
                                                : "—"}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              <button
                                                onClick={() =>
                                                  activeProductPicker &&
                                                  selectProductForItem(
                                                    activeProductPicker,
                                                    p.id,
                                                  )
                                                }
                                                className="rounded bg-[#0073bb] px-3 py-1 text-xs text-white"
                                              >
                                                انتخاب
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Variant */}
                        <td className="px-3 py-2">
                          <select
                            value={item.variantId}
                            onChange={(e) =>
                              updateItem(item.id, { variantId: e.target.value })
                            }
                            disabled={!item.productId}
                            className="rounded border border-[#aab7b8] bg-white px-2 py-1.5 text-xs text-[#16191f] outline-none focus:border-[#0073bb] w-32 disabled:opacity-50"
                          >
                            <option value="">انتخاب ترکیب…</option>
                            {variants.map((v) => {
                              const lbl =
                                Object.values(v.attributeValues).join(" / ") ||
                                "ساده";
                              return (
                                <option key={v.id} value={v.id}>
                                  {lbl}
                                </option>
                              );
                            })}
                          </select>
                        </td>

                        {/* SKU */}
                        <td className="px-3 py-2 font-mono text-xs text-[#545b64]">
                          {item.sku || "—"}
                        </td>

                        {/* Unit price */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateItem(item.id, {
                                unitPrice: Number(e.target.value) || 0,
                              })
                            }
                            className={smallInp + " w-28"}
                          />
                        </td>

                        {/* Quantity */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(item.id, {
                                quantity: Math.max(1, Number(e.target.value)),
                              })
                            }
                            className={smallInp + " w-16"}
                          />
                        </td>

                        {/* Total */}
                        <td className="px-3 py-2 tabular-nums font-semibold text-[#16191f]">
                          {fa(item.total)}
                        </td>

                        {/* Delete */}
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-lg font-bold text-[#d13212] hover:text-[#ba2a0c] leading-none"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>
            
          )}

        {/* ── Totals bar ─────────────────────────────────────────── */}
          {items.length > 0 && (
            <div className="border-t border-[#d5dbdb] p-4">
              <div className="flex justify-end">
                <div className="w-72 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[#545b64]">جمع اقلام:</span>
                    <span className="tabular-nums font-medium text-[#16191f]">
                      {fa(subtotal)} تومان
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#545b64] shrink-0">
                      تخفیف (تومان):
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                      className="rounded border border-[#aab7b8] bg-white px-2 py-1 text-xs text-[#16191f] outline-none focus:border-[#0073bb] w-28 tabular-nums"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded border border-[#0073bb] bg-[#e7f2f8] px-3 py-2 font-bold">
                    <span className="text-[#0073bb]">قابل پرداخت:</span>
                    <span className="tabular-nums text-[#0073bb]">
                      {fa(total)} تومان
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Print hint when in edit mode */}
        {isNew && (
          <p className="text-xs text-[#879596]">
            پس از ذخیره، دکمه‌های «چاپ فاکتور» و «برچسب بسته» فعال می‌شوند.
          </p>
        )}
      </div>
    </>
  );
}
