package models

import "time"

type User struct {
	ID           string    `db:"id" json:"id"`
	FullName     string    `db:"full_name" json:"fullName"`
	Username     string    `db:"username" json:"username"`
	PasswordHash string    `db:"password_hash" json:"-"`
	Role         string    `db:"role" json:"role"`
	IsActive     bool      `db:"is_active" json:"isActive"`
	CreatedAt    time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt    time.Time `db:"updated_at" json:"updatedAt"`
}

type Product struct {
	ID         string             `json:"id"`
	Name       string             `json:"name"`
	CategoryID *string            `json:"categoryId,omitempty"`
	Images     []string           `json:"images,omitempty"`
	Attributes []ProductAttribute `json:"attributes"`
	Variants   []ProductVariant   `json:"variants"`
}

type ProductCategory struct {
	ID        string `db:"id" json:"id"`
	Name      string `db:"name" json:"name"`
	Slug      string `db:"slug" json:"slug"`
	Icon      string `db:"icon" json:"icon"`
	SortOrder int    `db:"sort_order" json:"sortOrder"`
	IsActive  bool   `db:"is_active" json:"isActive"`
}

type ProductAttribute struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	AllowImage bool              `json:"allowImage"`
	Options    []AttributeOption `json:"options"`
	SortOrder  int               `json:"-"`
}

type AttributeOption struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	SortOrder int    `json:"-"`
}

type ProductVariant struct {
	ID              string            `json:"id"`
	SKU             string            `json:"sku"`
	Price           int64             `json:"price"`
	SalePrice       int64             `json:"salePrice"`
	Quantity        int               `json:"quantity"`
	AttributeValues map[string]string `json:"attributeValues"`
	Image           *string           `json:"image,omitempty"`
}

type Customer struct {
	ID      string `db:"id" json:"id"`
	Name    string `db:"name" json:"name"`
	Phone   string `db:"phone" json:"phone"`
	Address string `db:"address" json:"address"`
	Notes   string `db:"notes" json:"notes"`
}

type Invoice struct {
	ID              string        `json:"id"`
	Number          string        `json:"number"`
	Date            string        `json:"date"` // YYYY-MM-DD
	CustomerID      string        `json:"customerId"`
	CustomerName    string        `json:"customerName"`
	CustomerPhone   string        `json:"customerPhone"`
	CustomerAddress string        `json:"customerAddress"`
	Items           []InvoiceItem `json:"items"`
	Notes           string        `json:"notes"`
	Discount        int64         `json:"discount"`
	Subtotal        int64         `json:"subtotal"`
	Total           int64         `json:"total"`
	Status          string        `json:"status"` // draft|confirmed
	Source          string        `json:"source"` // dashboard|storefront
	CreatedAt       string        `json:"createdAt"`
}

type InvoiceItem struct {
	ID           string `json:"id"`
	ProductID    string `json:"productId"`
	VariantID    string `json:"variantId"`
	ProductName  string `json:"productName"`
	VariantLabel string `json:"variantLabel"`
	SKU          string `json:"sku"`
	UnitPrice    int64  `json:"unitPrice"`
	Quantity     int    `json:"quantity"`
	Total        int64  `json:"total"`
	CreatedAt    string `json:"createdAt"`
}
