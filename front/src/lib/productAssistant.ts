import { getApiToken } from "@/lib/api";

export type ProductAssistantAttribute = {
  name: string;
  allowImage: boolean;
  options: string[];
};

export type ProductAssistantVariant = {
  attributeValues: Record<string, string>;
  sku: string;
  purchasePrice: number;
  salePrice: number;
  quantity: number;
};

export type ProductAssistantDraft = {
  name: string;
  categoryName: string;
  attributes: ProductAssistantAttribute[];
  defaults: {
    skuPrefix: string;
    purchasePrice: number;
    salePrice: number;
    quantity: number;
  };
  variants: ProductAssistantVariant[];
};

export async function generateProductDraft(
  description: string,
): Promise<ProductAssistantDraft> {
  const token = getApiToken();
  const response = await fetch("/api/product-assistant/draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ description }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    draft?: ProductAssistantDraft;
    error?: string;
  };
  if (!response.ok || !body.draft) {
    throw new Error(body.error || `API error: ${response.status}`);
  }
  return body.draft;
}
