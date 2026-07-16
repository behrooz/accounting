"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GetRowIdParams,
  type ICellRendererParams,
  themeQuartz,
} from "ag-grid-community";
import { deleteInvoice, getInvoices, type Invoice } from "@/lib/invoices";
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

type GridCtx = {
  handleEdit: (id: string) => void;
  handlePrint: (id: string) => void;
  handleLabel: (id: string) => void;
  handleDelete: (id: string) => void;
};

const NoRowsOverlay = () => (
  <p className="text-sm text-[#545b64]">هیچ فاکتوری ثبت نشده است.</p>
);

const StatusBadge = ({ value }: { value: string }) =>
  value === "confirmed" ? (
    <span className="rounded bg-[#ebf6e8] px-2 py-0.5 text-xs font-medium text-[#1d8102]">تأیید‌شده</span>
  ) : (
    <span className="rounded bg-[#f2f3f3] px-2 py-0.5 text-xs font-medium text-[#545b64]">پیش‌نویس</span>
  );

const SourceBadge = ({ value }: { value?: string }) =>
  value === "storefront" ? (
    <span className="rounded bg-[#e7f2f8] px-2 py-0.5 text-xs font-medium text-[#0073bb]">سفارش فروشگاه</span>
  ) : (
    <span className="rounded bg-[#f2f3f3] px-2 py-0.5 text-xs font-medium text-[#545b64]">داشبورد</span>
  );

const ActionCellRenderer = ({ data, context }: ICellRendererParams) => {
  const ctx = context as GridCtx;
  const inv = data as Invoice;
  return (
    <div className="flex h-full items-center gap-1.5">
      <button onClick={() => ctx.handleEdit(inv.id)}
        className="rounded border border-[#0073bb] bg-white px-2.5 py-1 text-xs font-medium text-[#0073bb] hover:bg-[#e7f2f8] transition">
        ویرایش
      </button>
      <button onClick={() => ctx.handlePrint(inv.id)}
        className="rounded border border-[#aab7b8] bg-white px-2.5 py-1 text-xs font-medium text-[#545b64] hover:bg-[#f2f3f3] transition">
        چاپ
      </button>
      <button onClick={() => ctx.handleLabel(inv.id)}
        className="rounded border border-[#1d8102] bg-white px-2.5 py-1 text-xs font-medium text-[#1d8102] hover:bg-[#ebf6e8] transition">
        برچسب بسته
      </button>
      <button onClick={() => ctx.handleDelete(inv.id)}
        className="rounded border border-[#d13212] bg-white px-2.5 py-1 text-xs font-medium text-[#d13212] hover:bg-[#fdf3f1] transition">
        حذف
      </button>
    </div>
  );
};

const fa = (n: number) => Math.round(n).toLocaleString("fa-IR");
const faDate = (d: unknown) => {
  if (d == null || d === "") return "—";
  const shamsi = gregorianISOToJalali(String(d), "YYYY/MM/DD");
  return shamsi || "—";
};

const COLUMN_DEFS: ColDef<Invoice>[] = [
  { field: "number", headerName: "شماره فاکتور", editable: false, width: 140, filter: "agTextColumnFilter" },
  {
    field: "date",
    headerName: "تاریخ",
    editable: false,
    width: 130,
    valueFormatter: (p) => faDate(p.value),
  },
  { field: "customerName", headerName: "مشتری", editable: false, flex: 1, minWidth: 140, filter: "agTextColumnFilter", valueFormatter: (p) => (p.value as string) || "—" },
  { field: "customerPhone", headerName: "تلفن", editable: false, width: 120, filter: "agTextColumnFilter", valueFormatter: (p) => (p.value as string) || "—" },
  { field: "source", headerName: "منبع", editable: false, width: 130, cellRenderer: (p: ICellRendererParams) => <SourceBadge value={p.value as string} /> },
  { headerName: "اقلام", editable: false, width: 80, sortable: true, valueGetter: (p) => p.data?.items.length ?? 0 },
  { field: "subtotal", headerName: "جمع اقلام", editable: false, width: 140, sortable: true, valueFormatter: (p) => fa(p.value as number) + " تومان" },
  { field: "total", headerName: "قابل پرداخت", editable: false, width: 150, sortable: true, valueFormatter: (p) => fa(p.value as number) + " تومان" },
  { field: "status", headerName: "وضعیت", editable: false, width: 110, cellRenderer: (p: ICellRendererParams) => <StatusBadge value={p.value as string} /> },
  { headerName: "عملیات", cellRenderer: ActionCellRenderer, sortable: false, filter: false, width: 300, editable: false, resizable: false },
];

const DEFAULT_COL_DEF: ColDef<Invoice> = { sortable: true, resizable: true, filter: true };

type SalesFilters = {
  dateFrom: string;
  dateTo: string;
  invoiceNumber: string;
  customerName: string;
};

const emptyFilters = (): SalesFilters => ({
  dateFrom: "",
  dateTo: "",
  invoiceNumber: "",
  customerName: "",
});

