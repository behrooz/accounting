import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { logout, type SessionUser } from "../lib/auth";
import {
  getProduct,
  searchProducts,
  variantLabel,
  variantSellPrice,
  type Product,
  type ProductVariant,
} from "../lib/products";
import {
  formatToman,
  getShopSettings,
  nextInvoiceNumber,
  saveInvoice,
  todayDate,
  type Invoice,
  type InvoiceItem,
  type ShopSettings,
} from "../lib/invoices";
import VariantPicker, { ProductCard } from "./VariantPicker";
import ReceiptView from "./ReceiptView";

type CartLine = InvoiceItem;

type Props = {
  user: SessionUser;
  onLogout: () => void;
};

const PAGE_SIZE = 40;

export default function PosShell({ user, onLogout }: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  const queryRef = useRef("");
  const cartRef = useRef<CartLine[]>([]);
  const submittingRef = useRef(false);
  const [error, setError] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [picker, setPicker] = useState<Product | null>(null);
  const [customerName, setCustomerName] = useState("مشتری حضوری");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Invoice | null>(null);
  const [shop, setShop] = useState<ShopSettings>({
    name: "فروشگاه آبرنگ",
    phone: "",
    address: "",
  });

  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const totalPay = Math.max(0, subtotal - (Number(discount) || 0));
  cartRef.current = cart;

  const loadProducts = useCallback(async (q: string, reset: boolean) => {
    if (reset) {
      setLoading(true);
      offsetRef.current = 0;
    } else {
      setLoadingMore(true);
    }
    setError("");
    try {
      const page = await searchProducts(
        q,
        PAGE_SIZE,
        reset ? 0 : offsetRef.current,
      );
      setTotal(page.total);
      offsetRef.current = (reset ? 0 : offsetRef.current) + page.items.length;
      setHasMore(offsetRef.current < page.total);
      setProducts((prev) => (reset ? page.items : [...prev, ...page.items]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در دریافت محصولات");
      if (reset) setProducts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void getShopSettings().then(setShop);
    void loadProducts("", true);
    searchRef.current?.focus();
  }, [loadProducts]);

  useEffect(() => {
    queryRef.current = query;
    const t = window.setTimeout(() => {
      void loadProducts(query, true);
    }, 280);
    return () => window.clearTimeout(t);
  }, [query, loadProducts]);

  const submitInvoice = useCallback(async () => {
    const lines = cartRef.current;
    if (!lines.length || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const lineSubtotal = lines.reduce((s, i) => s + i.total, 0);
      const disc = Math.max(0, Math.round(Number(discount) || 0));
      const id = crypto.randomUUID();
      const number = await nextInvoiceNumber();
      const invoice: Invoice = {
        id,
        number,
        date: todayDate(),
        customerId: "",
        customerName: customerName.trim() || "مشتری حضوری",
        customerPhone: customerPhone.trim(),
        customerAddress: "",
        items: lines,
        notes: notes.trim(),
        discount: disc,
        subtotal: lineSubtotal,
        total: Math.max(0, lineSubtotal - disc),
        status: "confirmed",
        source: "pos",
        paymentMethod,
        createdAt: new Date().toISOString(),
      };
      await saveInvoice(invoice);
      setReceipt(invoice);
      setCart([]);
      setDiscount(0);
      setNotes("");
      setCustomerName("مشتری حضوری");
      setCustomerPhone("");
      void loadProducts(queryRef.current, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت فاکتور ناموفق بود.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [
    customerName,
    customerPhone,
    discount,
    loadProducts,
    notes,
    paymentMethod,
  ]);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (e.key === "F12") {
        e.preventDefault();
        void submitInvoice();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitInvoice]);

  function addVariant(product: Product, variant: ProductVariant) {
    const unitPrice = variantSellPrice(variant);
    if (unitPrice <= 0) {
      setError("قیمت فروش برای این ترکیب تعریف نشده است.");
      return;
    }
    if ((Number(variant.quantity) || 0) <= 0) {
      setError("موجودی کافی نیست.");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id);
      if (existing) {
        const quantity = existing.quantity + 1;
        if (quantity > (Number(variant.quantity) || 0)) {
          setError(`حداکثر موجودی این ترکیب ${variant.quantity} است.`);
          return prev;
        }
        return prev.map((l) =>
          l.id === existing.id
            ? { ...l, quantity, total: unitPrice * quantity }
            : l,
        );
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          productId: product.id,
          variantId: variant.id,
          productName: product.name,
          variantLabel: variantLabel(variant),
          sku: variant.sku || "",
          unitPrice,
          quantity: 1,
          total: unitPrice,
        },
      ];
    });
    setPicker(null);
    setError("");
    searchRef.current?.focus();
  }

  async function handleSelectProduct(product: Product) {
    const variants = product.variants || [];
    if (!variants.length) {
      setError("این محصول ترکیب/موجودی ندارد.");
      return;
    }
    if (variants.length === 1 && !(product.attributes || []).length) {
      addVariant(product, variants[0]);
      return;
    }
    if (
      variants.length === 1 &&
      (product.attributes || []).every((a) => a.options.length <= 1)
    ) {
      addVariant(product, variants[0]);
      return;
    }
    try {
      const full = await getProduct(product.id);
      setPicker(full);
    } catch {
      setPicker(product);
    }
  }

  async function tryAddBySkuOrBarcode() {
    const q = query.trim();
    if (!q) return;
    const exact = products.find((p) =>
      (p.variants || []).some(
        (v) =>
          v.sku &&
          v.sku.toLowerCase() === q.toLowerCase() &&
          (Number(v.quantity) || 0) > 0,
      ),
    );
    if (exact) {
      const variant = exact.variants.find(
        (v) => v.sku?.toLowerCase() === q.toLowerCase(),
      );
      if (variant) {
        addVariant(exact, variant);
        setQuery("");
        return;
      }
    }
    if (products.length === 1) {
      await handleSelectProduct(products[0]);
    }
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void tryAddBySkuOrBarcode();
    }
  }

  function setQty(lineId: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.id !== lineId) return l;
          const q = Math.max(0, Math.round(quantity));
          return { ...l, quantity: q, total: l.unitPrice * q };
        })
        .filter((l) => l.quantity > 0),
    );
  }

  function handleLogout() {
    logout();
    onLogout();
  }

  return (
    <div className="pos-shell">
      <header className="pos-topbar">
        <div>
          <strong>آبرنگ POS</strong>
          <span className="muted">
            {user.fullName || user.username} · {user.role}
          </span>
        </div>
        <div className="topbar-actions">
          <span className="kbd-hint">F2 جستجو · F12 ثبت فاکتور</span>
          <button type="button" className="btn-ghost" onClick={handleLogout}>
            خروج
          </button>
        </div>
      </header>

      <div className="pos-main">
        <section className="pos-catalog">
          <div className="search-row">
            <input
              ref={searchRef}
              type="search"
              placeholder="جستجوی نام یا SKU / بارکد…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
            />
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void loadProducts(query, true)}
            >
              بروزرسانی
            </button>
          </div>

          {error && <p className="form-error">{error}</p>}
          {loading ? (
            <p className="muted center">در حال بارگذاری محصولات…</p>
          ) : (
            <>
              <div className="product-grid">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onSelect={(prod) => void handleSelectProduct(prod)}
                  />
                ))}
              </div>
              {!products.length && (
                <p className="muted center">محصولی پیدا نشد.</p>
              )}
              {hasMore && (
                <button
                  type="button"
                  className="btn-ghost load-more"
                  disabled={loadingMore}
                  onClick={() => void loadProducts(query, false)}
                >
                  {loadingMore
                    ? "…"
                    : `نمایش بیشتر (${products.length.toLocaleString("fa-IR")} از ${total.toLocaleString("fa-IR")})`}
                </button>
              )}
            </>
          )}
        </section>

        <aside className="pos-cart">
          <h2>سبد فروش</h2>

          <label>
            نام مشتری
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </label>
          <label>
            موبایل (اختیاری)
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              inputMode="tel"
              dir="ltr"
            />
          </label>

          <div className="pay-row">
            <button
              type="button"
              className={"chip" + (paymentMethod === "cash" ? " is-active" : "")}
              onClick={() => setPaymentMethod("cash")}
            >
              نقدی
            </button>
            <button
              type="button"
              className={"chip" + (paymentMethod === "card" ? " is-active" : "")}
              onClick={() => setPaymentMethod("card")}
            >
              کارت
            </button>
          </div>

          <div className="cart-lines">
            {cart.map((line) => (
              <div key={line.id} className="cart-line">
                <div>
                  <strong>{line.productName}</strong>
                  <small>{line.variantLabel}</small>
                  <small>{formatToman(line.unitPrice)}</small>
                </div>
                <div className="qty-controls">
                  <button type="button" onClick={() => setQty(line.id, line.quantity - 1)}>
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => setQty(line.id, Number(e.target.value))}
                  />
                  <button type="button" onClick={() => setQty(line.id, line.quantity + 1)}>
                    +
                  </button>
                </div>
                <strong>{formatToman(line.total)}</strong>
              </div>
            ))}
            {!cart.length && <p className="muted">سبد خالی است — محصول انتخاب کنید.</p>}
          </div>

          <label>
            تخفیف (تومان)
            <input
              type="number"
              min={0}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            />
          </label>
          <label>
            یادداشت
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <div className="cart-totals">
            <div>
              <span>جمع</span>
              <strong>{formatToman(subtotal)}</strong>
            </div>
            <div className="pay-total">
              <span>قابل پرداخت</span>
              <strong>{formatToman(totalPay)}</strong>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary btn-checkout"
            disabled={!cart.length || submitting}
            onClick={() => void submitInvoice()}
          >
            {submitting ? "در حال ثبت…" : "ثبت فاکتور (F12)"}
          </button>
        </aside>
      </div>

      {picker && (
        <VariantPicker
          product={picker}
          onClose={() => setPicker(null)}
          onPick={(v) => addVariant(picker, v)}
        />
      )}

      {receipt && (
        <ReceiptView
          invoice={receipt}
          shop={shop}
          onClose={() => {
            setReceipt(null);
            searchRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
