import { apiRequest } from "@/lib/api";
/* ─────────────────────────────────────────────────────────────────────────
   Invoice — types + localStorage helpers
──────────────────────────────────────────────────────────────────────────── */

export type InvoiceItem = {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  /** e.g. "قرمز / L" */
  variantLabel: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  /** unitPrice × quantity */
  total: number;
};

export type Invoice = {
  id: string;
  /** e.g. "INV-0001" */
  number: string;
  /** YYYY-MM-DD */
  date: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: InvoiceItem[];
  notes: string;
  /** Global discount — absolute amount in Tomans */
  discount: number;
  /** sum of item totals */
  subtotal: number;
  /** subtotal - discount */
  total: number;
  status: "draft" | "confirmed";
  createdAt: string;
};

/* ─── helpers ─────────────────────────────────────────────────────────── */

export const computeItemTotal = (
  unitPrice: number,
  quantity: number,
): number => Math.round(unitPrice * quantity);

export const computeInvoiceTotals = (
  items: InvoiceItem[],
  discount: number,
): { subtotal: number; total: number } => {
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  return { subtotal, total: Math.max(0, subtotal - discount) };
};

/** Sequential invoice number based on existing count */
export const nextInvoiceNumber = async (): Promise<string> => {
  const response = await apiRequest<{ number: string }>("/invoices/next-number");
  return response.number;
};

/* ─── localStorage ────────────────────────────────────────────────────── */

export const getInvoices = async (): Promise<Invoice[]> =>
  apiRequest<Invoice[]>("/invoices");

export const saveInvoices = async (invoices: Invoice[]): Promise<void> => {
  await Promise.all(
    invoices.map((invoice) =>
      apiRequest(`/invoices/${invoice.id}`, {
        method: "PUT",
        body: JSON.stringify(invoice),
      }),
    ),
  );
};

export const getInvoiceById = async (
  id: string,
): Promise<Invoice | undefined> => {
  try {
    return await apiRequest<Invoice>(`/invoices/${id}`);
  } catch {
    return undefined;
  }
};

export const saveInvoice = async (invoice: Invoice): Promise<void> => {
  await apiRequest(`/invoices/${invoice.id}`, {
    method: "PUT",
    body: JSON.stringify(invoice),
  });
};

export const deleteInvoice = async (id: string): Promise<void> => {
  await apiRequest(`/invoices/${id}`, { method: "DELETE" });
};
