package repo

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"accounting-api/internal/media"
	"accounting-api/internal/models"

	"github.com/jmoiron/sqlx"
)

type productRow struct {
	ID         string         `db:"id"`
	Name       string         `db:"name"`
	CategoryID sql.NullString `db:"category_id"`
}

type attrRow struct {
	ID         string `db:"id"`
	ProductID  string `db:"product_id"`
	Name       string `db:"name"`
	AllowImage bool   `db:"allow_image"`
	SortOrder  int    `db:"sort_order"`
	CreatedAt  string `db:"created_at"`
	UpdatedAt  string `db:"updated_at"`
}

type optRow struct {
	ID          string `db:"id"`
	AttributeID string `db:"attribute_id"`
	Label       string `db:"label"`
	SortOrder   int    `db:"sort_order"`
	CreatedAt   string `db:"created_at"`
	UpdatedAt   string `db:"updated_at"`
}

type varRow struct {
	ID              string         `db:"id"`
	ProductID       string         `db:"product_id"`
	SKU             string         `db:"sku"`
	Price           int64          `db:"price"`
	SalePrice       int64          `db:"sale_price"`
	Quantity        int            `db:"quantity"`
	AttributeValues string         `db:"attribute_values"`
	Image           sql.NullString `db:"image"`
	CreatedAt       string         `db:"created_at"`
	UpdatedAt       string         `db:"updated_at"`
}

type ProductListFilter struct {
	Sort         string // new | price-asc | price-desc | sale
	CategoryID   string
	CategorySlug string
	Query        string
	Limit        int
	Offset       int
}

func ListProducts(db *sqlx.DB, f ProductListFilter) ([]models.Product, error) {
	q := `
		SELECT p.id, p.name, p.category_id
		FROM products p
		LEFT JOIN product_categories c ON c.id = p.category_id
		WHERE 1=1`
	args := make([]any, 0, 4)

	if id := strings.TrimSpace(f.CategoryID); id != "" {
		q += " AND p.category_id = ?"
		args = append(args, id)
	} else if slug := strings.TrimSpace(f.CategorySlug); slug != "" && slug != "all" {
		q += " AND c.slug = ?"
		args = append(args, slug)
	}
	if query := strings.TrimSpace(f.Query); query != "" {
		q += " AND p.name LIKE ?"
		args = append(args, "%"+query+"%")
	}

	sortKey := strings.TrimSpace(strings.ToLower(f.Sort))
	if sortKey == "" {
		sortKey = "new"
	}
	if sortKey == "sale" {
		q += ` AND EXISTS (
			SELECT 1 FROM product_variants v
			WHERE v.product_id = p.id AND v.sale_price > 0
		)`
	}

	effectivePrice := `COALESCE((
		SELECT MIN(CASE WHEN v.sale_price > 0 THEN v.sale_price ELSE v.price END)
		FROM product_variants v
		WHERE v.product_id = p.id AND (v.sale_price > 0 OR v.price > 0)
	), 0)`
	switch sortKey {
	case "price-asc", "sale":
		q += " ORDER BY " + effectivePrice + " ASC, p.updated_at DESC, p.id DESC"
	case "price-desc":
		q += " ORDER BY " + effectivePrice + " DESC, p.updated_at DESC, p.id DESC"
	default:
		q += " ORDER BY p.updated_at DESC, p.id DESC"
	}

	if f.Limit > 0 {
		if f.Limit > 100 {
			f.Limit = 100
		}
		if f.Offset < 0 {
			f.Offset = 0
		}
		q += " LIMIT ? OFFSET ?"
		args = append(args, f.Limit, f.Offset)
	}

	var ps []productRow
	if err := db.Select(&ps, q, args...); err != nil {
		return nil, err
	}
	out := make([]models.Product, 0, len(ps))
	for _, p := range ps {
		full, err := GetProduct(db, p.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, *full)
	}

	return out, nil
}

func productListPrice(p models.Product) int64 {
	var min int64
	for _, v := range p.Variants {
		price := v.SalePrice
		if price <= 0 {
			price = v.Price
		}
		if price <= 0 {
			continue
		}
		if min == 0 || price < min {
			min = price
		}
	}
	return min
}

