"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GetRowIdParams,
  type ICellRendererParams,
  type IsFullWidthRowParams,
  type RowHeightParams,
  themeQuartz,
} from "ag-grid-community";
import {
  deleteInvoice,
  getInvoices,
  type Invoice,
  type InvoiceItem,
} from "@/lib/invoices";
import { gregorianISOToJalali } from "@/lib/jalali";
import ShamsiDatePicker from "@/components/ShamsiDatePicker";
import { useInvoicePrint } from "@/hooks/useInvoicePrint";

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
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
};

type MasterRow = Invoice & { rowType: "master" };
type DetailRow = {
  rowType: "detail";
  id: string;
  parentId: string;
  items: InvoiceItem[];
};
type SalesRow = MasterRow | DetailRow;

const NoRowsOverlay = () => (
  <p className="text-sm text-[#545b64]">هیچ فاکتوری ثبت نشده است.</p>
);

const StatusBadge = ({ value }: { value: string }) =>
  value === "confirmed" ? (
    <span className="rounded bg-[#ebf6e8] px-2 py-0.5 text-xs font-medium text-[#1d8102]">
      تأیید‌شده
    </span>
  ) : (
    <span className="rounded bg-[#f2f3f3] px-2 py-0.5 text-xs font-medium text-[#545b64]">
      پیش‌نویس
    </span>
  );

const SourceBadge = ({ value }: { value?: string }) =>
  value === "storefront" ? (
    <span className="rounded bg-[#e7f2f8] px-2 py-0.5 text-xs font-medium text-[#0073bb]">
      سفارش فروشگاه
    </span>
  ) : (
    <span className="rounded bg-[#f2f3f3] px-2 py-0.5 text-xs font-medium text-[#545b64]">
      داشبورد
    </span>
  );

const fa = (n: number) => Math.round(n).toLocaleString("fa-IR");
const faDate = (d: unknown) => {
  if (d == null || d === "") return "—";
  const shamsi = gregorianISOToJalali(String(d), "YYYY/MM/DD");
  return shamsi || "—";
};

const ExpandCellRenderer = ({
  data,
  context,
}: ICellRendererParams<SalesRow>) => {
  if (!data || data.rowType !== "master") return null;
  const ctx = context as GridCtx;
  const open = ctx.expandedIds.has(data.id);
  const count = data.items?.length ?? 0;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        ctx.toggleExpand(data.id);
      }}
      className="flex h-full w-full items-center justify-center gap-1 text-[#0073bb] hover:text-[#006499]"
      title={open ? "بستن اقلام" : "نمایش اقلام"}
      aria-expanded={open}
    >
      <span className="text-base leading-none">{open ? "▾" : "▸"}</span>
      <span className="text-[11px] font-medium tabular-nums">{fa(count)}</span>
    </button>
  );
};

const ActionCellRenderer = ({
  data,
  context,
}: ICellRendererParams<SalesRow>) => {
  if (!data || data.rowType !== "master") return null;
  const ctx = context as GridCtx;
  const inv = data;
  return (
    <div className="flex h-full items-center gap-1.5">
      <button
        type="button"
        onClick={() => ctx.handleEdit(inv.id)}
        className="rounded border border-[#0073bb] bg-white px-2.5 py-1 text-xs font-medium text-[#0073bb] hover:bg-[#e7f2f8] transition"
      >
        ویرایش
      </button>
      <button
        type="button"
        onClick={() => ctx.handlePrint(inv.id)}
        className="rounded border border-[#aab7b8] bg-white px-2.5 py-1 text-xs font-medium text-[#545b64] hover:bg-[#f2f3f3] transition"
      >
        چاپ
      </button>
      <button
        type="button"
        onClick={() => ctx.handleLabel(inv.id)}
        className="rounded border border-[#1d8102] bg-white px-2.5 py-1 text-xs font-medium text-[#1d8102] hover:bg-[#ebf6e8] transition"
      >
        برچسب بسته
      </button>
      <button
        type="button"
        onClick={() => ctx.handleDelete(inv.id)}
        className="rounded border border-[#d13212] bg-white px-2.5 py-1 text-xs font-medium text-[#d13212] hover:bg-[#fdf3f1] transition"
      >
        حذف
      </button>
    </div>
  );
};

