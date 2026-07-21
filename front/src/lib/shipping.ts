import { apiRequest } from "@/lib/api";

export type ShippingMethod = {
  id: string;
  name: string;
  deliveryNote: string;
  fee: number;
  payAtDestination: boolean;
  sortOrder: number;
  isActive: boolean;
};

export async function getShippingMethods(): Promise<ShippingMethod[]> {
  return apiRequest<ShippingMethod[]>("/shipping-methods");
}

export async function saveShippingMethods(
  methods: ShippingMethod[],
): Promise<ShippingMethod[]> {
  return apiRequest<ShippingMethod[]>("/shipping-methods", {
    method: "PUT",
    body: JSON.stringify(methods),
  });
}

export function newShippingMethod(index = 0): ShippingMethod {
  return {
    id: "",
    name: "",
    deliveryNote: "",
    fee: 0,
    payAtDestination: false,
    sortOrder: index + 1,
    isActive: true,
  };
}