type imgRow struct {
	ID        string `db:"id"`
	ProductID string `db:"product_id"`
	Image     string `db:"image"`
	SortOrder int    `db:"sort_order"`
}

func GetProduct(db *sqlx.DB, id string) (*models.Product, error) {
	var p productRow
	if err := db.Get(&p, "SELECT id, name, category_id FROM products WHERE id=? LIMIT 1", id); err != nil {
		return nil, err
	}

	var imgRows []imgRow
	if err := db.Select(&imgRows, `
		SELECT id, product_id, image, sort_order
		FROM product_images
		WHERE product_id=?
		ORDER BY sort_order ASC`, id); err != nil {
		return nil, err
	}
	images := make([]string, 0, len(imgRows))
	for _, row := range imgRows {
		images = append(images, row.Image)
	}

	var attrs []attrRow
	if err := db.Select(&attrs, "SELECT * FROM product_attributes WHERE product_id=? ORDER BY sort_order ASC", id); err != nil {
		return nil, err
	}

	attrIDs := make([]string, 0, len(attrs))
	for _, a := range attrs {
		attrIDs = append(attrIDs, a.ID)
	}

	optsByAttr := map[string][]models.AttributeOption{}
	if len(attrIDs) > 0 {
		query, args, err := sqlx.In("SELECT * FROM attribute_options WHERE attribute_id IN (?) ORDER BY sort_order ASC", attrIDs)
		if err != nil {
			return nil, err
		}
		query = db.Rebind(query)
		var opts []optRow
		if err := db.Select(&opts, query, args...); err != nil {
			return nil, err
		}
		for _, o := range opts {
			optsByAttr[o.AttributeID] = append(optsByAttr[o.AttributeID], models.AttributeOption{ID: o.ID, Label: o.Label})
		}
	}

	var variantsRows []varRow
	if err := db.Select(&variantsRows, "SELECT * FROM product_variants WHERE product_id=? ORDER BY created_at ASC", id); err != nil {
		return nil, err
	}
	var variants []models.ProductVariant
	for _, v := range variantsRows {
		m := map[string]string{}
		_ = json.Unmarshal([]byte(v.AttributeValues), &m)
		m = normalizeAttributeValues(attrs, optsByAttr, m)
		var img *string
		if v.Image.Valid {
			s := v.Image.String
			img = &s
		}
		variants = append(variants, models.ProductVariant{
			ID:              v.ID,
			SKU:             v.SKU,
			Price:           v.Price,
			SalePrice:       v.SalePrice,
			Quantity:        v.Quantity,
			AttributeValues: m,
			Image:           img,
		})
	}

	fullAttrs := make([]models.ProductAttribute, 0, len(attrs))
	for _, a := range attrs {
		fullAttrs = append(fullAttrs, models.ProductAttribute{
			ID:         a.ID,
			Name:       a.Name,
			AllowImage: a.AllowImage,
			Options:    optsByAttr[a.ID],
		})
	}

	return &models.Product{
		ID:         p.ID,
		Name:       p.Name,
		CategoryID: nullStringPtr(p.CategoryID),
		Images:     images,
		Attributes: fullAttrs,
		Variants:   variants,
	}, nil
}

func nullStringPtr(ns sql.NullString) *string {
	if !ns.Valid || ns.String == "" {
		return nil
	}
	s := ns.String
	return &s
}

// normalizeAttributeValues remaps stale keys (attribute name / old id) onto current attribute ids.
func normalizeAttributeValues(
	attrs []attrRow,
	optsByAttr map[string][]models.AttributeOption,
	vals map[string]string,
) map[string]string {
	if len(vals) == 0 {
		return map[string]string{}
	}
	idSet := map[string]bool{}
	byName := map[string]string{}
	for _, a := range attrs {
		idSet[a.ID] = true
		byName[a.Name] = a.ID
	}

	out := map[string]string{}
	for k, v := range vals {
		if idSet[k] {
			out[k] = v
			continue
		}
		if id, ok := byName[k]; ok {
			out[id] = v
			continue
		}
		// Match value to an option label under any attribute not yet filled.
		for _, a := range attrs {
			if _, filled := out[a.ID]; filled {
				continue
			}
			for _, opt := range optsByAttr[a.ID] {
				if opt.Label == v {
					out[a.ID] = v
					break
				}
			}
		}
	}
	return out
}

