package repo

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"accounting-api/internal/models"

	"github.com/jmoiron/sqlx"
)

// NewID returns a random UUID-like id (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).
func NewID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	s := hex.EncodeToString(b)
	return s[0:8] + "-" + s[8:12] + "-" + s[12:16] + "-" + s[16:20] + "-" + s[20:32]
}

type CheckoutCustomer struct {
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	Address string `json:"address"`
}

type CheckoutItem struct {
	ProductID string `json:"productId"`
	VariantID string `json:"variantId"`
	Quantity  int    `json:"quantity"`
}

type CheckoutRequest struct {
	Customer CheckoutCustomer `json:"customer"`
	Items    []CheckoutItem   `json:"items"`
	Notes    string           `json:"notes"`
}

func FindCustomerByPhone(db *sqlx.DB, phone string) (*models.Customer, error) {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return nil, sql.ErrNoRows
	}
	var c models.Customer
	err := db.Get(&c, "SELECT id, name, phone, address, notes FROM customers WHERE phone=? LIMIT 1", phone)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// CreateStorefrontOrder validates cart lines against DB products/variants,
// upserts the customer, and creates a confirmed invoice with source=storefront.
func CreateStorefrontOrder(db *sqlx.DB, req CheckoutRequest) (*models.Invoice, error) {
	name := strings.TrimSpace(req.Customer.Name)
	phone := strings.TrimSpace(req.Customer.Phone)
	address := strings.TrimSpace(req.Customer.Address)
	if name == "" || phone == "" {
		return nil, errors.New("name and phone required")
	}
	if len(req.Items) == 0 {
		return nil, errors.New("items required")
	}

	type line struct {
		item         models.InvoiceItem
		variantQty   int
		variantID    string
	}

	lines := make([]line, 0, len(req.Items))
	var subtotal int64

	for _, raw := range req.Items {
		qty := raw.Quantity
		if qty < 1 {
			qty = 1
		}
		if raw.ProductID == "" || raw.VariantID == "" {
			return nil, errors.New("productId and variantId required per item")
		}

		p, err := GetProduct(db, raw.ProductID)
		if err != nil {
			return nil, fmt.Errorf("product not found: %s", raw.ProductID)
		}

		var v *models.ProductVariant
		for i := range p.Variants {
			if p.Variants[i].ID == raw.VariantID {
				v = &p.Variants[i]
				break
			}
		}
		if v == nil {
			return nil, fmt.Errorf("variant not found: %s", raw.VariantID)
		}
		if v.Quantity < qty {
			return nil, fmt.Errorf("insufficient stock for %s", p.Name)
		}

		unit := v.SalePrice
		if unit <= 0 {
			unit = v.Price
		}
		labelParts := make([]string, 0, len(p.Attributes))
		for _, a := range p.Attributes {
			if val, ok := v.AttributeValues[a.ID]; ok && val != "" {
				labelParts = append(labelParts, val)
			}
		}
		label := strings.Join(labelParts, " / ")
		if label == "" {
			label = "ساده"
		}

		total := unit * int64(qty)
		subtotal += total
		lines = append(lines, line{
			item: models.InvoiceItem{
				ID:           NewID(),
				ProductID:    p.ID,
				VariantID:    v.ID,
				ProductName:  p.Name,
				VariantLabel: label,
				SKU:          v.SKU,
				UnitPrice:    unit,
				Quantity:     qty,
				Total:        total,
			},
			variantQty: v.Quantity,
			variantID:  v.ID,
		})
	}

	cust, err := FindCustomerByPhone(db, phone)
	customerID := NewID()
	if err == nil && cust != nil {
		customerID = cust.ID
	} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	customer := models.Customer{
		ID:      customerID,
		Name:    name,
		Phone:   phone,
		Address: address,
		Notes:   "مشتری فروشگاه آنلاین",
	}
	if err := UpsertCustomer(db, customer); err != nil {
		return nil, err
	}

	number, err := NextInvoiceNumber(db)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	items := make([]models.InvoiceItem, 0, len(lines))
	for _, l := range lines {
		items = append(items, l.item)
	}

	notes := strings.TrimSpace(req.Notes)
	if notes == "" {
		notes = "سفارش آنلاین فروشگاه"
	}

	inv := models.Invoice{
		ID:              NewID(),
		Number:          number,
		Date:            now.Format("2006-01-02"),
		CustomerID:      customerID,
		CustomerName:    name,
		CustomerPhone:   phone,
		CustomerAddress: address,
		Items:           items,
		Notes:           notes,
		Discount:        0,
		Subtotal:        subtotal,
		Total:           subtotal,
		Status:          "confirmed",
		Source:          "storefront",
		CreatedAt:       now.Format(time.RFC3339),
	}

	err = WithTx(db, func(tx *sqlx.Tx) error {
		createdAt := now.Format("2006-01-02 15:04:05.00")
		_, err := tx.Exec(
			`INSERT INTO invoices(
				id, number, date, customer_id, customer_name, customer_phone, customer_address,
				notes, discount, subtotal, total, status, source, created_at
			) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			inv.ID, inv.Number, inv.Date, inv.CustomerID, inv.CustomerName, inv.CustomerPhone, inv.CustomerAddress,
			inv.Notes, inv.Discount, inv.Subtotal, inv.Total, inv.Status, inv.Source, createdAt,
		)
		if err != nil {
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
			// Decrement stock
			res, err := tx.Exec(
				`UPDATE product_variants SET quantity = quantity - ? WHERE id=? AND quantity >= ?`,
				it.Quantity, it.VariantID, it.Quantity,
			)
			if err != nil {
				return err
			}
			aff, _ := res.RowsAffected()
			if aff == 0 {
				return fmt.Errorf("insufficient stock for variant %s", it.VariantID)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &inv, nil
}
