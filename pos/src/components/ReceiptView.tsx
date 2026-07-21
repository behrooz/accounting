import type { Invoice, ShopSettings } from "../lib/invoices";
import { formatToman } from "../lib/invoices";

type Props = {
  invoice: Invoice;
  shop: ShopSettings;
  onClose: () => void;
};

export default function ReceiptView({ invoice, shop, onClose }: Props) {
  function handlePrint() {
    window.print();
  }

  return (
    <div className="modal-backdrop receipt-backdrop">
      <div className="modal receipt-modal">
        <div className="receipt-actions no-print">
          <button type="button" className="btn-primary" onClick={handlePrint}>
            چاپ فاکتور
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            فاکتور جدید
          </button>
        </div>

        <article className="receipt" id="receiptPaper">
          <header>
            <h1>{shop.name || "فروشگاه آبرنگ"}</h1>
            {shop.phone && <p>تلفن: {shop.phone}</p>}
            {shop.address && <p>{shop.address}</p>}
            <p>
              فاکتور {invoice.number} · {invoice.date}
            </p>
            {invoice.customerName && <p>مشتری: {invoice.customerName}</p>}
            {invoice.customerPhone && <p>موبایل: {invoice.customerPhone}</p>}
            {invoice.paymentMethod && (
              <p>
                پرداخت:{" "}
                {invoice.paymentMethod === "card" ? "کارت" : "نقدی"}
              </p>
            )}
          </header>

          <table>
            <thead>
              <tr>
                <th>کالا</th>
                <th>تعداد</th>
                <th>فی</th>
                <th>جمع</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div>{item.productName}</div>
                    <small>{item.variantLabel}</small>
                  </td>
                  <td>{item.quantity.toLocaleString("fa-IR")}</td>
                  <td>{formatToman(item.unitPrice)}</td>
                  <td>{formatToman(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <footer>
            <p>جمع جزء: {formatToman(invoice.subtotal)}</p>
            {invoice.discount > 0 && (
              <p>تخفیف: {formatToman(invoice.discount)}</p>
            )}
            <p className="receipt-total">
              مبلغ قابل پرداخت: {formatToman(invoice.total)}
            </p>
            {invoice.notes && <p>یادداشت: {invoice.notes}</p>}
            <p className="thanks">از خرید شما سپاسگزاریم</p>
          </footer>
        </article>
      </div>
    </div>
  );
}
