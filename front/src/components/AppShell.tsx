"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getSessionUser } from "@/lib/auth";

type Props = {
  children: ReactNode;
};

const PUBLIC_ROUTES = ["/login"];

export default function AppShell({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const isPublic = PUBLIC_ROUTES.includes(pathname);
    const session = getSessionUser();

    if (!session && !isPublic) {
      router.replace("/login");
      return;
    }

    if (session && pathname === "/login") {
      router.replace("/dashboard");
      return;
    }

    setReady(true);
  }, [pathname, router]);

  const isPublic = PUBLIC_ROUTES.includes(pathname);

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-[#545b64]">در حال بارگذاری...</div>;
  }

  if (isPublic) {
    return <main className="flex min-h-screen flex-1 flex-col overflow-auto">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <main className="flex min-h-screen flex-1 flex-col overflow-auto">{children}</main>
    </>
  );
}
