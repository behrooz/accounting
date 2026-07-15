"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getProducts,
  productPriceRange,
  productTotalStock,
  type Product,
} from "@/lib/products";
import { mediaUrl } from "@/lib/media";

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1520975919572-9aebc6a48b6b?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=4c1b8f9b1b7d6b0b1f2a9d6e2c8f7f4a";

function getProductImages(p: Product): string[] {
  const gallery = (p.images ?? [])
    .map((s) => mediaUrl(s))
    .filter(Boolean);
  if (gallery.length) return Array.from(new Set(gallery));
  const imgs = p.variants
    .map((v) => mediaUrl(v.image))
    .filter(Boolean);
  return Array.from(new Set(imgs));
}

export default function ShopHomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const ps = await getProducts();
        if (mounted) setProducts(ps);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16191f]">
            فروشگاه — پوشاک و طراحی
          </h1>
          <p className="mt-1 text-sm text-[#545b64]">
            آخرین مجموعه‌ها و محصولات طراحی‌شده
          </p>
        </div>
        <p className="text-sm text-[#545b64]">{products.length} محصول</p>
      </div>

      {loading ? (
        <div className="rounded border border-dashed border-[#aab7b8] bg-white p-12 text-center text-[#545b64]">
          در حال بارگذاری...
        </div>
      ) : products.length === 0 ? (
        <div className="rounded border border-dashed border-[#aab7b8] bg-white p-12 text-center text-[#545b64]">
          هیچ محصولی برای نمایش وجود ندارد.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const images = getProductImages(product);
            const thumb = images[0] ?? PLACEHOLDER;
            const priceRange = productPriceRange(product);
            const stock = productTotalStock(product);
            const attrNames = product.attributes.map((a) => a.name).join("، ");

            const onSale = product.variants.some(
              (v) => v.salePrice && v.salePrice < v.price,
            );

            return (
              <article
                key={product.id}
                className="group relative flex flex-col overflow-hidden rounded-lg border bg-white shadow-md transition-shadow hover:shadow-xl"
              >
                <Link href={`/shop/product/${product.id}`} className="block">
                  <div className="relative h-56 w-full bg-[#f6f7f8]">
                    <img
                      src={thumb}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {onSale && (
                      <span className="absolute left-2 top-2 rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white">
                        تخفیف
                      </span>
                    )}
                  </div>
                </Link>

                <div className="p-4 flex flex-1 flex-col">
                  <div className="flex items-start justify-between">
                    <h2 className="text-base font-semibold text-[#16191f]">
                      {product.name}
                    </h2>
                    <div className="text-right text-xs text-[#879596]">
                      {attrNames || "محصول ساده"}
                    </div>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-sm text-[#545b64]">قیمت</div>
                      <div className="text-lg font-semibold text-[#16191f]">
                        {priceRange}{" "}
                        <span className="text-sm font-normal text-[#879596]">
                          تومان
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-[#545b64]">
                      موجودی:{" "}
                      <span className="font-semibold text-[#16191f]">
                        {stock}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <Link
                      href={`/shop/product/${product.id}`}
                      className="inline-flex flex-1 items-center justify-center rounded bg-[#0073bb] px-3 py-2 text-sm font-medium text-white hover:bg-[#006499] transition"
                    >
                      مشاهده
                    </Link>
                    <button className="inline-flex items-center justify-center rounded border border-[#d5dbdb] bg-white px-3 py-2 text-sm text-[#16191f] hover:bg-[#f6f7f8] transition">
                      افزودن
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
