import { apiRequest } from "@/lib/api";

const KEY = "accounting-customers";

const localGetCustomers = (): Customer[] => {
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

const localSaveCustomers = (customers: Customer[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(customers));
};
/* ─────────────────────────────────────────────────────────────────────────
   Customer — type + localStorage helpers
──────────────────────────────────────────────────────────────────────────── */

export type CustomerAddress = {
  id: string;
  customerId: string;
  title: string;
  fullName: string;
  phone: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
  isDefault: boolean;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  addresses?: CustomerAddress[];
};

export const getCustomers = async (): Promise<Customer[]> => {
  try {
    const res = await apiRequest<Customer[]>("/customers");
    return res ?? localGetCustomers();
  } catch {
    return localGetCustomers();
  }
};

export const saveCustomers = async (customers: Customer[]): Promise<void> => {
  try {
    await Promise.all(
      customers.map((customer) =>
        apiRequest(`/customers/${customer.id}`, {
          method: "PUT",
          body: JSON.stringify(customer),
        }),
      ),
    );
  } catch {
    localSaveCustomers(customers);
  }
};

export const getCustomerById = async (
  id: string,
): Promise<Customer | undefined> => {
  const all = await getCustomers();
  return all.find((c) => c.id === id);
};

export const saveCustomer = async (customer: Customer): Promise<void> => {
  try {
    await apiRequest(`/customers/${customer.id}`, {
      method: "PUT",
      body: JSON.stringify(customer),
    });
  } catch {
    const all = localGetCustomers();
    const idx = all.findIndex((c) => c.id === customer.id);
    if (idx >= 0) all[idx] = customer;
    else all.push(customer);
    localSaveCustomers(all);
  }
};

export const deleteCustomer = async (id: string): Promise<void> => {
  try {
    await apiRequest(`/customers/${id}`, { method: "DELETE" });
  } catch {
    const all = localGetCustomers().filter((c) => c.id !== id);
    localSaveCustomers(all);
  }
};
