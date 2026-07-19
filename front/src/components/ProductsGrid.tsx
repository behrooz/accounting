"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type IDatasource,
  type ICellRendererParams,
  themeQuartz,
} from "ag-grid-community";
import {
  cloneProductForCreate,
  deleteProduct,
  getProductsPage,
  saveProducts,
  productPriceRange,
  productTotalStock,
  type Product,
} from "@/lib/products";
import {
  getCategories,
  type ProductCategory,
} from "@/lib/categories";

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
  const searchRef = useRef("");
  const categoryRef = useRef("");
  const specificationRef = useRef("");
  const searchMountedRef = useRef(false);
  const lastFocusedRowIdRef = useRef<string | null>(null);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [quickFilter, setQuickFilter] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [specificationFilter, setSpecificationFilter] = useState("");
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [selectedCount, setSelectedCount] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);

  const datasource = useMemo<IDatasource>(
    () => ({
      getRows: async (params) => {
        const limit = params.endRow - params.startRow;
        try {
          const page = await getProductsPage(
            limit,
            params.startRow,
            searchRef.current,
            categoryRef.current,
            specificationRef.current,
          );
          dataRef.current = page.items;
          setTotalProducts(page.total);
          params.successCallback(page.items, page.total);
        } catch {
          params.failCallback();
        }
      },
    }),
    [],
  );

  const commit = useCallback((next: Product[]) => {
    dataRef.current = next;
    void saveProducts(next);
  }, []);

  const refreshGrid = useCallback(() => {
    setSelectedCount(0);
    gridRef.current?.api.purgeInfiniteCache();
  }, []);

  useEffect(() => {
    void getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!searchMountedRef.current) {
      searchMountedRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      searchRef.current = quickFilter.trim();
      categoryRef.current = categoryId;
      specificationRef.current = specificationFilter.trim();
      refreshGrid();
    }, 300);
    return () => clearTimeout(timer);
  }, [quickFilter, categoryId, specificationFilter, refreshGrid]);

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
      void deleteProduct(id).then(refreshGrid);
    },
    [refreshGrid],
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
    refreshGrid();
  }, [refreshGrid]);

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
          void deleteProduct(prevId).then(refreshGrid);
        }
      }
    },
    [refreshGrid],
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
          void deleteProduct(id).then(refreshGrid);
        }
      }, 200);
    },
    [refreshGrid],
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
            placeholder="نام محصول…"
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            className="w-44 rounded border border-[#aab7b8] bg-white px-3 py-2 text-sm text-[#16191f] placeholder:text-[#879596] outline-none focus:border-[#0073bb] focus:ring-1 focus:ring-[#0073bb]"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label="فیلتر دسته‌بندی"
            className="w-44 rounded border border-[#aab7b8] bg-white px-3 py-2 text-sm text-[#16191f] outline-none focus:border-[#0073bb] focus:ring-1 focus:ring-[#0073bb]"
          >
            <option value="">همه دسته‌بندی‌ها</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="ویژگی یا مشخصات…"
            value={specificationFilter}
            onChange={(e) => setSpecificationFilter(e.target.value)}
            className="w-48 rounded border border-[#aab7b8] bg-white px-3 py-2 text-sm text-[#16191f] placeholder:text-[#879596] outline-none focus:border-[#0073bb] focus:ring-1 focus:ring-[#0073bb]"
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
          rowModelType="infinite"
          datasource={datasource}
          cacheBlockSize={10}
          maxBlocksInCache={2}
          columnDefs={COLUMN_DEFS}
          defaultColDef={DEFAULT_COL_DEF}
          getRowId={getRowId}
          onCellValueChanged={onCellValueChanged}
          onCellFocused={onCellFocused}
          onCellEditingStopped={onCellEditingStopped}
          rowSelection="multiple"
          onSelectionChanged={onSelectionChanged}
          enableRtl={true}
          pagination={true}
          paginationPageSize={10}
          paginationPageSizeSelector={false}
          animateRows={true}
          context={gridCtx}
          noRowsOverlayComponent={NoRowsOverlay}
        />
      </div>

      <p className="text-xs text-[#879596]">
        {totalProducts.toLocaleString("fa-IR")} محصول ثبت‌شده
        {selectedCount > 0 && ` · ${selectedCount} انتخاب‌شده`}
      </p>
    </div>
  );
}
