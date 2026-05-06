"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateVariantCombinations,
  mergeVariants,
  saveProduct,
  type Product,
  type ProductAttribute,
  type ProductVariant,
} from "@/lib/products";
import VariantsGrid from "./VariantsGrid";

/* ─── Small inline helper: tag-style option input ───────────────────────── */
function AddOptionInput({ onAdd }: { onAdd: (label: string) => void }) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
  };

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      }}
      onBlur={submit}
      placeholder="گزینه جدید…"
      className="w-32 rounded border border-dashed border-[#aab7b8] bg-white px-2 py-1 text-xs text-[#16191f] placeholder:text-[#879596] outline-none focus:border-[#0073bb] focus:ring-1 focus:ring-[#0073bb]"
    />
  );
}

/* ─── Props ──────────────────────────────────────────────────────────────── */
type Props = {
  initialProduct: Product;
  isNew: boolean;
};

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function ProductEditor({ initialProduct, isNew }: Props) {
  const router = useRouter();
  const [product, setProduct] = useState<Product>(initialProduct);

  const syncVariants = useCallback(
    (attrs: ProductAttribute[], current: ProductVariant[]): ProductVariant[] =>
      mergeVariants(current, generateVariantCombinations(attrs)),
    [],
  );

  /* ── Name ────────────────────────────────────────────────────────────── */
  const handleNameChange = (name: string) =>
    setProduct((p) => ({ ...p, name }));

  /* ── Attributes ─────────────────────────────────────────────────────── */
  const handleAddAttribute = () => {
    setProduct((p) => {
      const newAttr: ProductAttribute = {
        id: crypto.randomUUID(),
        name: "",
        options: [],
      };
      return { ...p, attributes: [...p.attributes, newAttr] };
    });
  };

  const handleAttributeNameChange = (attrId: string, name: string) =>
    setProduct((p) => ({
      ...p,
      attributes: p.attributes.map((a) =>
        a.id === attrId ? { ...a, name } : a,
      ),
    }));

  const handleAddOption = (attrId: string, label: string) => {
    setProduct((p) => {
      const newAttrs = p.attributes.map((a) =>
        a.id === attrId
          ? {
              ...a,
              options: [...a.options, { id: crypto.randomUUID(), label }],
            }
          : a,
      );
      return {
        ...p,
        attributes: newAttrs,
        variants: syncVariants(newAttrs, p.variants),
      };
    });
  };

  const handleRemoveOption = (attrId: string, optionId: string) => {
    setProduct((p) => {
      const newAttrs = p.attributes.map((a) =>
        a.id === attrId
          ? { ...a, options: a.options.filter((o) => o.id !== optionId) }
          : a,
      );
      return {
        ...p,
        attributes: newAttrs,
        variants: syncVariants(newAttrs, p.variants),
      };
    });
  };

  const handleRemoveAttribute = (attrId: string) => {
    setProduct((p) => {
      const newAttrs = p.attributes.filter((a) => a.id !== attrId);
      return {
        ...p,
        attributes: newAttrs,
        variants: syncVariants(newAttrs, p.variants),
      };
    });
  };

  /* ── Variants ────────────────────────────────────────────────────────── */
  const handleVariantsChange = useCallback(
    (variants: ProductVariant[]) => setProduct((p) => ({ ...p, variants })),
    [],
  );

  /* ── Save / Cancel ───────────────────────────────────────────────────── */
  const handleSave = async () => {
    const trimmed = product.name.trim();
    if (!trimmed) {
      alert("نام محصول را وارد کنید.");
      return;
    }
    await saveProduct({ ...product, name: trimmed });
    router.push("/products/manage");
  };

  const handleCancel = () => router.push("/products/manage");

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="mx-auto w-full max-w-5xl p-6 flex flex-col gap-5">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d5dbdb] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#16191f]">
            {isNew ? "محصول جدید" : "ویرایش محصول"}
          </h1>
          <p className="mt-0.5 text-sm text-[#545b64]">
            ویژگی‌ها را تعریف کنید — ترکیب‌ها به‌صورت خودکار ساخته می‌شوند.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="rounded border border-[#aab7b8] bg-white px-4 py-2 text-sm font-medium text-[#16191f] hover:bg-[#f2f3f3] transition"
          >
            انصراف
          </button>
          <button
            onClick={() => void handleSave()}
            className="rounded bg-[#ec7211] px-5 py-2 text-sm font-medium text-white hover:bg-[#eb5f07] transition"
          >
            ذخیره محصول
          </button>
        </div>
      </div>

      {/* ── Product name ─────────────────────────────────────────────────── */}
      <section className="rounded border border-[#d5dbdb] bg-white shadow-sm">
        <div className="border-b border-[#d5dbdb] bg-[#f2f3f3] px-5 py-3">
          <h2 className="text-sm font-semibold text-[#16191f]">نام محصول</h2>
        </div>
        <div className="p-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#545b64]">نام</span>
            <input
              value={product.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="مثلاً: تی‌شرت پنبه‌ای"
              className="w-full rounded border border-[#aab7b8] bg-white px-3 py-2 text-sm text-[#16191f] placeholder:text-[#879596] outline-none focus:border-[#0073bb] focus:ring-1 focus:ring-[#0073bb]"
            />
          </label>
        </div>
      </section>

      {/* ── Attribute builder ────────────────────────────────────────────── */}
      <section className="rounded border border-[#d5dbdb] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#d5dbdb] bg-[#f2f3f3] px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[#16191f]">ویژگی‌ها</h2>
            <p className="mt-0.5 text-xs text-[#545b64]">
              هر ویژگی (مثلاً رنگ یا سایز) گزینه‌هایی دارد که ترکیب‌ها را
              می‌سازند.
            </p>
          </div>
          <button
            onClick={handleAddAttribute}
            className="shrink-0 rounded border border-[#0073bb] bg-white px-3 py-1.5 text-sm font-medium text-[#0073bb] hover:bg-[#e7f2f8] transition"
          >
            + افزودن ویژگی
          </button>
        </div>

        <div className="p-5">
          {product.attributes.length === 0 ? (
            <p className="rounded border border-dashed border-[#aab7b8] py-6 text-center text-sm text-[#879596]">
              ویژگی‌ای تعریف نشده — محصول ساده با یک ترکیب
            </p>
          ) : (
            <div className="space-y-3">
              {product.attributes.map((attr) => (
                <div
                  key={attr.id}
                  className="flex flex-wrap items-center gap-3 rounded border border-[#d5dbdb] bg-[#f2f3f3] p-3"
                >
                  {/* Attribute name */}
                  <input
                    value={attr.name}
                    onChange={(e) =>
                      handleAttributeNameChange(attr.id, e.target.value)
                    }
                    placeholder="نام ویژگی"
                    className="w-28 shrink-0 rounded border border-[#aab7b8] bg-white px-2 py-1.5 text-sm text-[#16191f] placeholder:text-[#879596] outline-none focus:border-[#0073bb] focus:ring-1 focus:ring-[#0073bb]"
                  />

                  <span className="text-[#aab7b8] select-none">:</span>

                  {/* Option tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {attr.options.map((opt) => (
                      <span
                        key={opt.id}
                        className="flex items-center gap-1 rounded border border-[#0073bb] bg-[#e7f2f8] px-2.5 py-1 text-xs font-medium text-[#0073bb]"
                      >
                        {opt.label}
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(attr.id, opt.id)}
                          className="leading-none text-[#0073bb] opacity-60 hover:opacity-100"
                          aria-label="حذف گزینه"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <AddOptionInput
                      onAdd={(label) => handleAddOption(attr.id, label)}
                    />
                  </div>

                  {/* Remove attribute */}
                  <button
                    type="button"
                    onClick={() => handleRemoveAttribute(attr.id)}
                    className="mr-auto rounded border border-[#d13212] bg-white px-2.5 py-1 text-xs font-medium text-[#d13212] hover:bg-[#fdf3f1] transition"
                  >
                    حذف ویژگی
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Variants grid ────────────────────────────────────────────────── */}
      <section className="rounded border border-[#d5dbdb] bg-white shadow-sm">
        <div className="border-b border-[#d5dbdb] bg-[#f2f3f3] px-5 py-3">
          <h2 className="text-sm font-semibold text-[#16191f]">
            ترکیب‌های محصول
          </h2>
          <p className="mt-0.5 text-xs text-[#545b64]">
            قیمت، کد و موجودی هر ترکیب را مستقیم در جدول ویرایش کنید.
          </p>
        </div>
        <div className="p-5">
          <VariantsGrid
            variants={product.variants}
            attributes={product.attributes}
            onChange={handleVariantsChange}
          />
        </div>
      </section>
    </div>
  );
}
