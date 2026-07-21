import { apiRequest } from "./api";

export type AttributeOption = { id: string; label: string };

export type ProductAttribute = {
  id: string;
  name: string;
  allowImage?: boolean;
  options: AttributeOption[];
};

export type ProductVariant = {
  id: string;
  sku: string;
  price: number;
  salePrice: number;
  quantity: number;
  attributeValues: Record<string, string>;
  image?: string;
};

export type Product = {
  id: string;
  name: string;
  categoryId?: string | null;
  images?: string[];
  attributes: ProductAttribute[];
  variants: ProductVariant[];
};

export type ProductPage = {
  items: Product[];
  total: number;
  pageSize: number;
  offset: number;
};

export function variantSellPrice(v: ProductVariant): number {
  const sell = Number(v.salePrice) || 0;
  const cost = Number(v.price) || 0;
  return sell > 0 ? sell : cost;
}

export function productMinPrice(p: Product): number {
  const prices = (p.variants || [])
    .map(variantSellPrice)
    .filter((n) => n > 0);
  return prices.length ? Math.min(...prices) : 0;
}

export function productStock(p: Product): number {
  return (p.variants || []).reduce(
    (sum, v) => sum + (Number(v.quantity) || 0),
    0,
  );
}

export function variantLabel(v: ProductVariant): string {
  const vals = Object.values(v.attributeValues || {}).filter(Boolean);
  return vals.length ? vals.join(" / ") : "ساده";
}

export async function searchProducts(
  query: string,
  limit = 40,
  offset = 0,
): Promise<ProductPage> {
  const params = new URLSearchParams({
    includeTotal: "true",
    limit: String(limit),
    offset: String(offset),
    sort: "new",
  });
  if (query.trim()) params.set("q", query.trim());
  return apiRequest<ProductPage>(`/products?${params.toString()}`);
}

export async function getProduct(id: string): Promise<Product> {
  return apiRequest<Product>(`/products/${encodeURIComponent(id)}`);
}
