"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GetRowIdParams,
  type ICellRendererParams,
  themeQuartz,
} from "ag-grid-community";
import {
  deleteExpense,
  EXPENSE_CATEGORIES,
  getExpenses,
  saveExpense,
  type Expense,
} from "@/lib/expenses";
import { gregorianISOToJalali } from "@/lib/jalali";
import ShamsiDatePicker from "@/components/ShamsiDatePicker";

ModuleRegistry.registerModules([AllCommunityModule]);

const gridTheme = themeQuartz.withParams({
  fontFamily: "inherit",
  fontSize: 14,
  rowHeight: 40,
  headerHeight: 36,
  accentColor: "#0073bb",
  backgroundColor: "#ffffff",
  foregroundColor: "#16191f",
  borderColor: "#d5dbdb",
  oddRowBackgroundColor: "#f8f9f9",
  headerBackgroundColor: "#f2f3f3",
  wrapperBorderRadius: "0px",
  rowHoverColor: "#f2f8fd",
  selectedRowBackgroundColor: "#e7f2f8",
});

const fa = (n: number) => Math.round(n).toLocaleString("fa-IR");
const faDate = (d: unknown) => {
  if (d == null || d === "") return "—";
  return gregorianISOToJalali(String(d), "YYYY/MM/DD") || "—";
};

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyForm(): Omit<Expense, "id"> & { id?: string } {
  return {
    title: "",
    category: EXPENSE_CATEGORIES[0],
    amount: 0,
    date: todayIso(),
    notes: "",
  };
}

type GridCtx = {
  handleEdit: (expense: Expense) => void;
  handleDelete: (id: string) => void;
};

const NoRowsOverlay = () => (
  <p className="text-sm text-[#545b64]">هنوز هزینه‌ای ثبت نشده است.</p>
);

const ActionCellRenderer = ({ data, context }: ICellRendererParams<Expense>) => {
  if (!data) return null;
  const ctx = context as GridCtx;
  return (
    <div className="flex h-full items-center gap-1.5">
      <button
        type="button"
        onClick={() => ctx.handleEdit(data)}
        className="rounded border border-[#0073bb] bg-white px-2.5 py-1 text-xs font-medium text-[#0073bb] hover:bg-[#e7f2f8] transition"
      >
        ویرایش
      </button>
      <button
        type="button"
        onClick={() => ctx.handleDelete(data.id)}
        className="rounded border border-[#d13212] bg-white px-2.5 py-1 text-xs font-medium text-[#d13212] hover:bg-[#fdf3f1] transition"
      >
        حذف
      </button>
    </div>
  );
};

type Filters = {
  dateFrom: string;
  dateTo: string;
  category: string;
};

const emptyFilters = (): Filters => ({
  dateFrom: "",
  dateTo: "",
  category: "all",
});

