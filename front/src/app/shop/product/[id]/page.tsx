"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getProductById,
  productMinPrice,
  productMaxPrice,
  type Product,
} from "@/lib/products";

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1520975919572-9aebc6a48b6b?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=4c1b8f9b1b7d6b0b1f2a9d6e2c8f7f4a";

export default function ProductDetailPage() {
  const params = useParams() as { id?: string };
  const id = params?.id;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  // Slider state
  const [index, setIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      if (!id) return;
      try {
        const p = await getProductById(id);
        if (mounted) setProduct(p ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    // reset slider index when product changes
    setIndex(0);
  }, [product?.id]);

  if (loading)
    return (
      <div className="rounded border border-dashed border-[#aab7b8] bg-white p-12 text-center text-[#545b64]">
        در حال بارگذاری...
      </div>
    );
  if (!product)
    return (
      <div className="rounded border border-dashed border-[#aab7b8] bg-white p-12 text-center text-[#545b64]">
        محصول پیدا نشد.
      </div>
    );

  const images = Array.from(
    new Set(
      product.variants
        .map((v) => v.image)
        .filter((s): s is string => Boolean(s))
        .map((s) => s!.trim()),
    ),
  );
  const slides = images.length ? images : [PLACEHOLDER];

  const next = () => setIndex((i) => (i + 1) % slides.length);
  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length);

  function onTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) {
      if (dx < 0) next();
      else prev();
    }
    setTouchStartX(null);
  }

  const totalStock = product.variants.reduce((s, v) => s + v.quantity, 0);

  return (
    <div className="rounded border border-[#d5dbdb] bg-white p-6 shadow-sm">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Slider */}
        <div>
          <div
            className="relative w-full overflow-hidden rounded bg-[#f6f7f8]"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {slides.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`${product.name} ${i + 1}`}
                className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
                  i === index ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                style={{ height: 480 }}
              />
            ))}

            {/* Controls */}
            {slides.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                  aria-label="قبلی"
                >
                  ‹
                </button>
                <button
                  onClick={next}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                  aria-label="بعدی"
                >
                  ›
                </button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          <div className="mt-3 flex gap-2 overflow-auto">
            {slides.map((src, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded border transition-shadow ${
                  i === index ? "ring-2 ring-[#0073bb]" : "border-[#e6e6e6]"
                }`}
              >
                <img
                  src={src}
                  alt={`${product.name} thumb ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-[#16191f]">{product.name}</h1>

          <p className="mt-2 text-sm text-[#545b64]">
            قیمت:{" "}
            <span className="font-semibold text-[#16191f]">
              {productMinPrice(product).toLocaleString("fa-IR")} –{" "}
              {productMaxPrice(product).toLocaleString("fa-IR")} تومان
            </span>
          </p>

          <p className="mt-2 text-sm text-[#545b64]">
            موجودی کل:{" "}
            <span className="font-semibold text-[#16191f]">{totalStock}</span>
          </p>

          {product.attributes.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-[#545b64]">ویژگی‌ها:</p>
              <ul className="mt-2 space-y-2 text-sm">
                {product.attributes.map((attr) => (
                  <li key={attr.id}>
                    <span className="font-medium text-[#16191f]">
                      {attr.name}
                    </span>
                    :{" "}
                    <span className="text-[#545b64]">
                      {attr.options.map((o) => o.label).join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <p className="text-sm text-[#545b64]">ترکیبات:</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {product.variants.map((v) => {
                const label =
                  Object.values(v.attributeValues).join(" / ") || "پیش‌فرض";
                return (
                  <div
                    key={v.id}
                    className="rounded border border-[#d5dbdb] p-3"
                  >
                    <div className="text-sm text-[#16191f] font-medium">
                      {label}
                    </div>
                    <div className="mt-1 text-sm text-[#545b64]">
                      قیمت:{" "}
                      <span className="font-semibold text-[#16191f]">
                        {v.salePrice.toLocaleString("fa-IR")} تومان
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-[#545b64]">
                      موجودی:{" "}
                      <span className="font-semibold text-[#16191f]">
                        {v.quantity}
                      </span>
                    </div>
                    <button className="mt-3 w-full rounded bg-[#ec7211] px-3 py-2 text-sm font-medium text-white">
                      افزودن به سبد
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <Link
              href="/shop"
              className="text-sm text-[#0073bb] hover:underline"
            >
              بازگشت به فروشگاه
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