export default function SalesPage() {
  const router = useRouter();
  const gridRef = useRef<AgGridReact<Invoice>>(null);
  const [rowData, setRowData] = useState<Invoice[]>([]);
  const [filters, setFilters] = useState<SalesFilters>(emptyFilters);
  const [loading, setLoading] = useState(false);

  const fetchFromServer = useCallback(async (f: SalesFilters) => {
    setLoading(true);
    try {
      const invs = await getInvoices({
        dateFrom: f.dateFrom || undefined,
        dateTo: f.dateTo || undefined,
        number: f.invoiceNumber.trim() || undefined,
        customerName: f.customerName.trim() || undefined,
      });
      setRowData(invs);
    } catch (err) {
      console.error(err);
      setRowData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Every filter change → request server (debounced for typing)
  useEffect(() => {
    const t = setTimeout(() => {
      void fetchFromServer(filters);
    }, 300);
    return () => clearTimeout(t);
  }, [filters, fetchFromServer]);

  const updateFilter = useCallback(
    <K extends keyof SalesFilters>(key: K, value: SalesFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const clearFilters = useCallback(() => {
    setFilters(emptyFilters());
  }, []);

  const handleEdit = useCallback((id: string) => router.push(`/sales/${id}`), [router]);

  const handlePrint = useCallback(
    (id: string) => router.push(`/sales/${id}/print?mode=invoice`),
    [router],
  );

  const handleLabel = useCallback(
    (id: string) => router.push(`/sales/${id}/print?mode=label`),
    [router],
  );

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm("آیا از حذف این فاکتور مطمئن هستید؟")) return;
    await deleteInvoice(id);
    await fetchFromServer(filters);
  }, [fetchFromServer, filters]);

  const getRowId = useCallback((p: GetRowIdParams<Invoice>) => p.data.id, []);

  const gridCtx: GridCtx = { handleEdit, handlePrint, handleLabel, handleDelete };

  const confirmedTotal = rowData
    .filter((i) => i.status === "confirmed")
    .reduce((s, i) => s + i.total, 0);

  const hasActiveFilters =
    !!filters.dateFrom ||
    !!filters.dateTo ||
    !!filters.invoiceNumber.trim() ||
    !!filters.customerName.trim();

  const inputCls =
    "rounded border border-[#aab7b8] bg-white px-3 py-2 text-sm text-[#16191f] placeholder:text-[#879596] outline-none focus:border-[#0073bb] focus:ring-1 focus:ring-[#0073bb]";

  return (
    <div className="flex w-full flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#16191f]">فاکتورها</h1>
          <p className="mt-0.5 text-sm text-[#545b64]">
            مجموع فروش تأیید‌شده
            {hasActiveFilters ? " (فیلتر‌شده)" : ""}
            :{" "}
            <span className="font-semibold text-[#1d8102]">{fa(confirmedTotal)} تومان</span>
            {loading ? (
              <span className="mr-2 text-xs text-[#879596]">در حال بارگذاری…</span>
            ) : null}
          </p>
        </div>
        <button
          onClick={() => router.push("/sales/new")}
          className="rounded bg-[#ec7211] px-4 py-2 text-sm font-medium text-white hover:bg-[#eb5f07] transition"
        >
          + فاکتور جدید
        </button>
      </div>

      <div className="rounded border border-[#d5dbdb] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[160px] flex-col gap-1 text-xs font-medium text-[#545b64]">
            <span>از تاریخ</span>
            <ShamsiDatePicker
              value={filters.dateFrom}
              onChange={(iso) => updateFilter("dateFrom", iso)}
              inputClassName={inputCls}
            />
          </div>
          <div className="flex min-w-[160px] flex-col gap-1 text-xs font-medium text-[#545b64]">
            <span>تا تاریخ</span>
            <ShamsiDatePicker
              value={filters.dateTo}
              onChange={(iso) => updateFilter("dateTo", iso)}
              inputClassName={inputCls}
            />
          </div>
          <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs font-medium text-[#545b64]">
            شماره فاکتور
            <input
              type="search"
              placeholder="مثلاً INV-0003"
              value={filters.invoiceNumber}
              onChange={(e) => updateFilter("invoiceNumber", e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs font-medium text-[#545b64]">
            نام مشتری
            <input
              type="search"
              placeholder="جستجوی مشتری…"
              value={filters.customerName}
              onChange={(e) => updateFilter("customerName", e.target.value)}
              className={inputCls}
            />
          </label>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="rounded border border-[#aab7b8] bg-white px-3 py-2 text-sm font-medium text-[#545b64] hover:bg-[#f2f3f3] transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            پاک کردن فیلتر
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded border border-[#d5dbdb] shadow-sm" style={{ height: 540 }}>
        <AgGridReact<Invoice>
          ref={gridRef}
          theme={gridTheme}
          rowData={rowData}
          columnDefs={COLUMN_DEFS}
          defaultColDef={DEFAULT_COL_DEF}
          getRowId={getRowId}
          enableRtl={true}
          pagination={true}
          paginationPageSize={20}
          animateRows={true}
          context={gridCtx}
          noRowsOverlayComponent={NoRowsOverlay}
        />
      </div>
      <p className="text-xs text-[#879596]">
        {rowData.length} فاکتور
        {hasActiveFilters ? " (نتیجه فیلتر سرور)" : " ثبت‌شده"}
      </p>
    </div>
  );
}