const ITEM_COLUMN_DEFS: ColDef<InvoiceItem>[] = [
  {
    field: "productName",
    headerName: "محصول",
    flex: 1.4,
    minWidth: 140,
    valueFormatter: (p) => (p.value as string) || "—",
  },
  {
    field: "variantLabel",
    headerName: "ویژگی",
    flex: 1,
    minWidth: 110,
    valueFormatter: (p) => (p.value as string) || "—",
  },
  {
    field: "sku",
    headerName: "کد / SKU",
    width: 110,
    valueFormatter: (p) => (p.value as string) || "—",
  },
  {
    field: "quantity",
    headerName: "تعداد",
    width: 80,
    valueFormatter: (p) => fa(Number(p.value) || 0),
  },
  {
    field: "unitPrice",
    headerName: "قیمت واحد",
    width: 120,
    valueFormatter: (p) => fa(Number(p.value) || 0) + " تومان",
  },
  {
    field: "total",
    headerName: "جمع",
    width: 120,
    valueFormatter: (p) => fa(Number(p.value) || 0) + " تومان",
  },
];

const OrderItemsDetail = ({ data }: ICellRendererParams<SalesRow>) => {
  if (!data || data.rowType !== "detail") return null;
  const items = data.items ?? [];
  if (!items.length) {
    return (
      <div className="flex h-full items-center bg-[#f2f8fd] px-4 text-sm text-[#545b64]">
        این فاکتور اقلامی ندارد.
      </div>
    );
  }
  return (
    <div className="h-full border-y border-[#c9d7e3] bg-[#f2f8fd] px-3 py-2">
      <div className="mb-1.5 text-xs font-semibold text-[#0073bb]">
        اقلام سفارش ({fa(items.length)})
      </div>
      <div className="overflow-hidden rounded border border-[#c9d7e3] bg-white">
        <AgGridReact<InvoiceItem>
          theme={gridTheme}
          rowData={items}
          columnDefs={ITEM_COLUMN_DEFS}
          defaultColDef={{ sortable: true, resizable: true, filter: false }}
          getRowId={(p) => p.data.id}
          enableRtl={true}
          domLayout="autoHeight"
          headerHeight={32}
          rowHeight={34}
          suppressCellFocus={true}
        />
      </div>
    </div>
  );
};

const COLUMN_DEFS: ColDef<SalesRow>[] = [
  {
    colId: "expand",
    headerName: "",
    width: 64,
    maxWidth: 72,
    sortable: false,
    filter: false,
    resizable: false,
    pinned: "right",
    cellRenderer: ExpandCellRenderer,
  },
  {
    field: "number",
    headerName: "شماره فاکتور",
    editable: false,
    width: 140,
    filter: "agTextColumnFilter",
  },
  {
    field: "date",
    headerName: "تاریخ",
    editable: false,
    width: 130,
    valueFormatter: (p) => faDate(p.value),
  },
  {
    field: "customerName",
    headerName: "مشتری",
    editable: false,
    flex: 1,
    minWidth: 140,
    filter: "agTextColumnFilter",
    valueFormatter: (p) => (p.value as string) || "—",
  },
  {
    field: "customerPhone",
    headerName: "تلفن",
    editable: false,
    width: 120,
    filter: "agTextColumnFilter",
    valueFormatter: (p) => (p.value as string) || "—",
  },
  {
    field: "source",
    headerName: "منبع",
    editable: false,
    width: 130,
    cellRenderer: (p: ICellRendererParams<SalesRow>) =>
      p.data?.rowType === "master" ? (
        <SourceBadge value={p.data.source} />
      ) : null,
  },
  {
    headerName: "اقلام",
    editable: false,
    width: 80,
    sortable: true,
    valueGetter: (p) =>
      p.data?.rowType === "master" ? (p.data.items?.length ?? 0) : 0,
  },
  {
    field: "subtotal",
    headerName: "جمع اقلام",
    editable: false,
    width: 140,
    sortable: true,
    valueFormatter: (p) =>
      p.data?.rowType === "master"
        ? fa(Number(p.value) || 0) + " تومان"
        : "",
  },
  {
    field: "total",
    headerName: "قابل پرداخت",
    editable: false,
    width: 150,
    sortable: true,
    valueFormatter: (p) =>
      p.data?.rowType === "master"
        ? fa(Number(p.value) || 0) + " تومان"
        : "",
  },
  {
    field: "status",
    headerName: "وضعیت",
    editable: false,
    width: 110,
    cellRenderer: (p: ICellRendererParams<SalesRow>) =>
      p.data?.rowType === "master" ? (
        <StatusBadge value={p.data.status} />
      ) : null,
  },
  {
    headerName: "عملیات",
    cellRenderer: ActionCellRenderer,
    sortable: false,
    filter: false,
    width: 300,
    editable: false,
    resizable: false,
  },
];

