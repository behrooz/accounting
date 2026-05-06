import { apiRequest } from "@/lib/api";
/* ─────────────────────────────────────────────────────────────────────────
   Types
──────────────────────────────────────────────────────────────────────────── */

/** One selectable value within a product attribute – e.g. "قرمز", "XL" */
export type AttributeOption = {
  id: string;
  label: string;
};

/** A product dimension – e.g. "رنگ", "سایز", "حافظه" */
export type ProductAttribute = {
  id: string;
  name: string;
  options: AttributeOption[];
};

/**
 * One purchaseable variant of a product.
 * `attributeValues` maps attributeId → chosen option label.
 * Simple products (no attributes) have one variant with attributeValues = {}.
 */
export type ProductVariant = {
  id: string;
  sku: string;
  /** قیمت خرید — purchase / cost price */
  price: number;
  /** قیمت فروش — selling price */
  salePrice: number;
  quantity: number;
  attributeValues: Record<string, string>;
  /** Base-64 compressed thumbnail for this variant (optional) */
  image?: string;
};

/** A product with any number of attributes and variants */
export type Product = {
  id: string;
  name: string;
  attributes: ProductAttribute[];
  variants: ProductVariant[];
};

/* ─────────────────────────────────────────────────────────────────────────
   Derived helpers
──────────────────────────────────────────────────────────────────────────── */

export const productMinPrice = (p: Product): number =>
  p.variants.length ? Math.min(...p.variants.map((v) => v.price)) : 0;

export const productMaxPrice = (p: Product): number =>
  p.variants.length ? Math.max(...p.variants.map((v) => v.price)) : 0;

export const productTotalStock = (p: Product): number =>
  p.variants.reduce((sum, v) => sum + v.quantity, 0);

/** e.g. "۱۵۰٬۰۰۰ – ۳۲۰٬۰۰۰"  or a single value when min === max */
export const productPriceRange = (p: Product): string => {
  if (!p.variants.length) return "—";
  const min = productMinPrice(p);
  const max = productMaxPrice(p);
  if (min === max) return min.toLocaleString("fa-IR");
  return `${min.toLocaleString("fa-IR")} – ${max.toLocaleString("fa-IR")}`;
};

/* ─────────────────────────────────────────────────────────────────────────
   Variant generation
──────────────────────────────────────────────────────────────────────────── */

/**
 * Returns every Cartesian-product combination of the given attributes'
 * options.  Returns [{}] (one variant, no attribute values) when there are
 * no attributes or none of them have any options yet.
 */
export const generateVariantCombinations = (
  attributes: ProductAttribute[],
): Record<string, string>[] => {
  const active = attributes.filter((a) => a.options.length > 0);
  if (active.length === 0) return [{}];
  return active.reduce<Record<string, string>[]>(
    (combos, attr) =>
      combos.flatMap((combo) =>
        attr.options.map((opt) => ({ ...combo, [attr.id]: opt.label })),
      ),
    [{}],
  );
};

/**
 * Merges newly computed combinations with existing variants:
 * - existing variants whose combo is still valid are preserved (keeping SKU / price / qty)
 * - combos that have no matching existing variant get a fresh empty variant
 * - variants whose combo no longer exists are dropped
 */
export const mergeVariants = (
  existing: ProductVariant[],
  combinations: Record<string, string>[],
): ProductVariant[] =>
  combinations.map((combo) => {
    const keys = Object.keys(combo);
    const match = existing.find(
      (v) =>
        keys.length === Object.keys(v.attributeValues).length &&
        keys.every((k) => v.attributeValues[k] === combo[k]),
    );
    return (
      match ?? {
        id: crypto.randomUUID(),
        sku: "",
        price: 0,
        salePrice: 0,
        quantity: 0,
        attributeValues: combo,
      }
    );
  });

/* ─────────────────────────────────────────────────────────────────────────
   localStorage persistence
──────────────────────────────────────────────────────────────────────────── */

export const getProducts = async (): Promise<Product[]> =>
  apiRequest<Product[]>("/products");

export const saveProducts = async (products: Product[]): Promise<void> => {
  await Promise.all(
    products.map((product) =>
      apiRequest(`/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify(product),
      }),
    ),
  );
};

export const getProductById = async (id: string): Promise<Product | undefined> => {
  try {
    return await apiRequest<Product>(`/products/${id}`);
  } catch {
    return undefined;
  }
};

export const saveProduct = async (product: Product): Promise<void> => {
  await apiRequest(`/products/${product.id}`, {
    method: "PUT",
    body: JSON.stringify(product),
  });
};

export const deleteProduct = async (id: string): Promise<void> => {
  await apiRequest(`/products/${id}`, { method: "DELETE" });
};
