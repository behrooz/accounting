"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getProducts, type Product, productPriceRange } from "@/lib/products";

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1520975919572-9aebc6a48b6b?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=4c1b8f9b1b7d6b0b1f2a9d6e2c8f7f4a";

function getProductImages(p: Product): string[] {
  const gallery = (p.images ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  if (gallery.length) return Array.from(new Set(gallery));
  const imgs = p.variants
    .map((v) => v.image)
    .filter((s): s is string => Boolean(s))
    .map((s) => s!.trim())
    .filter(Boolean);
  return Array.from(new Set(imgs));
}

export default function ShopSearchPage() {
  const searchParams = useSearchParams();
  const q = searchParams?.get("q") ?? "";
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const ps = await getProducts();
      if (!mounted) return;
      setProducts(ps);
      setLoading(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const term = q.trim().toLowerCase();
    // compute results synchronously
    const results = !term
      ? products
      : products.filter((p) => {
          if (p.name.toLowerCase().includes(term)) return true;
          if (p.variants.some((v) => v.sku.toLowerCase().includes(term)))
            return true;
          if (p.attributes.some((a) => a.name.toLowerCase().includes(term)))
            return true;
          for (const v of p.variants) {
            if (
              Object.values(v.attributeValues).some((val) =>
                val.toLowerCase().includes(term),
              )
            )
              return true;
          }
          return false;
        });
    // apply state update asynchronously to avoid cascading renders
    setTimeout(() => setFiltered(results), 0);
  }, [q, products]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#16191f]">نتایج جستجو</h1>
        <p className="mt-1 text-sm text-[#545b64]">عبارت: «{q}»</p>
      </div>

      {loading ? (
        <div className="rounded border border-dashed border-[#aab7b8] bg-white p-12 text-center text-[#545b64]">
          در حال بارگذاری...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded border border-dashed border-[#aab7b8] bg-white p-12 text-center text-[#545b64]">
          هیچ نتیجه‌ای یافت نشد.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => {
            const images = getProductImages(product);
            const thumb = images[0] ?? PLACEHOLDER;
            return (
              <article
                key={product.id}
                className="group relative flex flex-col overflow-hidden rounded-lg border bg-white shadow-md transition-shadow hover:shadow-xl"
              >
                <Link href={`/shop/product/${product.id}`} className="block">
                  <div className="relative h-44 w-full bg-[#f6f7f8]">
                    <img
                      src={thumb}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                </Link>
                <div className="p-4 flex flex-1 flex-col">
                  <h2 className="text-base font-semibold text-[#16191f]">
                    {product.name}
                  </h2>
                  <p className="mt-2 text-sm text-[#545b64]">
                    قیمت:{" "}
                    <span className="font-semibold text-[#16191f]">
                      {productPriceRange(product)}
                    </span>
                  </p>
                  <Link
                    href={`/shop/product/${product.id}`}
                    className="mt-4 inline-flex w-full items-center justify-center rounded bg-[#0073bb] py-2 text-sm font-medium text-white hover:bg-[#006499] transition"
                  >
                    مشاهده
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
