import { apiRequest } from "@/lib/api";

const KEY = "accounting-expenses";

export const EXPENSE_CATEGORIES = [
  "کرایه مغازه",
  "سایت و دامنه",
  "سرور و هاست",
  "نگهداری و تعمیرات",
  "حقوق و دستمزد",
  "تبلیغات",
  "حمل‌ونقل",
  "قبوض (آب، برق، گاز، اینترنت)",
  "بیمه و مالیات",
  "سایر",
] as const;

export type Expense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  notes: string;
};

export type ExpenseListFilters = {
  dateFrom?: string;
  dateTo?: string;
  category?: string;
};

const localGetExpenses = (): Expense[] => {
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

const localSaveExpenses = (expenses: Expense[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(expenses));
};

export const getExpenses = async (
  filters?: ExpenseListFilters,
): Promise<Expense[]> => {
  try {
    const qs = new URLSearchParams();
    if (filters?.dateFrom) qs.set("dateFrom", filters.dateFrom);
    if (filters?.dateTo) qs.set("dateTo", filters.dateTo);
    if (filters?.category) qs.set("category", filters.category);
    const q = qs.toString();
    return await apiRequest<Expense[]>(`/expenses${q ? `?${q}` : ""}`);
  } catch {
    let all = localGetExpenses();
    if (filters?.dateFrom) {
      all = all.filter((e) => e.date >= filters.dateFrom!);
    }
    if (filters?.dateTo) {
      all = all.filter((e) => e.date <= filters.dateTo!);
    }
    if (filters?.category && filters.category !== "all") {
      all = all.filter((e) => e.category === filters.category);
    }
    return all.sort((a, b) => b.date.localeCompare(a.date));
  }
};

export const getExpensesSum = async (
  filters?: ExpenseListFilters,
): Promise<number> => {
  try {
    const qs = new URLSearchParams();
    if (filters?.dateFrom) qs.set("dateFrom", filters.dateFrom);
    if (filters?.dateTo) qs.set("dateTo", filters.dateTo);
    if (filters?.category) qs.set("category", filters.category);
    const q = qs.toString();
    const res = await apiRequest<{ total: number }>(
      `/expenses/sum${q ? `?${q}` : ""}`,
    );
    return Number(res?.total) || 0;
  } catch {
    const list = await getExpenses(filters);
    return list.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }
};

export const saveExpense = async (expense: Expense): Promise<void> => {
  try {
    await apiRequest(`/expenses/${expense.id}`, {
      method: "PUT",
      body: JSON.stringify(expense),
    });
  } catch {
    const all = localGetExpenses();
    const idx = all.findIndex((e) => e.id === expense.id);
    if (idx >= 0) all[idx] = expense;
    else all.push(expense);
    localSaveExpenses(all);
  }
};

export const deleteExpense = async (id: string): Promise<void> => {
  try {
    await apiRequest(`/expenses/${id}`, { method: "DELETE" });
  } catch {
    localSaveExpenses(localGetExpenses().filter((e) => e.id !== id));
  }
};
