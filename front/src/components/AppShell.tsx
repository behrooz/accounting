"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getSessionUser } from "@/lib/auth";

type Props = {
  children: ReactNode;
};

const PUBLIC_ROUTE_PREFIXES = ["/login", "/shop"];

function isPrintRoute(pathname: string) {
  return /\/sales\/[^/]+\/print\/?$/.test(pathname);
}

export default function AppShell({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const p = pathname ?? "/";
    const isPublic = PUBLIC_ROUTE_PREFIXES.some((prefix) =>
      p.startsWith(prefix),
    );
    const session = getSessionUser();

    if (!session && !isPublic) {
      router.replace("/login");
      return;
    }

    if (session && p === "/login") {
      router.replace("/dashboard");
      return;
    }

    // schedule ready state asynchronously to avoid synchronous setState within the effect
    setTimeout(() => setReady(true), 0);
  }, [pathname, router]);

  const p = pathname ?? "/";
  const isPublic = PUBLIC_ROUTE_PREFIXES.some((prefix) => p.startsWith(prefix));
  const isPrint = isPrintRoute(p);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[#545b64]">
        در حال بارگذاری...
      </div>
    );
  }

  if (isPublic || isPrint) {
    return (
      <main className="flex min-h-screen flex-1 flex-col overflow-auto">
        {children}
      </main>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="flex min-h-screen flex-1 flex-col overflow-auto">
        {children}
      </main>
    </>
  );
}
