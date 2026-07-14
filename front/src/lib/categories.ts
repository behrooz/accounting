import { apiRequest } from "@/lib/api";

export type ProductCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
};

export const getCategories = async (): Promise<ProductCategory[]> => {
  try {
    const rows = await apiRequest<ProductCategory[]>("/categories");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};
