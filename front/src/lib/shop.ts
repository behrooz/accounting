import { apiRequest } from "@/lib/api";

export type ShopSettings = {
  name: string;
  phone: string;
  address: string;
};

export async function getShopSettings(): Promise<ShopSettings> {
  try {
    return await apiRequest<ShopSettings>("/shop-settings");
  } catch {
    return { name: "فروشگاه آبرنگ", phone: "", address: "" };
  }
}

export async function saveShopSettings(settings: ShopSettings): Promise<void> {
  await apiRequest("/shop-settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}
