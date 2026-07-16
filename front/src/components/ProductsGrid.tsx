"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type CellValueChangedEvent,
  type CellFocusedEvent,
  type CellEditingStoppedEvent,
  type GetRowIdParams,
  type ICellRendererParams,
  themeQuartz,
} from "ag-grid-community";
import {
  cloneProductForCreate,
  deleteProduct,
  getProducts,
  saveProducts,
  productPriceRange,
  productTotalStock,
  type Product,
} from "@/lib/products";

ModuleRegistry.registerModules([AllCommunityModule]);

/* ─── Theme ──────────────────────────────────────────────────────────────── */
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

/* ─── Types ──────────────────────────────────────────────────────────────── */
type GridCtx = {
  handleEdit: (id: string) => void;
  handleDuplicate: (product: Product) => void;
  handleDelete: (id: string) => void;
};
type GridRef = AgGridReact<Product>;

/* ─── Static helpers ────────────────────────────────────────────────────── */
const NoRowsOverlay = () => (
  <p className="text-sm text-[#545b64]">هیچ محصولی ثبت نشده است.</p>
);

const ActionCellRenderer = ({ data, context }: ICellRendererParams) => {
  const ctx = context as GridCtx;
  const p = data as Product;
  return (
    <div className="flex h-full items-center gap-1.5">
      <button
        onClick={() => ctx.handleEdit(p.id)}
        className="rounded border border-[#0073bb] bg-white px-2.5 py-1 text-xs font-medium text-[#0073bb] hover:bg-[#e7f2f8] transition active:scale-95"
      >
        ویرایش
      </button>
      <button
        onClick={() => ctx.handleDuplicate(p)}
        className="rounded border border-[#aab7b8] bg-white px-2.5 py-1 text-xs font-medium text-[#545b64] hover:bg-[#f2f3f3] transition active:scale-95"
      >
        کپی
      </button>
      <button
        onClick={() => ctx.handleDelete(p.id)}
        className="rounded border border-[#d13212] bg-white px-2.5 py-1 text-xs font-medium text-[#d13212] hover:bg-[#fdf3f1] transition active:scale-95"
      >
        حذف
      </button>
    </div>
  );
};

const COLUMN_DEFS: ColDef<Product>[] = [
  {
    checkboxSelection: true,
    headerCheckboxSelection: true,
    width: 52,
    sortable: false,
    filter: false,
    editable: false,
    resizable: false,
  },
  {
    field: "name",
    headerName: "نام محصول",
    editable: true,
    flex: 2,
    minWidth: 160,
    filter: "agTextColumnFilter",
    filterParams: { buttons: ["reset", "apply"] },
  },
  {
    headerName: "تعداد ترکیب‌ها",
    valueGetter: (p) => p.data?.variants.length ?? 0,
    editable: false,
    width: 140,
    sortable: true,
    resizable: true,
    filter: "agNumberColumnFilter",
    valueFormatter: (p) => Number(p.value).toLocaleString("fa-IR"),
  },
  {
    headerName: "بازه قیمت خرید (تومان)",
    valueGetter: (p) => (p.data ? productPriceRange(p.data) : "—"),
    editable: false,
    flex: 1.5,
    minWidth: 180,
    sortable: false,
    resizable: true,
    filter: false,
  },
  {
    headerName: "موجودی کل",
    valueGetter: (p) => (p.data ? productTotalStock(p.data) : 0),
    editable: false,
    width: 120,
    sortable: true,
    resizable: true,
    filter: "agNumberColumnFilter",
    valueFormatter: (p) => Number(p.value).toLocaleString("fa-IR"),
  },
  {
    headerName: "عملیات",
    cellRenderer: ActionCellRenderer,
    sortable: false,
    filter: false,
    width: 190,
    editable: false,
    resizable: false,
  },
];

