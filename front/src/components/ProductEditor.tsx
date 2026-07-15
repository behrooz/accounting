"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateVariantCombinations,
  mergeVariants,
  saveProduct,
  type Product,
  type ProductAttribute,
  type ProductVariant,
} from "@/lib/products";
import {
  getCategories,
  type ProductCategory,
} from "@/lib/categories";
import {
  compressImageFile,
  mediaUrl,
  uploadProductImage,
} from "@/lib/media";
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
  const [product, setProduct] = useState<Product>({
    ...initialProduct,
    images: initialProduct.images ?? [],
  });
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getCategories().then(setCategories);
  }, []);

  const syncVariants = useCallback(
    (attrs: ProductAttribute[], current: ProductVariant[]): ProductVariant[] =>
      mergeVariants(current, generateVariantCombinations(attrs)),
    [],
  );

  const handleNameChange = (name: string) =>
    setProduct((p) => ({ ...p, name }));

  const handleCategoryChange = (categoryId: string) =>
    setProduct((p) => ({
      ...p,
      categoryId: categoryId || null,
    }));

  const handleBulkImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingImages(true);
    try {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      const paths: string[] = [];
      for (const file of list) {
        const compressed = await compressImageFile(file, 1280);
        const uploaded = await uploadProductImage(compressed);
        paths.push(uploaded.path);
      }
      setProduct((p) => ({
        ...p,
        images: [...(p.images ?? []), ...paths],
      }));
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "آپلود یک یا چند تصویر ناموفق بود.",
      );
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = (index: number) =>
    setProduct((p) => ({
      ...p,
      images: (p.images ?? []).filter((_, i) => i !== index),
    }));

  const handleMoveImage = (index: number, dir: -1 | 1) =>
    setProduct((p) => {
      const nextImages = [...(p.images ?? [])];
      const next = index + dir;
      if (next < 0 || next >= nextImages.length) return p;
      const tmp = nextImages[index]!;
      nextImages[index] = nextImages[next]!;
      nextImages[next] = tmp;
      return { ...p, images: nextImages };
    });

  const handleAddAttribute = () => {
    setProduct((p) => {
      const newAttr: ProductAttribute = {
        id: crypto.randomUUID(),
        name: "",
        allowImage: false,
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

  const handleAttributeAllowImageChange = (
    attrId: string,
    allowImage: boolean,
  ) =>
    setProduct((p) => ({
      ...p,
      attributes: p.attributes.map((a) =>
        a.id === attrId ? { ...a, allowImage } : a,
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

  const handleVariantsChange = useCallback(
    (variants: ProductVariant[]) => setProduct((p) => ({ ...p, variants })),
    [],
  );

  const handleSave = async () => {
    const trimmed = product.name.trim();
    if (!trimmed) {
      alert("نام محصول را وارد کنید.");
      return;
    }
    const allowVariantImages = product.attributes.some((a) => a.allowImage);
    await saveProduct({
      ...product,
      name: trimmed,
      categoryId: product.categoryId || null,
      images: product.images ?? [],
      attributes: product.attributes.map((a) => ({
        ...a,
        allowImage: !!a.allowImage,
      })),
      variants: allowVariantImages
        ? product.variants
        : product.variants.map((v) => {
            const { image: _image, ...rest } = v;
            return rest;
          }),
    });
    router.push("/products/manage");
  };

  const handleCancel = () => router.push("/products/manage");
  const images = product.images ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl p-6 flex flex-col gap-5">
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

      <section className="rounded border border-[#d5dbdb] bg-white shadow-sm">
        <div className="border-b border-[#d5dbdb] bg-[#f2f3f3] px-5 py-3">
          <h2 className="text-sm font-semibold text-[#16191f]">
            اطلاعات محصول
          </h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#545b64]">نام</span>
            <input
              value={product.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="مثلاً: تی‌شرت پنبه‌ای"
              className="w-full rounded border border-[#aab7b8] bg-white px-3 py-2 text-sm text-[#16191f] placeholder:text-[#879596] outline-none focus:border-[#0073bb] focus:ring-1 focus:ring-[#0073bb]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#545b64]">دسته‌بندی</span>
            <select
              value={product.categoryId ?? ""}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full rounded border border-[#aab7b8] bg-white px-3 py-2 text-sm text-[#16191f] outline-none focus:border-[#0073bb] focus:ring-1 focus:ring-[#0073bb]"
            >
              <option value="">— بدون دسته —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded border border-[#d5dbdb] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d5dbdb] bg-[#f2f3f3] px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[#16191f]">
              تصاویر محصول
            </h2>
            <p className="mt-0.5 text-xs text-[#545b64]">
              چند تصویر را یکجا انتخاب کنید — مربوط به کل محصول است، نه ویژگی.
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void handleBulkImages(e.target.files)}
            />
            <button
              type="button"
              disabled={uploadingImages}
              onClick={() => fileInputRef.current?.click()}
              className="rounded border border-[#0073bb] bg-white px-3 py-1.5 text-sm font-medium text-[#0073bb] hover:bg-[#e7f2f8] transition disabled:opacity-50"
            >
              {uploadingImages ? "در حال آپلود…" : "+ آپلود گروهی تصاویر"}
            </button>
          </div>
        </div>
        <div className="p-5">
          {images.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded border border-dashed border-[#aab7b8] bg-[#f8f9f9] py-10 text-sm text-[#879596] hover:border-[#0073bb] hover:text-[#0073bb] transition"
            >
              <span className="text-2xl leading-none">📷</span>
              <span>برای انتخاب چند تصویر کلیک کنید</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((src, index) => (
                <div
                  key={`${index}-${src.slice(0, 64)}`}
                  className="group relative overflow-hidden rounded border border-[#d5dbdb] bg-[#f2f3f3]"
                >
                  <img
                    src={mediaUrl(src)}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/55 p-1.5 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveImage(index, -1)}
                      className="rounded bg-white/90 px-2 py-0.5 text-xs disabled:opacity-40"
                      title="جابه‌جایی به قبل"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="rounded bg-[#d13212] px-2 py-0.5 text-xs text-white"
                    >
                      حذف
                    </button>
                    <button
                      type="button"
                      disabled={index === images.length - 1}
                      onClick={() => handleMoveImage(index, 1)}
                      className="rounded bg-white/90 px-2 py-0.5 text-xs disabled:opacity-40"
                      title="جابه‌جایی به بعد"
                    >
                      →
                    </button>
                  </div>
                  {index === 0 && (
                    <span className="absolute left-1.5 top-1.5 rounded bg-[#0073bb] px-1.5 py-0.5 text-[10px] font-medium text-white">
                      اصلی
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded border border-[#d5dbdb] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#d5dbdb] bg-[#f2f3f3] px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[#16191f]">ویژگی‌ها</h2>
            <p className="mt-0.5 text-xs text-[#545b64]">
              هر ویژگی (مثلاً رنگ یا سایز) گزینه‌هایی دارد که ترکیب‌ها را
              می‌سازند. برای ویژگی‌هایی مثل رنگ، «آپلود تصویر» را روشن کنید.
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
                  <input
                    value={attr.name}
                    onChange={(e) =>
                      handleAttributeNameChange(attr.id, e.target.value)
                    }
                    placeholder="نام ویژگی"
                    className="w-28 shrink-0 rounded border border-[#aab7b8] bg-white px-2 py-1.5 text-sm text-[#16191f] placeholder:text-[#879596] outline-none focus:border-[#0073bb] focus:ring-1 focus:ring-[#0073bb]"
                  />

                  <span className="text-[#aab7b8] select-none">:</span>

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

                  <label
                    className="flex shrink-0 cursor-pointer items-center gap-2 rounded border border-[#d5dbdb] bg-white px-2.5 py-1.5 text-xs text-[#545b64]"
                    title="وقتی روشن باشد، می‌توانید برای ترکیب‌های این ویژگی تصویر بگذارید"
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={!!attr.allowImage}
                      onChange={(e) =>
                        handleAttributeAllowImageChange(
                          attr.id,
                          e.target.checked,
                        )
                      }
                    />
                    <span
                      aria-hidden
                      className={`relative h-5 w-9 rounded-full transition ${
                        attr.allowImage ? "bg-[#0073bb]" : "bg-[#aab7b8]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                          attr.allowImage ? "right-0.5" : "left-0.5"
                        }`}
                      />
                    </span>
                    <span>آپلود تصویر</span>
                  </label>

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

      <section className="rounded border border-[#d5dbdb] bg-white shadow-sm">
        <div className="border-b border-[#d5dbdb] bg-[#f2f3f3] px-5 py-3">
          <h2 className="text-sm font-semibold text-[#16191f]">
            ترکیب‌های محصول
          </h2>
          <p className="mt-0.5 text-xs text-[#545b64]">
            قیمت، کد و موجودی هر ترکیب را مستقیم در جدول ویرایش کنید.
            {product.attributes.some((a) => a.allowImage)
              ? " ستون تصویر وقتی حداقل یک ویژگی «آپلود تصویر» داشته باشد نمایش داده می‌شود."
              : ""}
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
