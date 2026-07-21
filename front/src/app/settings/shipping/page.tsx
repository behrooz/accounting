"use client";

import { useEffect, useState } from "react";
import {
  getShippingMethods,
  newShippingMethod,
  saveShippingMethods,
  type ShippingMethod,
} from "@/lib/shipping";

const inp =
  "w-full rounded border border-[#aab7b8] bg-white px-3 py-2 text-sm text-[#16191f] outline-none focus:border-[#0073bb] focus:ring-1 focus:ring-[#0073bb]";

export default function ShippingSettingsPage() {
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void getShippingMethods()
      .then((rows) => setMethods(rows.length ? rows : [newShippingMethod()]))
      .catch(() => setMethods([newShippingMethod()]))
      .finally(() => setLoading(false));
  }, []);

  const updateRow = (index: number, patch: Partial<ShippingMethod>) => {
    setMethods((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        if (patch.payAtDestination) next.fee = 0;
        return next;
      }),
    );
  };

  const addRow = () => {
    setMethods((prev) => [...prev, newShippingMethod(prev.length)]);
  };

  const removeRow = (index: number) => {
    setMethods((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const cleaned = methods
      .map((row, index) => ({
        ...row,
        id: row.id.trim(),
        name: row.name.trim(),
        deliveryNote: row.deliveryNote.trim(),
        fee: row.payAtDestination ? 0 : Math.max(0, Number(row.fee) || 0),
        sortOrder: index + 1,
      }))
      .filter((row) => row.name);

    if (!cleaned.length) {
      alert("حداقل یک روش ارسال با نام وارد کنید.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const saved = await saveShippingMethods(cleaned);
      setMethods(saved);
      setMessage("ذخیره شد.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <p className="animate-pulse text-sm text-[#879596]">در حال بارگذاری…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-5 border-b border-[#d5dbdb] pb-4">
        <h1 className="text-xl font-bold text-[#16191f]">روش‌های ارسال</h1>
        <p className="mt-0.5 text-sm text-[#545b64]">
          این گزینه‌ها در صفحه تسویه‌حساب فروشگاه به مشتری نمایش داده می‌شوند.
        </p>
      </div>

      <div className="space-y-4">
        {methods.map((row, index) => (
          <div
            key={`${row.id || "new"}-${index}`}
            className="rounded border border-[#d5dbdb] bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[#16191f]">
                روش {index + 1}
              </h2>
              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={methods.length <= 1}
                className="text-xs text-[#d13212] disabled:opacity-40"
              >
                حذف
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[#545b64]">
                  شناسه (لاتین، اختیاری)
                </span>
                <input
                  className={inp}
                  dir="ltr"
                  value={row.id}
                  onChange={(e) => updateRow(index, { id: e.target.value })}
                  placeholder="pishtaz"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[#545b64]">نام</span>
                <input
                  className={inp}
                  value={row.name}
                  onChange={(e) => updateRow(index, { name: e.target.value })}
                  placeholder="پست پیشتاز"
                />
              </label>
              <label className="flex flex-col gap-1.5 md:col-span-2">
                <span className="text-xs font-medium text-[#545b64]">
                  زمان تحویل
                </span>
                <input
                  className={inp}
                  value={row.deliveryNote}
                  onChange={(e) =>
                    updateRow(index, { deliveryNote: e.target.value })
                  }
                  placeholder="تحویل ۳ تا ۷ روز کاری"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[#545b64]">
                  هزینه (تومان)
                </span>
                <input
                  className={inp}
                  dir="ltr"
                  type="number"
                  min={0}
                  disabled={row.payAtDestination}
                  value={row.payAtDestination ? 0 : row.fee}
                  onChange={(e) =>
                    updateRow(index, { fee: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <div className="flex flex-col justify-end gap-3">
                <label className="flex items-center gap-2 text-sm text-[#16191f]">
                  <input
                    type="checkbox"
                    checked={row.payAtDestination}
                    onChange={(e) =>
                      updateRow(index, { payAtDestination: e.target.checked })
                    }
                  />
                  کرایه در مقصد
                </label>
                <label className="flex items-center gap-2 text-sm text-[#16191f]">
                  <input
                    type="checkbox"
                    checked={row.isActive}
                    onChange={(e) =>
                      updateRow(index, { isActive: e.target.checked })
                    }
                  />
                  فعال در فروشگاه
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="rounded border border-[#d5dbdb] bg-white px-4 py-2 text-sm text-[#16191f] hover:bg-[#f7fafa]"
        >
          افزودن روش ارسال
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="rounded bg-[#ec7211] px-5 py-2 text-sm font-medium text-white hover:bg-[#eb5f07] disabled:opacity-50 transition"
        >
          {saving ? "در حال ذخیره…" : "ذخیره"}
        </button>
        {message ? (
          <span className="text-sm text-[#1d8102]">{message}</span>
        ) : null}
      </div>
    </div>
  );
}
