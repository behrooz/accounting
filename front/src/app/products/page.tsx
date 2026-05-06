"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getProducts,
  productPriceRange,
  productTotalStock,
  type Product,
} from "@/lib/products";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  const load = async () => setProducts(await getProducts());
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#16191f]">لیست محصولات</h1>
          <p className="mt-1 text-sm text-[#545b64]">نمایش کارتی همه محصولات</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void load()}
            className="rounded border border-[#aab7b8] bg-white px-4 py-2 text-sm font-medium text-[#16191f] hover:bg-[#f2f3f3] transition"
          >
            بروزرسانی
          </button>
          <Link
            href="/products/manage"
            className="rounded bg-[#0073bb] px-4 py-2 text-sm font-medium text-white hover:bg-[#006499] transition"
          >
            مدیریت محصولات
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {products.length === 0 ? (
        <div className="rounded border border-dashed border-[#aab7b8] bg-white p-12 text-center text-[#545b64]">
          <p className="text-lg">هیچ محصولی ثبت نشده است.</p>
          <Link
            href="/products/manage/new"
            className="mt-4 inline-block rounded bg-[#ec7211] px-4 py-2 text-sm font-medium text-white hover:bg-[#eb5f07] transition"
          >
            + افزودن محصول
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const priceRange = productPriceRange(product);
            const stock = productTotalStock(product);
            const variantCount = product.variants.length;
            const attrNames = product.attributes.map((a) => a.name).join("، ");

            return (
              <article
                key={product.id}
                className="flex flex-col rounded border border-[#d5dbdb] bg-white p-5 shadow-sm hover:shadow-md transition"
              >
                {/* Name */}
                <h2 className="text-base font-semibold text-[#16191f]">
                  {product.name}
                </h2>

                {/* Attributes badge */}
                {attrNames ? (
                  <p className="mt-1 text-xs text-[#545b64]">{attrNames}</p>
                ) : (
                  <p className="mt-1 text-xs text-[#879596]">محصول ساده</p>
                )}

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[#545b64]">قیمت</span>
                    <span className="font-semibold text-[#16191f]">
                      {priceRange}{" "}
                      <span className="font-normal text-[#879596]">تومان</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#545b64]">موجودی کل</span>
                    <span className="font-semibold text-[#16191f]">
                      {stock.toLocaleString("fa-IR")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#545b64]">تعداد ترکیب</span>
                    <span className="font-semibold text-[#16191f]">
                      {variantCount.toLocaleString("fa-IR")}
                    </span>
                  </div>
                </div>

                {/* Variant chips (show first 4) */}
                {product.attributes.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1">
                    {product.variants.slice(0, 4).map((v) => {
                      const label = Object.values(v.attributeValues).join(
                        " / ",
                      );
                      return (
                        <span
                          key={v.id}
                          className="rounded border border-[#d5dbdb] bg-[#f2f3f3] px-2 py-0.5 text-xs text-[#545b64]"
                        >
                          {label}
                        </span>
                      );
                    })}
                    {variantCount > 4 && (
                      <span className="rounded border border-[#d5dbdb] bg-[#f2f3f3] px-2 py-0.5 text-xs text-[#879596]">
                        +{variantCount - 4} بیشتر
                      </span>
                    )}
                  </div>
                )}

                {/* Edit link */}
                <Link
                  href={`/products/manage/${product.id}`}
                  className="mt-5 block rounded border border-[#0073bb] py-2 text-center text-sm font-medium text-[#0073bb] hover:bg-[#e7f2f8] transition"
                >
                  ویرایش
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
