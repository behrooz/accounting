import { apiRequest } from "./api";

export type InvoiceItem = {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  total: number;
};

export type Invoice = {
  id: string;
  number: string;
  date: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: InvoiceItem[];
  notes: string;
  discount: number;
  subtotal: number;
  total: number;
  status: "draft" | "confirmed";
  source?: string;
  paymentMethod?: string;
  createdAt: string;
};

export type ShopSettings = {
  name: string;
  phone: string;
  address: string;
};

export function todayDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatToman(n: number): string {
  return `${Math.round(n || 0).toLocaleString("fa-IR")} تومان`;
}

export async function nextInvoiceNumber(): Promise<string> {
  const response = await apiRequest<{ number: string }>(
    "/invoices/next-number",
  );
  return response.number;
}

export async function saveInvoice(invoice: Invoice): Promise<void> {
  await apiRequest(`/invoices/${invoice.id}`, {
    method: "PUT",
    body: JSON.stringify(invoice),
  });
}

export async function getShopSettings(): Promise<ShopSettings> {
  try {
    return await apiRequest<ShopSettings>("/shop-settings");
  } catch {
    return { name: "فروشگاه آبرنگ", phone: "", address: "" };
  }
}
