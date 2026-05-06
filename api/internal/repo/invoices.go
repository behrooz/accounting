package repo

import (
	"errors"
	"time"

	"accounting-api/internal/models"
	"github.com/jmoiron/sqlx"
)

type invoiceRow struct {
	ID              string `db:"id"`
	Number          string `db:"number"`
	Date            string `db:"date"`
	CustomerID      string `db:"customer_id"`
	CustomerName    string `db:"customer_name"`
	CustomerPhone   string `db:"customer_phone"`
	CustomerAddress string `db:"customer_address"`
	Notes           string `db:"notes"`
	Discount        int64  `db:"discount"`
	Subtotal        int64  `db:"subtotal"`
	Total           int64  `db:"total"`
	Status          string `db:"status"`
	CreatedAt       string `db:"created_at"`
}

type itemRow struct {
	ID           string `db:"id"`
	InvoiceID    string `db:"invoice_id"`
	ProductID    string `db:"product_id"`
	VariantID    string `db:"variant_id"`
	ProductName  string `db:"product_name"`
	VariantLabel string `db:"variant_label"`
	SKU          string `db:"sku"`
	UnitPrice    int64  `db:"unit_price"`
	Quantity     int    `db:"quantity"`
	Total        int64  `db:"total"`
	SortOrder    int    `db:"sort_order"`
}

func ListInvoices(db *sqlx.DB) ([]models.Invoice, error) {
	var rows []invoiceRow
	if err := db.Select(&rows, "SELECT * FROM invoices ORDER BY date DESC, created_at DESC"); err != nil {
		return nil, err
	}
	out := make([]models.Invoice, 0, len(rows))
	for _, r := range rows {
		inv, err := GetInvoice(db, r.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, *inv)
	}
	return out, nil
}

func GetInvoice(db *sqlx.DB, id string) (*models.Invoice, error) {
	var r invoiceRow
	if err := db.Get(&r, "SELECT * FROM invoices WHERE id=? LIMIT 1", id); err != nil {
		return nil, err
	}
	var items []itemRow
	if err := db.Select(&items, "SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY sort_order ASC", id); err != nil {
		return nil, err
	}
	outItems := make([]models.InvoiceItem, 0, len(items))
	for _, it := range items {
		outItems = append(outItems, models.InvoiceItem{
			ID:           it.ID,
			ProductID:    it.ProductID,
			VariantID:    it.VariantID,
			ProductName:  it.ProductName,
			VariantLabel: it.VariantLabel,
			SKU:          it.SKU,
			UnitPrice:    it.UnitPrice,
			Quantity:     it.Quantity,
			Total:        it.Total,
		})
	}
	return &models.Invoice{
		ID:              r.ID,
		Number:          r.Number,
		Date:            r.Date,
		CustomerID:      r.CustomerID,
		CustomerName:    r.CustomerName,
		CustomerPhone:   r.CustomerPhone,
		CustomerAddress: r.CustomerAddress,
		Items:           outItems,
		Notes:           r.Notes,
		Discount:        r.Discount,
		Subtotal:        r.Subtotal,
		Total:           r.Total,
		Status:          r.Status,
		CreatedAt:       r.CreatedAt,
	}, nil
}

func NextInvoiceNumber(db *sqlx.DB) (string, error) {
	var n int
	if err := db.Get(&n, "SELECT COUNT(*) FROM invoices"); err != nil {
		return "", err
	}
	return "INV-" + pad4(n+1), nil
}

func pad4(n int) string {
	s := "0000" + itoa(n)
	return s[len(s)-4:]
}

func itoa(n int) string {
	return fmtInt(n)
}

// tiny int formatter to avoid strconv import in this file
func fmtInt(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [32]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + (n % 10))
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

func UpsertInvoice(db *sqlx.DB, inv models.Invoice) error {
	return WithTx(db, func(tx *sqlx.Tx) error {
		createdAt := inv.CreatedAt
		if createdAt == "" {
			createdAt = time.Now().Format(time.RFC3339)
		}

		_, err := tx.Exec(
			`INSERT INTO invoices(
				id, number, date, customer_id, customer_name, customer_phone, customer_address,
				notes, discount, subtotal, total, status, created_at
			) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
			ON DUPLICATE KEY UPDATE
				number=VALUES(number),
				date=VALUES(date),
				customer_id=VALUES(customer_id),
				customer_name=VALUES(customer_name),
				customer_phone=VALUES(customer_phone),
				customer_address=VALUES(customer_address),
				notes=VALUES(notes),
				discount=VALUES(discount),
				subtotal=VALUES(subtotal),
				total=VALUES(total),
				status=VALUES(status),
				created_at=VALUES(created_at)`,
			inv.ID, inv.Number, inv.Date, inv.CustomerID, inv.CustomerName, inv.CustomerPhone, inv.CustomerAddress,
			inv.Notes, inv.Discount, inv.Subtotal, inv.Total, inv.Status, createdAt,
		)
		if err != nil {
			return err
		}

		if _, err := tx.Exec("DELETE FROM invoice_items WHERE invoice_id=?", inv.ID); err != nil {
			return err
		}
		for i, it := range inv.Items {
			_, err := tx.Exec(
				`INSERT INTO invoice_items(
					id, invoice_id, product_id, variant_id, product_name, variant_label, sku,
					unit_price, quantity, total, sort_order
				) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
				it.ID, inv.ID, it.ProductID, it.VariantID, it.ProductName, it.VariantLabel, it.SKU,
				it.UnitPrice, it.Quantity, it.Total, i,
			)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func DeleteInvoice(db *sqlx.DB, id string) error {
	res, err := db.Exec("DELETE FROM invoices WHERE id=?", id)
	if err != nil {
		return err
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		return errors.New("not found")
	}
	return nil
}
