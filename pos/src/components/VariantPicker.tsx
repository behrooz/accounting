import { useEffect, useMemo, useState } from "react";
import {
  productMinPrice,
  productStock,
  variantLabel,
  variantSellPrice,
  type Product,
  type ProductVariant,
} from "../lib/products";
import { formatToman } from "../lib/invoices";
import { mediaUrl } from "../lib/config";

type Props = {
  product: Product;
  onClose: () => void;
  onPick: (variant: ProductVariant) => void;
};

export default function VariantPicker({ product, onClose, onPick }: Props) {
  const variants = product.variants || [];
  const attrs = product.attributes || [];
  const [selected, setSelected] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const attr of attrs) {
      const firstInStock = variants.find((v) => {
        const label = v.attributeValues?.[attr.id];
        return label && (Number(v.quantity) || 0) > 0;
      });
      if (firstInStock?.attributeValues?.[attr.id]) {
        initial[attr.id] = firstInStock.attributeValues[attr.id];
      } else if (attr.options[0]?.label) {
        initial[attr.id] = attr.options[0].label;
      }
    }
    setSelected(initial);
  }, [product.id]);

  const matched = useMemo(() => {
    return variants.find((v) =>
      attrs.every((a) => (v.attributeValues?.[a.id] || "") === (selected[a.id] || "")),
    );
  }, [variants, attrs, selected]);

  const canAdd = matched && (Number(matched.quantity) || 0) > 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{product.name}</h2>
          <button type="button" className="icon-x" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="modal-body">
          {attrs.map((attr) => (
            <div key={attr.id} className="attr-block">
              <p className="attr-name">{attr.name}</p>
              <div className="chip-row">
                {attr.options.map((opt) => {
                  const anyStock = variants.some(
                    (v) =>
                      v.attributeValues?.[attr.id] === opt.label &&
                      (Number(v.quantity) || 0) > 0,
                  );
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!anyStock}
                      className={
                        "chip" +
                        (selected[attr.id] === opt.label ? " is-active" : "") +
                        (!anyStock ? " is-oos" : "")
                      }
                      onClick={() =>
                        setSelected((s) => ({ ...s, [attr.id]: opt.label }))
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {!attrs.length && (
            <div className="simple-variants">
              {variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="chip"
                  disabled={(Number(v.quantity) || 0) <= 0}
                  onClick={() => onPick(v)}
                >
                  {variantLabel(v)} · {formatToman(variantSellPrice(v))} · موجودی{" "}
                  {v.quantity}
                </button>
              ))}
            </div>
          )}

          {matched && (
            <p className="variant-meta">
              قیمت: <strong>{formatToman(variantSellPrice(matched))}</strong>
              {" · "}
              موجودی: {matched.quantity}
              {matched.sku ? ` · SKU: ${matched.sku}` : ""}
            </p>
          )}
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose}>
            انصراف
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!canAdd || !matched}
            onClick={() => matched && onPick(matched)}
          >
            افزودن به سبد
          </button>
        </footer>
      </div>
    </div>
  );
}

export function ProductCard({
  product,
  onSelect,
}: {
  product: Product;
  onSelect: (p: Product) => void;
}) {
  const stock = productStock(product);
  const price = productMinPrice(product);
  const img =
    mediaUrl(product.images?.[0]) ||
    mediaUrl(product.variants?.find((v) => v.image)?.image) ||
    "";

  return (
    <button
      type="button"
      className={"product-tile" + (stock <= 0 ? " is-oos" : "")}
      disabled={stock <= 0}
      onClick={() => onSelect(product)}
    >
      <div className="product-tile-img">
        {img ? <img src={img} alt="" /> : <span>بدون تصویر</span>}
      </div>
      <div className="product-tile-body">
        <strong>{product.name}</strong>
        <span>{formatToman(price)}</span>
        <span className="stock-line">
          {stock > 0 ? `موجودی ${stock.toLocaleString("fa-IR")}` : "ناموجود"}
        </span>
      </div>
    </button>
  );
}
