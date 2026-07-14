"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type CellValueChangedEvent,
  type CellKeyDownEvent,
  type CellFocusedEvent,
  type CellEditingStoppedEvent,
  type GetRowIdParams,
  type ICellRendererParams,
  type ValueGetterParams,
  themeQuartz,
} from "ag-grid-community";
import type { ProductAttribute, ProductVariant } from "@/lib/products";

ModuleRegistry.registerModules([AllCommunityModule]);

/* ─── Theme ──────────────────────────────────────────────────────── */
const gridTheme = themeQuartz.withParams({
  fontFamily: "inherit",
  fontSize: 14,
  rowHeight: 56,
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

/* ─── Types ──────────────────────────────────────────────────────── */
type GridCtx = {
  handleDelete: (id: string) => void;
};
type GridRef = AgGridReact<ProductVariant>;

/* ─── Static helpers ────────────────────────────────────────────────────── */
const NoRowsOverlay = () => (
  <p className="text-sm text-[#545b64]">هنوز ترکیبی تعریف نشده.</p>
);

const ActionCellRenderer = ({ data, context }: ICellRendererParams) => {
  const ctx = context as GridCtx;
  const v = data as ProductVariant;
  return (
    <div className="flex h-full items-center">
      <button
        onClick={() => ctx.handleDelete(v.id)}
        className="rounded border border-[#d13212] bg-white px-2.5 py-1 text-xs font-medium text-[#d13212] hover:bg-[#fdf3f1] transition active:scale-95"
      >
        حذف
      </button>
    </div>
  );
};

const isEmptyVariant = (v: ProductVariant) =>
  v.sku === "" &&
  v.price === 0 &&
  v.salePrice === 0 &&
  v.quantity === 0;

/* ─── Props ──────────────────────────────────────────────────────────────── */
type Props = {
  variants: ProductVariant[];
  attributes: ProductAttribute[];
  onChange: (variants: ProductVariant[]) => void;
};

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function VariantsGrid({
  variants,
  attributes,
  onChange,
}: Props) {
  const gridRef = useRef<GridRef>(null);
  const dataRef = useRef<ProductVariant[]>(variants);
  const draftRowIdsRef = useRef<Set<string>>(new Set());
  const lastFocusedRowIdRef = useRef<string | null>(null);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localVariants, setLocalVariants] =
    useState<ProductVariant[]>(variants);

  useEffect(() => {
    dataRef.current = variants;
    setLocalVariants([...variants]);
  }, [variants]);

  const commit = useCallback(
    (next: ProductVariant[]) => {
      dataRef.current = next;
      setLocalVariants([...next]);
      onChange(next);
    },
    [onChange],
  );

  const cleanupEmptyDraft = useCallback(
    (id: string) => {
      if (!draftRowIdsRef.current.has(id)) return;
      const v = dataRef.current.find((x) => x.id === id);
      if (!v) return;
      draftRowIdsRef.current.delete(id);
      if (isEmptyVariant(v)) commit(dataRef.current.filter((x) => x.id !== id));
    },
    [commit],
  );

  const columnDefs = useMemo<ColDef<ProductVariant>[]>(() => {
    const attrCols: ColDef<ProductVariant>[] = attributes.map((attr) => ({
      colId: `attr-${attr.id}`,
      headerName: attr.name,
      valueGetter: (p: ValueGetterParams<ProductVariant>) =>
        p.data?.attributeValues[attr.id] ?? "",
      editable: false,
      flex: 1,
      minWidth: 100,
      sortable: true,
      resizable: true,
      filter: "agTextColumnFilter",
    }));

    return [
      ...attrCols,
      {
        field: "sku",
        headerName: "کد / SKU",
        editable: true,
        flex: 1,
        minWidth: 110,
        sortable: true,
        resizable: true,
        filter: "agTextColumnFilter",
      },
      {
        field: "price",
        headerName: "قیمت خرید",
        editable: true,
        flex: 1,
        minWidth: 140,
        sortable: true,
        resizable: true,
        filter: "agNumberColumnFilter",
        valueFormatter: (p) =>
          p.value != null ? Number(p.value).toLocaleString("fa-IR") : "",
        valueParser: (p) => Number(p.newValue) || 0,
      },
      {
        field: "salePrice",
        headerName: "قیمت فروش",
        editable: true,
        flex: 1,
        minWidth: 140,
        sortable: true,
        resizable: true,
        filter: "agNumberColumnFilter",
        valueFormatter: (p) =>
          p.value != null ? Number(p.value).toLocaleString("fa-IR") : "",
        valueParser: (p) => Number(p.newValue) || 0,
      },
      {
        field: "quantity",
        headerName: "تعداد",
        editable: true,
        flex: 1,
        minWidth: 100,
        sortable: true,
        resizable: true,
        filter: "agNumberColumnFilter",
        valueFormatter: (p) =>
          p.value != null ? Number(p.value).toLocaleString("fa-IR") : "",
        valueParser: (p) => Number(p.newValue) || 0,
        suppressKeyboardEvent: ({ event, editing }) =>
          editing &&
          !event.shiftKey &&
          (event.key === "Tab" || event.key === "Enter"),
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
  }, [attributes]);

  const handleDelete = useCallback(
    (id: string) => {
      if (!window.confirm("آیا از حذف این ترکیب مطمئن هستید؟")) return;
      draftRowIdsRef.current.delete(id);
      commit(dataRef.current.filter((v) => v.id !== id));
    },
    [commit],
  );

  const handleAddRow = useCallback(() => {
    const fresh: ProductVariant = {
      id: crypto.randomUUID(),
      sku: "",
      price: 0,
      salePrice: 0,
      quantity: 0,
      attributeValues: {},
    };
    draftRowIdsRef.current.add(fresh.id);
    commit([...dataRef.current, fresh]);
    setTimeout(() => {
      const api = gridRef.current?.api;
      if (!api) return;
      const node = api.getRowNode(fresh.id);
      if (node && node.rowIndex !== null) {
        api.ensureNodeVisible(node, "bottom");
        api.startEditingCell({ rowIndex: node.rowIndex, colKey: "sku" });
      }
    }, 80);
  }, [commit]);

  const onCellValueChanged = useCallback(
    (e: CellValueChangedEvent<ProductVariant>) => {
      const updated = { ...e.data } as ProductVariant;
      updated.price = Number(updated.price) || 0;
      updated.quantity = Number(updated.quantity) || 0;
      commit(dataRef.current.map((v) => (v.id === updated.id ? updated : v)));
    },
    [commit],
  );

  const onCellKeyDown = useCallback(
    (e: CellKeyDownEvent<ProductVariant>) => {
      const event = e.event as KeyboardEvent;
      if ((event?.key !== "Tab" && event?.key !== "Enter") || event?.shiftKey)
        return;
      if (e.column.getColId() !== "quantity") return;

      e.api.stopEditing();

      const fresh: ProductVariant = {
        id: crypto.randomUUID(),
        sku: "",
        price: 0,
        salePrice: 0,
        quantity: 0,
        attributeValues: {},
      };
      draftRowIdsRef.current.add(fresh.id);
      commit([...dataRef.current, fresh]);

      setTimeout(() => {
        const api = gridRef.current?.api;
        if (!api) return;
        const node = api.getRowNode(fresh.id);
        if (node && node.rowIndex !== null) {
          api.ensureNodeVisible(node, "bottom");
          api.startEditingCell({ rowIndex: node.rowIndex, colKey: "sku" });
        }
      }, 80);
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
                | ProductVariant
                | undefined
            )?.id ?? null)
          : null;
      const prevId = lastFocusedRowIdRef.current;
      lastFocusedRowIdRef.current = newId;
      if (prevId && prevId !== newId) cleanupEmptyDraft(prevId);
    },
    [cleanupEmptyDraft],
  );

  const onCellEditingStopped = useCallback(
    (e: CellEditingStoppedEvent<ProductVariant>) => {
      const id = (e.data as ProductVariant | undefined)?.id;
      if (!id || !draftRowIdsRef.current.has(id)) return;
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = setTimeout(() => {
        cleanupTimerRef.current = null;
        cleanupEmptyDraft(id);
      }, 200);
    },
    [cleanupEmptyDraft],
  );

  const getRowId = useCallback(
    (p: GetRowIdParams<ProductVariant>) => p.data.id,
    [],
  );

  const defaultColDef = useMemo<ColDef<ProductVariant>>(
    () => ({ sortable: true, resizable: true, filter: true }),
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#545b64]">
          {localVariants.length} ترکیب
        </span>
        <button
          onClick={handleAddRow}
          className="flex items-center gap-1 rounded border border-dashed border-[#aab7b8] bg-white px-3 py-1.5 text-sm text-[#545b64] hover:border-[#0073bb] hover:text-[#0073bb] transition"
        >
          + افزودن ترکیب دستی
        </button>
      </div>

      <div
        className="overflow-hidden rounded border border-[#d5dbdb] shadow-sm"
        style={{ height: 340 }}
      >
        <AgGridReact<ProductVariant>
          ref={gridRef}
          theme={gridTheme}
          rowData={localVariants}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          onCellValueChanged={onCellValueChanged}
          onCellKeyDown={onCellKeyDown}
          onCellFocused={onCellFocused}
          onCellEditingStopped={onCellEditingStopped}
          enableRtl={true}
          animateRows={true}
          context={{ handleDelete } satisfies GridCtx}
          noRowsOverlayComponent={NoRowsOverlay}
        />
      </div>
    </div>
  );
}