const DEFAULT_COL_DEF: ColDef<Product> = {
  sortable: true,
  resizable: true,
  filter: true,
};

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function ProductsGrid() {
  const router = useRouter();
  const gridRef = useRef<GridRef>(null);
  const dataRef = useRef<Product[]>([]);
  const lastFocusedRowIdRef = useRef<string | null>(null);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rowData, setRowData] = useState<Product[]>([]);
  const [quickFilter, setQuickFilter] = useState("");
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const products = await getProducts();
      dataRef.current = products;
      setRowData(products);
    };
    void load();
  }, []);

  const commit = useCallback((next: Product[]) => {
    dataRef.current = next;
    void saveProducts(next);
    setRowData([...next]);
  }, []);

  const handleEdit = useCallback(
    (id: string) => router.push(`/products/manage/${id}`),
    [router],
  );

  const handleNewProduct = useCallback(
    () => router.push("/products/manage/new"),
    [router],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (!window.confirm("آیا از حذف این محصول مطمئن هستید؟")) return;
      void deleteProduct(id);
      commit(dataRef.current.filter((p) => p.id !== id));
    },
    [commit],
  );

  const handleDeleteSelected = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;
    const selected = api.getSelectedRows() as Product[];
    if (selected.length === 0) {
      alert("ابتدا ردیف‌هایی را انتخاب کنید.");
      return;
    }
    if (!window.confirm(`حذف ${selected.length} محصول انتخاب‌شده؟`)) return;
    const ids = new Set(selected.map((r) => r.id));
    await Promise.all(Array.from(ids).map((id) => deleteProduct(id)));
    const next = dataRef.current.filter((p) => !ids.has(p.id));
    commit(next);
  }, [commit]);

  const handleDuplicate = useCallback(
    (product: Product) => {
      const copy = cloneProductForCreate(product);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("accounting-product-copy", JSON.stringify(copy));
      }
      router.push("/products/manage/new?copy=1");
    },
    [router],
  );

  const onCellValueChanged = useCallback(
    (e: CellValueChangedEvent<Product>) => {
      const updated = { ...e.data } as Product;
      commit(dataRef.current.map((p) => (p.id === updated.id ? updated : p)));
    },
    [commit],
  );

  const onCellFocused = useCallback(
    (e: CellFocusedEvent) => {
      const api = gridRef.current?.api;
      if (!api) return;
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
      const newId: string | null =
        e.rowIndex !== null && e.rowIndex !== undefined
          ? ((
              api.getDisplayedRowAtIndex(e.rowIndex)?.data as
                | Product
                | undefined
            )?.id ?? null)
          : null;
      const prevId = lastFocusedRowIdRef.current;
      lastFocusedRowIdRef.current = newId;
      if (prevId && prevId !== newId) {
        const prev = dataRef.current.find((p) => p.id === prevId);
        if (prev && !prev.name.trim()) {
          void deleteProduct(prevId);
          commit(dataRef.current.filter((p) => p.id !== prevId));
        }
      }
    },
    [commit],
  );

  const onCellEditingStopped = useCallback(
    (e: CellEditingStoppedEvent<Product>) => {
      const id = (e.data as Product | undefined)?.id;
      if (!id) return;
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = setTimeout(() => {
        cleanupTimerRef.current = null;
        const p = dataRef.current.find((x) => x.id === id);
        if (p && !p.name.trim()) {
          void deleteProduct(id);
          commit(dataRef.current.filter((x) => x.id !== id));
        }
      }, 200);
    },
    [commit],
  );

  const handleExport = useCallback(
    () => gridRef.current?.api?.exportDataAsCsv({ fileName: "products.csv" }),
    [],
  );

  const onSelectionChanged = useCallback(() => {
    setSelectedCount(gridRef.current?.api?.getSelectedRows()?.length ?? 0);
  }, []);

  const getRowId = useCallback((p: GetRowIdParams<Product>) => p.data.id, []);

  const gridCtx: GridCtx = { handleEdit, handleDuplicate, handleDelete };

  return (
    <div className="flex w-full flex-col gap-4 p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#16191f]">مدیریت محصولات</h1>
          <p className="mt-0.5 text-sm text-[#545b64]">
            «ویرایش» برای تعریف ویژگی‌ها و قیمت‌گذاری ترکیب‌ها
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="جستجو…"
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            className="w-44 rounded border border-[#aab7b8] bg-white px-3 py-2 text-sm text-[#16191f] placeholder:text-[#879596] outline-none focus:border-[#0073bb] focus:ring-1 focus:ring-[#0073bb]"
          />
          <button
            onClick={handleNewProduct}
            className="flex items-center gap-1.5 rounded bg-[#ec7211] px-4 py-2 text-sm font-medium text-white hover:bg-[#eb5f07] transition"
          >
            + محصول جدید
          </button>
          <button
            onClick={() => void handleDeleteSelected()}
            disabled={selectedCount === 0}
            className="rounded border border-[#d13212] bg-white px-4 py-2 text-sm font-medium text-[#d13212] hover:bg-[#fdf3f1] disabled:cursor-not-allowed disabled:opacity-40 transition"
          >
            {selectedCount > 0
              ? `حذف ${selectedCount} انتخاب‌شده`
              : "حذف انتخاب‌شده‌ها"}
          </button>
          <button
            onClick={handleExport}
            className="rounded border border-[#aab7b8] bg-white px-4 py-2 text-sm font-medium text-[#16191f] hover:bg-[#f2f3f3] transition"
          >
            خروجی CSV
          </button>
        </div>
      </div>

      {/* Grid */}
      <div
        className="overflow-hidden rounded border border-[#d5dbdb] shadow-sm"
        style={{ height: 560 }}
      >
        <AgGridReact<Product>
          ref={gridRef}
          theme={gridTheme}
          rowData={rowData}
          columnDefs={COLUMN_DEFS}
          defaultColDef={DEFAULT_COL_DEF}
          getRowId={getRowId}
          onCellValueChanged={onCellValueChanged}
          onCellFocused={onCellFocused}
          onCellEditingStopped={onCellEditingStopped}
          rowSelection="multiple"
          onSelectionChanged={onSelectionChanged}
          quickFilterText={quickFilter}
          enableRtl={true}
          pagination={true}
          paginationPageSize={15}
          paginationPageSizeSelector={[10, 15, 25, 50]}
          animateRows={true}
          context={gridCtx}
          noRowsOverlayComponent={NoRowsOverlay}
        />
      </div>

      <p className="text-xs text-[#879596]">
        {rowData.length} محصول ثبت‌شده
        {selectedCount > 0 && ` · ${selectedCount} انتخاب‌شده`}
      </p>
    </div>
  );
}
