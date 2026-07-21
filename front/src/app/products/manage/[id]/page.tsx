"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getProductById, type Product } from "@/lib/products";
import ProductEditor from "@/components/ProductEditor";

function makeEmptyProduct(): Product {
  return {
    id: crypto.randomUUID(),
    name: "",
    categoryId: null,
    publishedOnWeb: false,
    images: [],
    attributes: [],
    variants: [
      {
        id: crypto.randomUUID(),
        sku: "",
        price: 0,
        salePrice: 0,
        quantity: 0,
        attributeValues: {},
      },
    ],
  };
}

export default function ProductEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params?.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (id === "new") {
        if (searchParams?.get("copy") === "1" && typeof window !== "undefined") {
          const raw = sessionStorage.getItem("accounting-product-copy");
          if (raw) {
            try {
              setProduct(JSON.parse(raw) as Product);
              sessionStorage.removeItem("accounting-product-copy");
              return;
            } catch {
              sessionStorage.removeItem("accounting-product-copy");
            }
          }
        }
        setProduct(makeEmptyProduct());
        return;
      }
      const found = await getProductById(id);
      if (found) {
        setProduct(found);
      } else {
        setNotFound(true);
      }
    };
    void load();
  }, [id, searchParams]);

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <p className="text-slate-500">محصول مورد نظر یافت نشد.</p>
          <button
            onClick={() => router.push("/products/manage")}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            بازگشت به لیست
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-slate-400 animate-pulse">در حال بارگذاری…</p>
      </div>
    );
  }

  return <ProductEditor initialProduct={product} isNew={id === "new"} />;
}
