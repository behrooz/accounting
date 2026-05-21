"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import React from "react";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const [q, setQ] = useState("");
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const path = q.trim() ? `/shop/search?q=${encodeURIComponent(q.trim())}` : "/shop";
    router.push(path);
  };

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/shop" className="text-xl font-bold text-[#16191f]">فروشگاه</Link>
          <p className="text-sm text-[#545b64]">خرید آنلاین محصولات</p>
        </div>
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در فروشگاه..." className="rounded border border-[#d5dbdb] px-3 py-2 text-sm" />
          <button type="submit" className="rounded bg-[#ec7211] px-4 py-2 text-sm font-medium text-white">جستجو</button>
        </form>
      </header>
      <div>{children}</div>
    </div>
  );
}