export default function ExpensesPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (f: Filters) => {
    setLoading(true);
    try {
      const list = await getExpenses({
        dateFrom: f.dateFrom || undefined,
        dateTo: f.dateTo || undefined,
        category: f.category !== "all" ? f.category : undefined,
      });
      setRows(list);
    } catch (err) {
      console.error(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void load(filters);
    }, 250);
    return () => clearTimeout(t);
  }, [filters, load]);

  const total = useMemo(
    () => rows.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [rows],
  );

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) {
      alert("عنوان هزینه را وارد کنید.");
      return;
    }
    const amount = Math.max(0, Math.round(Number(form.amount) || 0));
    if (amount <= 0) {
      alert("مبلغ باید بیشتر از صفر باشد.");
      return;
    }
    setSaving(true);
    try {
      const expense: Expense = {
        id: editingId || crypto.randomUUID(),
        title,
        category: form.category || "سایر",
        amount,
        date: form.date || todayIso(),
        notes: form.notes.trim(),
      };
      await saveExpense(expense);
      resetForm();
      await load(filters);
    } catch (err) {
      alert(err instanceof Error ? err.message : "ذخیره ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = useCallback((expense: Expense) => {
    setEditingId(expense.id);
    setForm({
      title: expense.title,
      category: expense.category || EXPENSE_CATEGORIES[0],
      amount: expense.amount,
      date: expense.date,
      notes: expense.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm("آیا از حذف این هزینه مطمئن هستید؟")) return;
      await deleteExpense(id);
      if (editingId === id) resetForm();
      await load(filters);
    },
    [editingId, filters, load],
  );

  const columnDefs = useMemo<ColDef<Expense>[]>(
    () => [
      {
        field: "date",
        headerName: "تاریخ",
        width: 120,
        valueFormatter: (p) => faDate(p.value),
      },
      {
        field: "title",
        headerName: "عنوان",
        flex: 1.2,
        minWidth: 140,
        filter: "agTextColumnFilter",
      },
      {
        field: "category",
        headerName: "دسته‌بندی",
        width: 160,
        filter: "agTextColumnFilter",
      },
      {
        field: "amount",
        headerName: "مبلغ",
        width: 140,
        valueFormatter: (p) => fa(Number(p.value) || 0) + " تومان",
      },
      {
        field: "notes",
        headerName: "توضیحات",
        flex: 1,
        minWidth: 120,
        valueFormatter: (p) => (p.value as string) || "—",
      },
      {
        headerName: "عملیات",
        cellRenderer: ActionCellRenderer,
        width: 150,
        sortable: false,
        filter: false,
        editable: false,
        resizable: false,
      },
    ],
    [],
  );

  const inputCls =
    "w-full rounded border border-[#aab7b8] bg-white px-3 py-2 text-sm text-[#16191f] outline-none focus:border-[#0073bb] focus:ring-1 focus:ring-[#0073bb]";

  return (
    <div className="flex w-full flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#16191f]">هزینه‌ها</h1>
          <p className="mt-0.5 text-sm text-[#545b64]">
            ثبت کرایه، سایت، سرور، نگهداری و سایر هزینه‌های جاری
          </p>
        </div>
        <div className="rounded border border-[#d5dbdb] bg-white px-4 py-2 shadow-sm">
          <p className="text-[11px] text-[#545b64]">جمع فیلتر‌شده</p>
          <p className="text-lg font-bold text-[#d13212]">
            {fa(total)} تومان
            {loading ? (
              <span className="mr-2 text-xs font-normal text-[#879596]">
                …
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded border border-[#d5dbdb] bg-white p-4 shadow-sm"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#16191f]">
            {editingId ? "ویرایش هزینه" : "ثبت هزینه جدید"}
          </h2>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-[#545b64] hover:text-[#0073bb]"
            >
              انصراف از ویرایش
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-[#545b64]">
            عنوان
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="مثلاً کرایه فروردین"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[#545b64]">
            دسته‌بندی
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
              className={inputCls}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[#545b64]">
            مبلغ (تومان)
            <input
              type="number"
              min={0}
              step={1000}
              value={form.amount || ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  amount: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              placeholder="۰"
              className={inputCls}
            />
          </label>
          <div className="flex flex-col gap-1 text-xs font-medium text-[#545b64]">
            <span>تاریخ</span>
            <ShamsiDatePicker
              value={form.date}
              onChange={(iso) => setForm((f) => ({ ...f, date: iso }))}
              inputClassName={inputCls}
            />
          </div>
          <label className="flex flex-col gap-1 text-xs font-medium text-[#545b64] sm:col-span-2 lg:col-span-3">
            توضیحات
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="اختیاری"
              className={inputCls}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded bg-[#ec7211] px-4 py-2 text-sm font-medium text-white hover:bg-[#eb5f07] transition disabled:opacity-60"
            >
              {saving ? "در حال ذخیره…" : editingId ? "بروزرسانی" : "ثبت هزینه"}
            </button>
          </div>
        </div>
      </form>

      <div className="rounded border border-[#d5dbdb] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[150px] flex-col gap-1 text-xs font-medium text-[#545b64]">
            <span>از تاریخ</span>
            <ShamsiDatePicker
              value={filters.dateFrom}
              onChange={(iso) =>
                setFilters((f) => ({ ...f, dateFrom: iso }))
              }
              inputClassName={inputCls}
            />
          </div>
          <div className="flex min-w-[150px] flex-col gap-1 text-xs font-medium text-[#545b64]">
            <span>تا تاریخ</span>
            <ShamsiDatePicker
              value={filters.dateTo}
              onChange={(iso) => setFilters((f) => ({ ...f, dateTo: iso }))}
              inputClassName={inputCls}
            />
          </div>
          <label className="flex min-w-[160px] flex-col gap-1 text-xs font-medium text-[#545b64]">
            دسته
            <select
              value={filters.category}
              onChange={(e) =>
                setFilters((f) => ({ ...f, category: e.target.value }))
              }
              className={inputCls}
            >
              <option value="all">همه دسته‌ها</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setFilters(emptyFilters())}
            className="rounded border border-[#aab7b8] bg-white px-3 py-2 text-sm text-[#545b64] hover:bg-[#f2f3f3] transition"
          >
            پاک کردن فیلتر
          </button>
        </div>
      </div>

      <div
        className="overflow-hidden rounded border border-[#d5dbdb] shadow-sm"
        style={{ height: 420 }}
      >
        <AgGridReact<Expense>
          theme={gridTheme}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, resizable: true, filter: true }}
          getRowId={(p: GetRowIdParams<Expense>) => p.data.id}
          enableRtl={true}
          pagination={true}
          paginationPageSize={15}
          animateRows={true}
          context={{ handleEdit, handleDelete } satisfies GridCtx}
          noRowsOverlayComponent={NoRowsOverlay}
        />
      </div>
      <p className="text-xs text-[#879596]">{fa(rows.length)} هزینه</p>
    </div>
  );
}
