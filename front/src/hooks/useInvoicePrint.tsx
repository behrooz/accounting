"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getInvoiceById, type Invoice } from "@/lib/invoices";
import { getShopSettings, type ShopSettings } from "@/lib/shop";
import {
  InvoiceLabelPrintContent,
  InvoicePrintContent,
} from "@/components/InvoicePrintContent";

export type InvoicePrintMode = "invoice" | "label";

type PrintJob = {
  invoice: Invoice;
  shop: ShopSettings;
  mode: InvoicePrintMode;
};

type StartPrintOptions =
  | { invoice: Invoice; mode: InvoicePrintMode }
  | { invoiceId: string; mode: InvoicePrintMode };

function hasRecipientInfo(invoice: Invoice) {
  return !!(
    invoice.customerName?.trim() ||
    invoice.customerPhone?.trim() ||
    invoice.customerAddress?.trim()
  );
}

export function useInvoicePrint() {
  const [job, setJob] = useState<PrintJob | null>(null);

  const startPrint = useCallback(async (opts: StartPrintOptions) => {
    const shop = await getShopSettings();
    const invoice =
      "invoice" in opts ? opts.invoice : await getInvoiceById(opts.invoiceId);

    if (!invoice) {
      alert("فاکتور یافت نشد.");
      return;
    }

    if (opts.mode === "label" && !hasRecipientInfo(invoice)) {
      alert("اطلاعات مشتری / آدرس سفارش برای برچسب بسته ناقص است.");
      return;
    }

    setJob({ invoice, shop, mode: opts.mode });
  }, []);

  useEffect(() => {
    if (!job) return;

    const timer = window.setTimeout(() => window.print(), 150);
    const done = () => setJob(null);

    window.addEventListener("afterprint", done);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", done);
    };
  }, [job]);

  const printPortal =
    job && typeof document !== "undefined"
      ? createPortal(
          <div id="invoice-print-root" className="invoice-print-root bg-white text-[#16191f]">
            {job.mode === "label" ? (
              <InvoiceLabelPrintContent invoice={job.invoice} shop={job.shop} />
            ) : (
              <InvoicePrintContent invoice={job.invoice} />
            )}
          </div>,
          document.body,
        )
      : null;

  return { startPrint, printPortal };
}