func newID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf(
		"%x-%x-%x-%x-%x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16],
	)
}

func UpsertProduct(db *sqlx.DB, p models.Product) error {
	return WithTx(db, func(tx *sqlx.Tx) error {
		_, err := tx.Exec(
			`INSERT INTO products(id, name, category_id) VALUES(?,?,?)
			 ON DUPLICATE KEY UPDATE name=VALUES(name), category_id=VALUES(category_id)`,
			p.ID, p.Name, p.CategoryID,
		)
		if err != nil {
			return err
		}

		// Replace attributes/options/variants/images for simplicity (matches localStorage overwrite behavior)
		var oldImgs []string
		_ = tx.Select(&oldImgs, `SELECT image FROM product_images WHERE product_id=?`, p.ID)
		var oldVarImgs []sql.NullString
		_ = tx.Select(&oldVarImgs, `SELECT image FROM product_variants WHERE product_id=?`, p.ID)

		if _, err := tx.Exec("DELETE FROM product_attributes WHERE product_id=?", p.ID); err != nil {
			return err
		}
		if _, err := tx.Exec("DELETE FROM product_variants WHERE product_id=?", p.ID); err != nil {
			return err
		}
		if _, err := tx.Exec("DELETE FROM product_images WHERE product_id=?", p.ID); err != nil {
			return err
		}

		kept := map[string]bool{}
		for i, img := range p.Images {
			path, err := media.NormalizeImageRef(img)
			if err != nil {
				return err
			}
			if path == "" {
				continue
			}
			kept[path] = true
			_, err = tx.Exec(
				`INSERT INTO product_images(id, product_id, image, sort_order) VALUES(?,?,?,?)`,
				newID(), p.ID, path, i,
			)
			if err != nil {
				return err
			}
		}

		for i, a := range p.Attributes {
			_, err := tx.Exec(
				`INSERT INTO product_attributes(id, product_id, name, allow_image, sort_order) VALUES(?,?,?,?,?)`,
				a.ID, p.ID, a.Name, a.AllowImage, i,
			)
			if err != nil {
				return err
			}
			for j, o := range a.Options {
				_, err := tx.Exec(`INSERT INTO attribute_options(id, attribute_id, label, sort_order) VALUES(?,?,?,?)`, o.ID, a.ID, o.Label, j)
				if err != nil {
					return err
				}
			}
		}

		for _, v := range p.Variants {
			b, _ := json.Marshal(v.AttributeValues)
			var imgPtr interface{}
			if v.Image != nil && strings.TrimSpace(*v.Image) != "" {
				path, err := media.NormalizeImageRef(*v.Image)
				if err != nil {
					return err
				}
				if path != "" {
					kept[path] = true
					imgPtr = path
				}
			}
			_, err := tx.Exec(
				`INSERT INTO product_variants(id, product_id, sku, price, sale_price, quantity, attribute_values, image) VALUES(?,?,?,?,?,?,?,?)`,
				v.ID, p.ID, v.SKU, v.Price, v.SalePrice, v.Quantity, string(b), imgPtr,
			)
			if err != nil {
				return err
			}
		}

		// Remove orphaned files after successful replace
		for _, old := range oldImgs {
			if !kept[old] {
				media.DeleteFile(old)
			}
		}
		for _, ns := range oldVarImgs {
			if ns.Valid && !kept[ns.String] {
				media.DeleteFile(ns.String)
			}
		}

		return nil
	})
}