const DEFAULT_COL_DEF: ColDef<SalesRow> = {
  sortable: true,
  resizable: true,
  filter: true,
};

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

function buildSalesRows(
  invoices: Invoice[],
  expandedIds: Set<string>,
): SalesRow[] {
  const rows: SalesRow[] = [];
  for (const inv of invoices) {
    rows.push({ ...inv, rowType: "master" });
    if (expandedIds.has(inv.id)) {
      rows.push({
        rowType: "detail",
        id: `${inv.id}__detail`,
        parentId: inv.id,
        items: inv.items ?? [],
      });
    }
  }
  return rows;
}

export default function SalesPage() {
  const router = useRouter();
  const gridRef = useRef<AgGridReact<SalesRow>>(null);
  const { startPrint, printPortal } = useInvoicePrint();
  const [rowData, setRowData] = useState<Invoice[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
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

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleEdit = useCallback(
    (id: string) => router.push(`/sales/${id}`),
    [router],
  );

  const handlePrint = useCallback(
    (id: string) => void startPrint({ invoiceId: id, mode: "invoice" }),
    [startPrint],
  );

  const handleLabel = useCallback(
    (id: string) => void startPrint({ invoiceId: id, mode: "label" }),
    [startPrint],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm("آیا از حذف این فاکتور مطمئن هستید؟")) return;
      await deleteInvoice(id);
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await fetchFromServer(filters);
    },
    [fetchFromServer, filters],
  );

  const getRowId = useCallback((p: GetRowIdParams<SalesRow>) => p.data.id, []);

  const isFullWidthRow = useCallback(
    (p: IsFullWidthRowParams<SalesRow>) => p.rowNode.data?.rowType === "detail",
    [],
  );

  const getRowHeight = useCallback((p: RowHeightParams<SalesRow>) => {
    if (p.data?.rowType !== "detail") return 40;
    const n = p.data.items?.length ?? 0;
    if (n === 0) return 56;
    return Math.min(320, 56 + 32 + n * 34);
  }, []);

  const gridRows = useMemo(
    () => buildSalesRows(rowData, expandedIds),
    [rowData, expandedIds],
  );

  const gridCtx: GridCtx = {
    handleEdit,
    handlePrint,
    handleLabel,
    handleDelete,
    expandedIds,
    toggleExpand,
  };

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
      {printPortal}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#16191f]">فاکتورها</h1>
          <p className="mt-0.5 text-sm text-[#545b64]">
            مجموع فروش تأیید‌شده
            {hasActiveFilters ? " (فیلتر‌شده)" : ""}
            :{" "}
            <span className="font-semibold text-[#1d8102]">
              {fa(confirmedTotal)} تومان
            </span>
            {loading ? (
              <span className="mr-2 text-xs text-[#879596]">
                در حال بارگذاری…
              </span>
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

      <div
        className="overflow-hidden rounded border border-[#d5dbdb] shadow-sm"
        style={{ height: 540 }}
      >
        <AgGridReact<SalesRow>
          ref={gridRef}
          theme={gridTheme}
          rowData={gridRows}
          columnDefs={COLUMN_DEFS}
          defaultColDef={DEFAULT_COL_DEF}
          getRowId={getRowId}
          enableRtl={true}
          pagination={true}
          paginationPageSize={20}
          animateRows={true}
          context={gridCtx}
          noRowsOverlayComponent={NoRowsOverlay}
          isFullWidthRow={isFullWidthRow}
          fullWidthCellRenderer={OrderItemsDetail}
          getRowHeight={getRowHeight}
          embedFullWidthRows={true}
        />
      </div>
      <p className="text-xs text-[#879596]">
        {rowData.length} فاکتور
        {hasActiveFilters ? " (نتیجه فیلتر سرور)" : " ثبت‌شده"}
        {" — "}
        برای دیدن اقلام، روی ▸ کنار هر ردیف کلیک کنید.
      </p>
    </div>
  );
}
