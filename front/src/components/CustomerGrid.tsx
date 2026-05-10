"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  deleteCustomer,
  getCustomers,
  saveCustomers,
  type Customer,
} from "@/lib/customers";

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

type GridCtx = { handleDelete: (id: string) => void };
type GridRef = AgGridReact<Customer>;

const NoRowsOverlay = () => (
  <p className="text-sm text-[#545b64]">هیچ مشتری‌ای ثبت نشده است.</p>
);

const ActionCellRenderer = ({ data, context }: ICellRendererParams) => {
  const ctx = context as GridCtx;
  const c = data as Customer;
  return (
    <div className="flex h-full items-center">
      <button
        onClick={() => ctx.handleDelete(c.id)}
        className="rounded border border-[#d13212] bg-white px-2.5 py-1 text-xs font-medium text-[#d13212] hover:bg-[#fdf3f1] transition"
      >
        حذف
      </button>
    </div>
  );
};

const COLUMN_DEFS: ColDef<Customer>[] = [
  {
    field: "name",
    headerName: "نام",
    editable: true,
    flex: 1.5,
    minWidth: 140,
    filter: "agTextColumnFilter",
  },
  {
    field: "phone",
    headerName: "تلفن",
    editable: true,
    flex: 1,
    minWidth: 120,
    filter: "agTextColumnFilter",
  },
  {
    field: "address",
    headerName: "آدرس",
    editable: true,
    flex: 2,
    minWidth: 160,
    filter: "agTextColumnFilter",
  },
  {
    field: "notes",
    headerName: "یادداشت",
    editable: true,
    flex: 1.5,
    minWidth: 140,
    filter: "agTextColumnFilter",
  },
  {
    headerName: "عملیات",
    cellRenderer: ActionCellRenderer,
    sortable: false,
    filter: false,
    width: 90,
    editable: false,
    resizable: false,
  },
];

const DEFAULT_COL_DEF: ColDef<Customer> = {
  sortable: true,
  resizable: true,
  filter: true,
};

export default function CustomerGrid() {
  const gridRef = useRef<GridRef>(null);
  const dataRef = useRef<Customer[]>([]);
  const lastFocusedRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rowData, setRowData] = useState<Customer[]>([]);
  const [quickFilter, setQuickFilter] = useState("");
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const cs = await getCustomers();
      const arr = Array.isArray(cs) ? cs : [];
      dataRef.current = arr;
      setRowData(arr);
    };
    void load();
  }, []);

  const commit = useCallback((next: Customer[]) => {
    dataRef.current = next;
    void saveCustomers(next);
    setRowData([...next]);
  }, []);

  const cleanupEmpty = useCallback(
    (id: string) => {
      const c = dataRef.current.find((x) => x.id === id);
      if (c && !c.name.trim()) {
        void deleteCustomer(id);
        commit(dataRef.current.filter((x) => x.id !== id));
      }
    },
    [commit],
  );

  const handleAddRow = useCallback(() => {
    const fresh: Customer = {
      id: crypto.randomUUID(),
      name: "",
      phone: "",
      address: "",
      notes: "",
    };
    const next = [fresh, ...dataRef.current];
    commit(next);
    setTimeout(() => {
      gridRef.current?.api?.startEditingCell({ rowIndex: 0, colKey: "name" });
    }, 80);
  }, [commit]);

  const handleDelete = useCallback(
    (id: string) => {
      if (!window.confirm("آیا از حذف این مشتری مطمئن هستید؟")) return;
      void deleteCustomer(id);
      commit(dataRef.current.filter((c) => c.id !== id));
    },
    [commit],
  );

  const handleDeleteSelected = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;
    const selected = api.getSelectedRows() as Customer[];
    if (!selected.length) {
      alert("ابتدا ردیف‌هایی را انتخاب کنید.");
      return;
    }
    if (!window.confirm(`حذف ${selected.length} مشتری؟`)) return;
    const ids = new Set(selected.map((r) => r.id));
    await Promise.all(Array.from(ids).map((id) => deleteCustomer(id)));
    commit(dataRef.current.filter((c) => !ids.has(c.id)));
  }, [commit]);

  const onCellValueChanged = useCallback(
    (e: CellValueChangedEvent<Customer>) => {
      const updated = { ...e.data } as Customer;
      commit(dataRef.current.map((c) => (c.id === updated.id ? updated : c)));
    },
    [commit],
  );

  const onCellFocused = useCallback(
    (e: CellFocusedEvent) => {
      const api = gridRef.current?.api;
      if (!api) return;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const newId =
        e.rowIndex !== null && e.rowIndex !== undefined
          ? ((
              api.getDisplayedRowAtIndex(e.rowIndex)?.data as
                | Customer
                | undefined
            )?.id ?? null)
          : null;
      const prevId = lastFocusedRef.current;
      lastFocusedRef.current = newId;
      if (prevId && prevId !== newId) cleanupEmpty(prevId);
    },
    [cleanupEmpty],
  );

  const onCellEditingStopped = useCallback(
    (e: CellEditingStoppedEvent<Customer>) => {
      const id = (e.data as Customer | undefined)?.id;
      if (!id) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        cleanupEmpty(id);
      }, 200);
    },
    [cleanupEmpty],
  );

  const getRowId = useCallback((p: GetRowIdParams<Customer>) => p.data.id, []);

  return (
    <div className="flex w-full flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#16191f]">مشتریان</h1>
          <p className="mt-0.5 text-sm text-[#545b64]">
            برای ویرایش روی سلول کلیک کنید
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
            onClick={handleAddRow}
            className="rounded bg-[#ec7211] px-4 py-2 text-sm font-medium text-white hover:bg-[#eb5f07] transition"
          >
            + مشتری جدید
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
        </div>
      </div>

      <div
        className="overflow-hidden rounded border border-[#d5dbdb] shadow-sm"
        style={{ height: 520 }}
      >
        <AgGridReact<Customer>
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
          onSelectionChanged={() =>
            setSelectedCount(
              gridRef.current?.api?.getSelectedRows()?.length ?? 0,
            )
          }
          quickFilterText={quickFilter}
          enableRtl={true}
          pagination={true}
          paginationPageSize={20}
          animateRows={true}
          context={{ handleDelete } satisfies GridCtx}
          noRowsOverlayComponent={NoRowsOverlay}
        />
      </div>
      <p className="text-xs text-[#879596]">
        {rowData.length} مشتری ثبت‌شده
        {selectedCount > 0 && ` · ${selectedCount} انتخاب‌شده`}
      </p>
    </div>
  );
}
