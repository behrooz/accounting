import { apiRequest } from "@/lib/api";
/* ─────────────────────────────────────────────────────────────────────────
   Customer — type + localStorage helpers
──────────────────────────────────────────────────────────────────────────── */

export type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
};

export const getCustomers = async (): Promise<Customer[]> =>
  apiRequest<Customer[]>("/customers");

export const saveCustomers = async (customers: Customer[]): Promise<void> => {
  await Promise.all(
    customers.map((customer) =>
      apiRequest(`/customers/${customer.id}`, {
        method: "PUT",
        body: JSON.stringify(customer),
      }),
    ),
  );
};

export const getCustomerById = async (
  id: string,
): Promise<Customer | undefined> => {
  const all = await getCustomers();
  return all.find((c) => c.id === id);
};

export const saveCustomer = async (customer: Customer): Promise<void> => {
  await apiRequest(`/customers/${customer.id}`, {
    method: "PUT",
    body: JSON.stringify(customer),
  });
};

export const deleteCustomer = async (id: string): Promise<void> => {
  await apiRequest(`/customers/${id}`, { method: "DELETE" });
};
