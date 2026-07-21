package repo

import (
	"database/sql"
	"errors"
	"log"
	"strings"
	"time"

	"accounting-api/internal/models"
	"accounting-api/internal/smsir"

	"github.com/jmoiron/sqlx"
)

type StockAlertSubscription struct {
	ID         string       `db:"id" json:"id"`
	ProductID  string       `db:"product_id" json:"productId"`
	VariantID  string       `db:"variant_id" json:"variantId"`
	Phone      string       `db:"phone" json:"phone"`
	Status     string       `db:"status" json:"status"`
	CreatedAt  time.Time    `db:"created_at" json:"createdAt"`
	NotifiedAt sql.NullTime `db:"notified_at" json:"notifiedAt,omitempty"`
}

type StockAlertRequest struct {
	ProductID string `json:"productId"`
	VariantID string `json:"variantId"`
	Phone     string `json:"phone"`
}

func EnsureStockAlertTable(db *sqlx.DB) error {
	_, err := db.Exec(`
CREATE TABLE IF NOT EXISTS stock_alert_subscriptions (
  id CHAR(36) PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  variant_id CHAR(36) NOT NULL DEFAULT '',
  phone VARCHAR(20) NOT NULL,
  status ENUM('pending','notified','cancelled') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notified_at DATETIME NULL,
  UNIQUE KEY ux_stock_alert (product_id, variant_id, phone),
  KEY ix_stock_alert_product_status (product_id, status),
  KEY ix_stock_alert_phone (phone),
  CONSTRAINT fk_stock_alert_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
	return err
}

func loadVariantQuantities(db *sqlx.DB, productID string) (map[string]int, error) {
	rows := []struct {
		ID       string `db:"id"`
		Quantity int    `db:"quantity"`
	}{}
	err := db.Select(&rows, `SELECT id, quantity FROM product_variants WHERE product_id=?`, productID)
	if err != nil {
		return nil, err
	}
	out := make(map[string]int, len(rows))
	for _, r := range rows {
		out[r.ID] = r.Quantity
	}
	return out, nil
}

func detectRestockedVariants(before map[string]int, product models.Product) []string {
	restocked := make([]string, 0)
	seen := map[string]bool{}
	for _, v := range product.Variants {
		oldQty := before[v.ID]
		if oldQty <= 0 && v.Quantity > 0 {
			if !seen[v.ID] {
				seen[v.ID] = true
				restocked = append(restocked, v.ID)
			}
		}
	}
	for _, v := range product.Variants {
		if _, ok := before[v.ID]; !ok && v.Quantity > 0 && !seen[v.ID] {
			seen[v.ID] = true
			restocked = append(restocked, v.ID)
		}
	}
	return restocked
}

func productTotalQuantity(p models.Product) int {
	total := 0
	for _, v := range p.Variants {
		if v.Quantity > 0 {
			total += v.Quantity
		}
	}
	return total
}

// SubscribeStockAlert registers a customer phone for back-in-stock SMS.
func SubscribeStockAlert(db *sqlx.DB, req StockAlertRequest) error {
	phone, err := NormalizeIranPhone(req.Phone)
	if err != nil {
		return err
	}
	productID := strings.TrimSpace(req.ProductID)
	if productID == "" {
		return errors.New("productId required")
	}
	variantID := strings.TrimSpace(req.VariantID)

	p, err := GetPublishedProduct(db, productID)
	if err != nil {
		return errors.New("product not found")
	}

	if variantID != "" {
		var found *models.ProductVariant
		for i := range p.Variants {
			if p.Variants[i].ID == variantID {
				found = &p.Variants[i]
				break
			}
		}
		if found == nil {
			return errors.New("variant not found")
		}
		if found.Quantity > 0 {
			return errors.New("این ترکیب هم‌اکنون موجود است")
		}
	} else if productTotalQuantity(*p) > 0 {
		return errors.New("این محصول هم‌اکنون موجود است")
	}

	_, err = db.Exec(
		`INSERT INTO stock_alert_subscriptions(id, product_id, variant_id, phone, status)
		 VALUES(?,?,?,?,'pending')
		 ON DUPLICATE KEY UPDATE status='pending', notified_at=NULL, created_at=CURRENT_TIMESTAMP`,
		newID(), productID, variantID, phone,
	)
	return err
}

type StockSMSConfig struct {
	TemplateID int
	ParamName  string
}

// ProcessStockAlerts sends SMS for pending subscriptions after restock.
func ProcessStockAlerts(db *sqlx.DB, sms *smsir.Client, cfg StockSMSConfig, productID string, restockedVariantIDs []string) {
	if len(restockedVariantIDs) == 0 || sms == nil || !sms.EnabledForTemplate(cfg.TemplateID) {
		return
	}

	p, err := GetProduct(db, productID)
	if err != nil {
		return
	}

	restocked := map[string]bool{}
	for _, id := range restockedVariantIDs {
		restocked[id] = true
	}
	productInStock := productTotalQuantity(*p) > 0

	paramName := strings.TrimSpace(cfg.ParamName)
	if paramName == "" {
		paramName = "PRODUCT"
	}
	productName := strings.TrimSpace(p.Name)
	if productName == "" {
		productName = "محصول"
	}

	type target struct {
		variantID string
	}
	targets := make([]target, 0)
	if productInStock {
		targets = append(targets, target{variantID: ""})
	}
	for vid := range restocked {
		targets = append(targets, target{variantID: vid})
	}

	seen := map[string]bool{}
	for _, t := range targets {
		var rows []StockAlertSubscription
		err := db.Select(&rows, `
			SELECT id, product_id, variant_id, phone, status
			FROM stock_alert_subscriptions
			WHERE product_id=? AND variant_id=? AND status='pending'`,
			productID, t.variantID,
		)
		if err != nil {
			continue
		}
		for _, row := range rows {
			key := row.Phone + "\x00" + row.VariantID
			if seen[key] {
				continue
			}
			if t.variantID != "" {
				qty := 0
				for _, v := range p.Variants {
					if v.ID == t.variantID {
						qty = v.Quantity
						break
					}
				}
				if qty <= 0 {
					continue
				}
			} else if !productInStock {
				continue
			}

			seen[key] = true
			if err := sms.SendTemplate(cfg.TemplateID, row.Phone, map[string]string{
				paramName: productName,
			}); err != nil {
				log.Printf("[stock-alert] sms failed product=%s phone=%s: %v", productID, row.Phone, err)
				continue
			}
			_, _ = db.Exec(
				`UPDATE stock_alert_subscriptions SET status='notified', notified_at=? WHERE id=?`,
				time.Now(), row.ID,
			)
		}
	}
}

// UpsertProductWithRestock saves a product and returns variant IDs restocked (0 -> >0).
func UpsertProductWithRestock(db *sqlx.DB, p models.Product) ([]string, error) {
	before, err := loadVariantQuantities(db, p.ID)
	if err != nil {
		return nil, err
	}
	if err := UpsertProduct(db, p); err != nil {
		return nil, err
	}
	return detectRestockedVariants(before, p), nil
}