func DeleteProduct(db *sqlx.DB, id string) error {
	var imgs []string
	_ = db.Select(&imgs, `SELECT image FROM product_images WHERE product_id=?`, id)
	var varImgs []sql.NullString
	_ = db.Select(&varImgs, `SELECT image FROM product_variants WHERE product_id=?`, id)

	_, err := db.Exec(`DELETE FROM products WHERE id=?`, id)
	if err != nil {
		return err
	}
	for _, p := range imgs {
		media.DeleteFile(p)
	}
	for _, ns := range varImgs {
		if ns.Valid {
			media.DeleteFile(ns.String)
		}
	}
	return nil
}

// ProductStock is a lightweight stock payload for the storefront.
type ProductStock struct {
	ProductID     string         `json:"productId"`
	TotalQuantity int            `json:"totalQuantity"`
	Variants      []VariantStock `json:"variants"`
	Options       []OptionStock  `json:"options"`
}

type VariantStock struct {
	ID              string            `json:"id"`
	SKU             string            `json:"sku"`
	Quantity        int               `json:"quantity"`
	InStock         bool              `json:"inStock"`
	AttributeValues map[string]string `json:"attributeValues"`
}

type OptionStock struct {
	AttributeID   string `json:"attributeId"`
	AttributeName string `json:"attributeName"`
	Label         string `json:"label"`
	Quantity      int    `json:"quantity"`
	InStock       bool   `json:"inStock"`
}

// GetProductStock returns per-variant and per-option quantities for a product.
func GetProductStock(db *sqlx.DB, id string) (*ProductStock, error) {
	p, err := GetProduct(db, id)
	if err != nil {
		return nil, err
	}

	total := 0
	variants := make([]VariantStock, 0, len(p.Variants))
	for _, v := range p.Variants {
		qty := v.Quantity
		if qty < 0 {
			qty = 0
		}
		total += qty
		vals := v.AttributeValues
		if vals == nil {
			vals = map[string]string{}
		}
		variants = append(variants, VariantStock{
			ID:              v.ID,
			SKU:             v.SKU,
			Quantity:        qty,
			InStock:         qty > 0,
			AttributeValues: vals,
		})
	}

	type agg struct {
		attrID   string
		attrName string
		label    string
		qty      int
	}
	byKey := map[string]*agg{}
	for _, attr := range p.Attributes {
		for _, opt := range attr.Options {
			key := attr.ID + "\x00" + opt.Label
			byKey[key] = &agg{attrID: attr.ID, attrName: attr.Name, label: opt.Label, qty: 0}
		}
	}
	for _, v := range p.Variants {
		qty := v.Quantity
		if qty < 0 {
			qty = 0
		}
		vals := v.AttributeValues
		if len(vals) == 0 {
			continue
		}
		matched := map[string]bool{}
		for attrID, label := range vals {
			key := attrID + "\x00" + label
			if row, ok := byKey[key]; ok {
				row.qty += qty
				matched[key] = true
				continue
			}
			// Keys may be stale; match label under any attribute that has this option.
			for _, attr := range p.Attributes {
				for _, opt := range attr.Options {
					if opt.Label != label {
						continue
					}
					k2 := attr.ID + "\x00" + label
					if matched[k2] {
						continue
					}
					if row, ok := byKey[k2]; ok {
						row.qty += qty
						matched[k2] = true
					}
				}
			}
		}
	}

	options := make([]OptionStock, 0, len(byKey))
	for _, attr := range p.Attributes {
		for _, opt := range attr.Options {
			key := attr.ID + "\x00" + opt.Label
			row := byKey[key]
			qty := 0
			if row != nil {
				qty = row.qty
			}
			options = append(options, OptionStock{
				AttributeID:   attr.ID,
				AttributeName: attr.Name,
				Label:         opt.Label,
				Quantity:      qty,
				InStock:       qty > 0,
			})
		}
	}

	return &ProductStock{
		ProductID:     p.ID,
		TotalQuantity: total,
		Variants:      variants,
		Options:       options,
	}, nil
}

// WithTx wrapper to avoid import cycle with internal/db. (kept minimal here)
func WithTx(db *sqlx.DB, fn func(*sqlx.Tx) error) error {
	tx, err := db.Beginx()
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}
