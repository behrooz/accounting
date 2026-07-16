import { apiRequest } from "@/lib/api";

const KEY = "accounting-invoices";

const localGetInvoices = (): Invoice[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const localSaveInvoices = (invoices: Invoice[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(invoices));
};
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
  /** dashboard = created in panel; storefront = online shop order */
  source?: "dashboard" | "storefront" | string;
  shippingMethod?: string;
  shippingFee?: number;
  paymentMethod?: string;
  createdAt: string;
};

/* ─── helpers ─────────────────────────────────────────────────────────── */

export const computeItemTotal = (unitPrice: number, quantity: number): number =>
  Math.round(unitPrice * quantity);

export const computeInvoiceTotals = (
  items: InvoiceItem[],
  discount: number,
): { subtotal: number; total: number } => {
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  return { subtotal, total: Math.max(0, subtotal - discount) };
};

/** Sequential invoice number based on existing count */
export const nextInvoiceNumber = async (): Promise<string> => {
  try {
    const response = await apiRequest<{ number: string }>(
      "/invoices/next-number",
    );
    return response.number;
  } catch {
    // fallback to local count
    const n = localGetInvoices().length + 1;
    return `INV-${String(n).padStart(4, "0")}`;
  }
};

/* ─── localStorage ────────────────────────────────────────────────────── */

export type InvoiceListFilters = {
  dateFrom?: string;
  dateTo?: string;
  number?: string;
  customerName?: string;
};

export const getInvoices = async (
  filters?: InvoiceListFilters,
): Promise<Invoice[]> => {
  try {
    const params = new URLSearchParams();
    if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.set("dateTo", filters.dateTo);
    if (filters?.number) params.set("number", filters.number);
    if (filters?.customerName) params.set("customerName", filters.customerName);
    const qs = params.toString();
    return await apiRequest<Invoice[]>(`/invoices${qs ? `?${qs}` : ""}`);
  } catch {
    // local fallback: apply same filters client-side
    let all = localGetInvoices();
    if (filters?.dateFrom) {
      all = all.filter((i) => (i.date || "").slice(0, 10) >= filters.dateFrom!);
    }
    if (filters?.dateTo) {
      all = all.filter((i) => (i.date || "").slice(0, 10) <= filters.dateTo!);
    }
    if (filters?.number) {
      const q = filters.number.toLowerCase();
      all = all.filter((i) => (i.number || "").toLowerCase().includes(q));
    }
    if (filters?.customerName) {
      const q = filters.customerName.toLowerCase();
      all = all.filter((i) => (i.customerName || "").toLowerCase().includes(q));
    }
    return all;
  }
};

export const saveInvoices = async (invoices: Invoice[]): Promise<void> => {
  try {
    await Promise.all(
      invoices.map((invoice) =>
        apiRequest(`/invoices/${invoice.id}`, {
          method: "PUT",
          body: JSON.stringify(invoice),
        }),
      ),
    );
  } catch {
    // fallback to localStorage
    localSaveInvoices(invoices);
  }
};

export const getInvoiceById = async (
  id: string,
): Promise<Invoice | undefined> => {
  try {
    return await apiRequest<Invoice>(`/invoices/${id}`);
  } catch {
    return localGetInvoices().find((i) => i.id === id);
  }
};

export const saveInvoice = async (invoice: Invoice): Promise<void> => {
  try {
    await apiRequest(`/invoices/${invoice.id}`, {
      method: "PUT",
      body: JSON.stringify(invoice),
    });
  } catch {
    const all = localGetInvoices();
    const idx = all.findIndex((i) => i.id === invoice.id);
    if (idx >= 0) all[idx] = invoice;
    else all.push(invoice);
    localSaveInvoices(all);
  }
};

export const deleteInvoice = async (id: string): Promise<void> => {
  try {
    await apiRequest(`/invoices/${id}`, { method: "DELETE" });
  } catch {
    const all = localGetInvoices().filter((i) => i.id !== id);
    localSaveInvoices(all);
  }
};
