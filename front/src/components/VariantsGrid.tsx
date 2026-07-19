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
import { mediaUrl, uploadProductImage } from "@/lib/media";

ModuleRegistry.registerModules([AllCommunityModule]);

/* ─── Theme ──────────────────────────────────────────────────────── */
const gridTheme = themeQuartz.withParams({
  fontFamily: "inherit",
  fontSize: 14,
  rowHeight: 56,
  headerHeight: 52,
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
type ApplyField = "price" | "salePrice" | "quantity";

type GridCtx = {
  handleDelete: (id: string) => void;
  handleImageChange: (id: string, image: string) => void;
  applyFieldToAll: (field: ApplyField) => void;
  getLastFieldValue: (field: ApplyField) => number | undefined;
};
type GridRef = AgGridReact<ProductVariant>;

/* ─── Static helpers ────────────────────────────────────────────────────── */
const NoRowsOverlay = () => (
  <p className="text-sm text-[#545b64]">هنوز ترکیبی تعریف نشده.</p>
);

const ImageCellRenderer = ({ data, context }: ICellRendererParams) => {
  const v = data as ProductVariant;
  const ctx = context as GridCtx;

  const openPicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const uploaded = await uploadProductImage(file);
        ctx.handleImageChange(v.id, uploaded.path);
      } catch (err) {
        alert(err instanceof Error ? err.message : "آپلود تصویر ناموفق بود.");
      }
    };
    input.click();
  };

  const src = mediaUrl(v.image);

  return (
    <div className="flex h-full items-center justify-center">
      <button
        onClick={openPicker}
        title="کلیک برای آپلود / تغییر تصویر"
        className="group relative flex h-10 w-10 items-center justify-center overflow-hidden rounded border border-dashed border-[#aab7b8] bg-[#f2f3f3] hover:border-[#0073bb] transition"
      >
        {src ? (
          <>
            <img src={src} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition text-white text-[10px]">
              تغییر
            </span>
          </>
        ) : (
          <span className="text-[#aab7b8] text-lg group-hover:text-[#0073bb] transition select-none">
            &#128247;
          </span>
        )}
      </button>
    </div>
  );
};

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

/** Header with title + "اعمال برای همه" for price / salePrice / quantity */
function ApplyAllHeader(props: {
  displayName: string;
  column: { getColId: () => string };
  context: GridCtx;
}) {
  const field = props.column.getColId() as ApplyField;
  const last = props.context.getLastFieldValue(field);
  return (
    <div className="flex h-full flex-col items-stretch justify-center gap-1 px-0.5 py-0.5">
      <span className="text-xs font-semibold leading-tight text-[#16191f]">
        {props.displayName}
      </span>
      <button
        type="button"
        title={
          last === undefined
            ? "ابتدا یک مقدار در این ستون وارد کنید"
            : `آخرین مقدار: ${last.toLocaleString("fa-IR")} — برای همه اعمال شود`
        }
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          props.context.applyFieldToAll(field);
        }}
        className="rounded border border-[#0073bb] bg-white px-1 py-0.5 text-[10px] font-medium leading-tight text-[#0073bb] hover:bg-[#e7f2f8] transition"
      >
        اعمال برای همه
      </button>
    </div>
  );
}

const isEmptyVariant = (v: ProductVariant) =>
  v.sku === "" &&
  v.price === 0 &&
  v.salePrice === 0 &&
  v.quantity === 0 &&
  !v.image;

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
  const lastFieldValuesRef = useRef<Partial<Record<ApplyField, number>>>({});
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

  const handleImageChange = useCallback(
    (id: string, image: string) => {
      commit(dataRef.current.map((v) => (v.id === id ? { ...v, image } : v)));
    },
    [commit],
  );

  const getLastFieldValue = useCallback(
    (field: ApplyField) => lastFieldValuesRef.current[field],
    [],
  );

  const applyFieldToAll = useCallback(
    (field: ApplyField) => {
      const val = lastFieldValuesRef.current[field];
      if (val === undefined) {
        alert(
          "ابتدا یک مقدار در این ستون وارد کنید، بعد «اعمال برای همه» را بزنید.",
        );
        return;
      }
      if (!dataRef.current.length) return;
      commit(
        dataRef.current.map((v) => ({
          ...v,
          [field]: val,
        })),
      );
    },
    [commit],
  );

  const columnDefs = useMemo<ColDef<ProductVariant>[]>(() => {
    const allowImageUpload = attributes.some((a) => !!a.allowImage);

    const imageCol: ColDef<ProductVariant> = {
      headerName: "تصویر",
      cellRenderer: ImageCellRenderer,
      editable: false,
      sortable: false,
      filter: false,
      width: 72,
      resizable: false,
    };

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

    const numericApplyCol = (
      field: ApplyField,
      headerName: string,
      minWidth: number,
      extra?: Partial<ColDef<ProductVariant>>,
    ): ColDef<ProductVariant> => ({
      field,
      headerName,
      headerComponent: ApplyAllHeader,
      editable: true,
      flex: 1,
      minWidth,
      sortable: true,
      resizable: true,
      filter: "agNumberColumnFilter",
      valueFormatter: (p) =>
        p.value != null ? Number(p.value).toLocaleString("fa-IR") : "",
      valueParser: (p) => {
        const raw = String(p.newValue ?? "")
          .trim()
          .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
          .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
          .replace(/,/g, "")
          .replace(/[^\d.-]/g, "");
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
      },
      ...extra,
    });

    return [
      ...(allowImageUpload ? [imageCol] : []),
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
      numericApplyCol("price", "قیمت خرید", 150),
      numericApplyCol("salePrice", "قیمت فروش", 150),
      numericApplyCol("quantity", "تعداد", 120, {
        pinned: "left",
        lockPinned: true,
        suppressKeyboardEvent: ({ event, editing }) =>
          editing &&
          !event.shiftKey &&
          (event.key === "Tab" || event.key === "Enter"),
      }),
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
      updated.salePrice = Number(updated.salePrice) || 0;
      updated.quantity = Number(updated.quantity) || 0;

      const colId = e.column.getColId();
      if (colId === "price" || colId === "salePrice" || colId === "quantity") {
        lastFieldValuesRef.current[colId] = updated[colId];
        gridRef.current?.api?.refreshHeader();
      }

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
                ProductVariant | undefined
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
          context={
            {
              handleDelete,
              handleImageChange,
              applyFieldToAll,
              getLastFieldValue,
            } satisfies GridCtx
          }
          noRowsOverlayComponent={NoRowsOverlay}
        />
      </div>
    </div>
  );
}
