"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth";

/* ─── Nav structure ──────────────────────────────────────────────────────── */
const NAV = [
  {
    section: "اصلی",
    items: [
      { label: "داشبورد", href: "/dashboard" },
      { label: "فروشگاه", href: "/shop" },
      { label: "مدیریت محصولات", href: "/products/manage" },
      { label: "کاربران", href: "/users" },
      { label: "سود و زیان", href: "/profit-loss" },
    ],
  },
  {
    section: "فروش",
    items: [
      { label: "فاکتورها", href: "/sales" },
      { label: "مشتریان", href: "/customers" },
    ],
  },
];

/* ─── Active-state helper ────────────────────────────────────────────────── */
function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-[#232f3e] text-white min-h-screen print:hidden">
      {/* Brand */}
      <div className="border-b border-[#1a2535] px-5 py-4">
        <p className="text-base font-bold text-white">حسابداری</p>
        <p className="mt-0.5 text-xs text-[#8d9099]">سیستم مدیریت</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((group) => (
          <div key={group.section} className="mb-2">
            <p className="px-5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-[#687078]">
              {group.section}
            </p>
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex items-center px-5 py-2.5 text-sm transition-colors",
                    active
                      ? "border-l-2 border-[#ec7211] bg-[#1a2535] text-white"
                      : "border-l-2 border-transparent text-[#cdd3d8] hover:bg-[#1a2535] hover:text-white",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-[#1a2535] px-5 py-3">
        <button
          type="button"
          onClick={() => {
            logout();
            window.location.href = "/login";
          }}
          className="w-full rounded border border-[#687078] px-3 py-1.5 text-xs text-[#cdd3d8] hover:bg-[#1a2535] hover:text-white"
        >
          خروج از حساب
        </button>
        <p className="mt-2 text-xs text-[#687078]">نسخه ۱.۰</p>
      </div>
    </aside>
  );
}
