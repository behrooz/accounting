package repo

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"accounting-api/internal/models"

	"github.com/jmoiron/sqlx"
)

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

type CheckoutAddressInput struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	FullName   string `json:"fullName"`
	Phone      string `json:"phone"`
	Province   string `json:"province"`
	City       string `json:"city"`
	Address    string `json:"address"`
	PostalCode string `json:"postalCode"`
	IsDefault  bool   `json:"isDefault"`
	Save       bool   `json:"save"`
}

type CheckoutRequest struct {
	Customer       CheckoutCustomer     `json:"customer"`
	AddressID      string               `json:"addressId"`
	Address        CheckoutAddressInput `json:"address"`
	Items          []CheckoutItem       `json:"items"`
	Notes          string               `json:"notes"`
	ShippingMethod string               `json:"shippingMethod"`
	ShippingFee    int64                `json:"shippingFee"`
	PaymentMethod  string               `json:"paymentMethod"`
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

func resolvePayment(method string) string {
	switch strings.TrimSpace(method) {
	case "zarinpal":
		return "درگاه زرین‌پال"
	case "card":
		return "کارت به کارت"
	case "saman", "":
		return "درگاه سامان"
	default:
		return method
	}
}

// CreateStorefrontOrder validates cart lines against DB products/variants,
// upserts the customer/address, and creates a confirmed invoice with source=storefront.
func CreateStorefrontOrder(db *sqlx.DB, req CheckoutRequest) (*models.Invoice, error) {
	name := strings.TrimSpace(req.Customer.Name)
	phone := strings.TrimSpace(req.Customer.Phone)
	if name == "" {
		name = strings.TrimSpace(req.Address.FullName)
	}
	if phone == "" {
		phone = strings.TrimSpace(req.Address.Phone)
	}
	if name == "" || phone == "" {
		return nil, errors.New("name and phone required")
	}
	if len(req.Items) == 0 {
		return nil, errors.New("items required")
	}

	shipLabel, shipFee, err := ResolveCheckoutShipping(db, req.ShippingMethod, req.ShippingFee)
	if err != nil {
		return nil, errors.New("روش ارسال نامعتبر است")
	}
	payLabel := resolvePayment(req.PaymentMethod)

	lines := make([]models.InvoiceItem, 0, len(req.Items))
	var subtotal int64

	for _, raw := range req.Items {
		qty := raw.Quantity
		if qty < 1 {
			qty = 1
		}
		if raw.ProductID == "" || raw.VariantID == "" {
			return nil, errors.New("productId and variantId required per item")
		}

		p, err := GetPublishedProduct(db, raw.ProductID)
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
		lines = append(lines, models.InvoiceItem{
			ID:           NewID(),
			ProductID:    p.ID,
			VariantID:    v.ID,
			ProductName:  p.Name,
			VariantLabel: label,
			SKU:          v.SKU,
			UnitPrice:    unit,
			Quantity:     qty,
			Total:        total,
		})
	}

	customer, err := EnsureCustomerByPhone(db, name, phone, "مشتری فروشگاه آنلاین")
	if err != nil {
		return nil, err
	}

	addressLine := strings.TrimSpace(req.Customer.Address)
	if req.AddressID != "" {
		a, err := GetAddress(db, req.AddressID)
		if err != nil {
			return nil, errors.New("address not found")
		}
		if a.CustomerID != customer.ID {
			return nil, errors.New("address does not belong to customer")
		}
		addressLine = FormatAddressLine(*a)
		_ = SetDefaultAddress(db, customer.ID, a.ID)
	} else {
		addr := models.CustomerAddress{
			ID:         strings.TrimSpace(req.Address.ID),
			CustomerID: customer.ID,
			Title:      strings.TrimSpace(req.Address.Title),
			FullName:   strings.TrimSpace(req.Address.FullName),
			Phone:      strings.TrimSpace(req.Address.Phone),
			Province:   strings.TrimSpace(req.Address.Province),
			City:       strings.TrimSpace(req.Address.City),
			Address:    strings.TrimSpace(req.Address.Address),
			PostalCode: strings.TrimSpace(req.Address.PostalCode),
			IsDefault:  true,
		}
		if addr.FullName == "" {
			addr.FullName = name
		}
		if addr.Phone == "" {
			addr.Phone = phone
		}
		if addr.Address == "" {
			return nil, errors.New("address required")
		}
		addressLine = FormatAddressLine(addr)
		if req.Address.Save || req.Address.IsDefault {
			if addr.ID == "" {
				addr.ID = NewID()
			}
			if addr.Title == "" {
				addr.Title = "آدرس اصلی"
			}
			if err := UpsertAddress(db, addr); err != nil {
				return nil, err
			}
		}
	}

	customer.Name = name
	customer.Phone = phone
	customer.Address = addressLine
	_ = UpsertCustomer(db, *customer)

	number, err := NextInvoiceNumber(db)
	if err != nil {
		return nil, err
	}

	notes := strings.TrimSpace(req.Notes)
	if notes == "" {
		notes = "سفارش آنلاین فروشگاه"
	}
	notes = notes + " | ارسال: " + shipLabel + " | پرداخت: " + payLabel

	now := time.Now()
	inv := models.Invoice{
		ID:              NewID(),
		Number:          number,
		Date:            now.Format("2006-01-02"),
		CustomerID:      customer.ID,
		CustomerName:    name,
		CustomerPhone:   phone,
		CustomerAddress: addressLine,
		Items:           lines,
		Notes:           notes,
		Discount:        0,
		Subtotal:        subtotal,
		Total:           subtotal + shipFee,
		Status:          "confirmed",
		Source:          "storefront",
		ShippingMethod:  shipLabel,
		ShippingFee:     shipFee,
		PaymentMethod:   payLabel,
		CreatedAt:       now.Format(time.RFC3339),
	}

	err = WithTx(db, func(tx *sqlx.Tx) error {
		createdAt := now.Format("2006-01-02 15:04:05.00")
		_, err := tx.Exec(
			`INSERT INTO invoices(
				id, number, date, customer_id, customer_name, customer_phone, customer_address,
				notes, discount, subtotal, total, status, source, shipping_method, shipping_fee, payment_method, created_at
			) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			inv.ID, inv.Number, inv.Date, inv.CustomerID, inv.CustomerName, inv.CustomerPhone, inv.CustomerAddress,
			inv.Notes, inv.Discount, inv.Subtotal, inv.Total, inv.Status, inv.Source,
			inv.ShippingMethod, inv.ShippingFee, inv.PaymentMethod, createdAt,
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
