"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getInvoiceById, type Invoice } from "@/lib/invoices";
import InvoiceEditor from "@/components/InvoiceEditor";

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params?.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [notFound, setNotFound] = useState(false);

  const printMode =
    searchParams?.get("label") === "1"
      ? "label"
      : searchParams?.get("print") === "1"
        ? "invoice"
        : null;

  useEffect(() => {
    const load = async () => {
      const found = await getInvoiceById(id);
      if (found) {
        setInvoice(found);
      } else {
        setNotFound(true);
      }
    };
    void load();
  }, [id]);

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <p className="text-[#545b64]">فاکتور یافت نشد.</p>
          <button onClick={() => router.push("/sales")}
            className="mt-4 rounded bg-[#0073bb] px-4 py-2 text-sm font-medium text-white hover:bg-[#006499] transition">
            بازگشت به فاکتورها
          </button>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse text-sm text-[#879596]">در حال بارگذاری…</p>
      </div>
    );
  }

  return (
    <InvoiceEditor
      initialInvoice={invoice}
      isNew={false}
      initialPrintMode={printMode}
    />
  );
}
