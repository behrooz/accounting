"use client";

import { useEffect, useState } from "react";
import {
  getShopSettings,
  saveShopSettings,
  type ShopSettings,
} from "@/lib/shop";

const empty: ShopSettings = { name: "", phone: "", address: "" };

export default function ShopSettingsPage() {
  const [form, setForm] = useState<ShopSettings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void getShopSettings()
      .then(setForm)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert("نام فروشگاه را وارد کنید.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await saveShopSettings({
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      });
      setMessage("ذخیره شد.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  };

  const inp =
    "rounded border border-[#aab7b8] bg-white px-3 py-2 text-sm text-[#16191f] outline-none focus:border-[#0073bb] focus:ring-1 focus:ring-[#0073bb]";

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <p className="animate-pulse text-sm text-[#879596]">در حال بارگذاری…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl p-6">
      <div className="mb-5 border-b border-[#d5dbdb] pb-4">
        <h1 className="text-xl font-bold text-[#16191f]">اطلاعات فروشگاه</h1>
        <p className="mt-0.5 text-sm text-[#545b64]">
          این اطلاعات به‌عنوان «فرستنده» روی برچسب بسته چاپ می‌شود.
        </p>
      </div>

      <div className="rounded border border-[#d5dbdb] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#545b64]">نام فروشگاه</span>
            <input
              className={inp}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="مثلاً فروشگاه آبرنگ"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#545b64]">تلفن فروشگاه</span>
            <input
              className={inp}
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="0912…"
              dir="ltr"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#545b64]">آدرس فروشگاه</span>
            <textarea
              className={`${inp} min-h-[96px] resize-y`}
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="آدرس کامل فروشگاه"
            />
          </label>
        </div>

        <div className="mt-5 flex items-center gap-3">
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
    </div>
  );
}
