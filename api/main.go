package main

import (
	"context"
	"database/sql"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"accounting-api/internal/auth"
	"accounting-api/internal/config"
	"accounting-api/internal/db"
	"accounting-api/internal/httpx"
	"accounting-api/internal/media"
	"accounting-api/internal/migrate"
	"accounting-api/internal/models"
	"accounting-api/internal/repo"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	cfg := config.Load()

	if err := db.EnsureDatabase(context.Background(), cfg.MySQLDSN); err != nil {
		panic(err)
	}

	database, err := db.Open(cfg.MySQLDSN)
	if err != nil {
		panic(err)
	}
	if err := db.Ping(context.Background(), database); err != nil {
		panic(err)
	}

	_ = media.EnsureDirs()
	// Convert any legacy base64 blobs to files BEFORE shrinking columns in 005_*.sql
	if err := media.MigrateBase64Images(database); err != nil {
		panic(err)
	}

	// migrations
	migrationsDir := filepath.Join(".", "migrations")
	if err := migrate.Apply(database, migrationsDir); err != nil {
		panic(err)
	}
	// Safety net when older environments missed ALTER TABLE statements
	if err := repo.EnsureStorefrontSchema(database); err != nil {
		panic(err)
	}
	if err := repo.EnsureShopSettings(database); err != nil {
		panic(err)
	}

	// seed default admin (admin / 123456)
	hash, _ := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.DefaultCost)
	_ = repo.EnsureDefaultAdmin(database, "seed-admin", "مدیر سیستم", "admin", string(hash))

	if cfg.Env == "prod" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()
	r.Use(httpx.Cors(cfg.CorsOrigin))
	r.MaxMultipartMemory = 12 << 20 // 12 MiB

	// Serve uploaded product images: /assets/product/<file>
	r.Static("/assets", "./assets")

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	api := r.Group("/api")

	// Public categories (storefront)
	api.GET("/categories", func(c *gin.Context) {
		rows, err := repo.ListCategories(database)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
			return
		}
		c.JSON(http.StatusOK, rows)
	})
	api.GET("/categories/:id", func(c *gin.Context) {
		row, err := repo.GetCategory(database, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusOK, row)
	})

	// Auth (dashboard staff login)
	api.POST("/auth/login", func(c *gin.Context) {
		var body struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}

		u, err := repo.GetUserByUsername(database, body.Username)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
			return
		}
		if !u.IsActive {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user inactive"})
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(body.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}

		token, err := auth.Sign(cfg.JWTSecret, u.ID, u.Username, u.Role)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"token": token,
			"user": gin.H{"id": u.ID, "fullName": u.FullName, "username": u.Username, "role": u.Role},
		})
	})

	// ── Storefront public (no JWT) — catalog + checkout + phone-based addresses ──
	api.GET("/products", func(c *gin.Context) {
		ps, err := repo.ListProducts(database)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
			return
		}
		c.JSON(http.StatusOK, ps)
	})
	api.GET("/products/:id", func(c *gin.Context) {
		p, err := repo.GetProduct(database, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusOK, p)
	})
	api.POST("/checkout", func(c *gin.Context) {
		var body repo.CheckoutRequest
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}
		inv, err := repo.CreateStorefrontOrder(database, body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, inv)
	})
	api.GET("/store/customer", func(c *gin.Context) {
		phone := strings.TrimSpace(c.Query("phone"))
		if phone == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "phone required"})
			return
		}
		cust, err := repo.FindCustomerByPhone(database, phone)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		addrs, _ := repo.ListAddresses(database, cust.ID)
		cust.Addresses = addrs
		c.JSON(http.StatusOK, cust)
	})
	api.POST("/store/addresses", func(c *gin.Context) {
		var body struct {
			Phone   string                 `json:"phone"`
			Name    string                 `json:"name"`
			Address models.CustomerAddress `json:"address"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Phone) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "phone and address required"})
			return
		}
		cust, err := repo.EnsureCustomerByPhone(database, body.Name, body.Phone, "مشتری فروشگاه آنلاین")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		a := body.Address
		a.CustomerID = cust.ID
		if a.ID == "" {
			a.ID = repo.NewID()
		}
		if a.Phone == "" {
			a.Phone = body.Phone
		}
		if a.FullName == "" {
			a.FullName = body.Name
		}
		if err := repo.UpsertAddress(database, a); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		addrs, _ := repo.ListAddresses(database, cust.ID)
		cust.Addresses = addrs
		c.JSON(http.StatusCreated, cust)
	})
	api.PUT("/store/addresses/:id/default", func(c *gin.Context) {
		var body struct {
			Phone string `json:"phone"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Phone) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "phone required"})
			return
		}
		cust, err := repo.FindCustomerByPhone(database, body.Phone)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "customer not found"})
			return
		}
		if err := repo.SetDefaultAddress(database, cust.ID, c.Param("id")); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		addrs, _ := repo.ListAddresses(database, cust.ID)
		cust.Addresses = addrs
		c.JSON(http.StatusOK, cust)
	})
	api.DELETE("/store/addresses/:id", func(c *gin.Context) {
		phone := strings.TrimSpace(c.Query("phone"))
		if phone == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "phone required"})
			return
		}
		cust, err := repo.FindCustomerByPhone(database, phone)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "customer not found"})
			return
		}
		a, err := repo.GetAddress(database, c.Param("id"))
		if err != nil || a.CustomerID != cust.ID {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		_ = repo.DeleteAddress(database, a.ID)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// ── Dashboard (JWT required) ──
	authed := api.Group("")
	authed.Use(httpx.AuthRequired(cfg.JWTSecret))

	authed.GET("/me", func(c *gin.Context) {
		u := c.MustGet(httpx.CtxUserKey).(httpx.SessionUser)
		c.JSON(http.StatusOK, u)
	})

	// Shop / sender profile (used on shipping labels)
	authed.GET("/shop-settings", func(c *gin.Context) {
		s, err := repo.GetShopSettings(database)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
			return
		}
		c.JSON(http.StatusOK, s)
	})
	authed.PUT("/shop-settings", func(c *gin.Context) {
		var body repo.ShopSettings
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}
		body.Name = strings.TrimSpace(body.Name)
		body.Phone = strings.TrimSpace(body.Phone)
		body.Address = strings.TrimSpace(body.Address)
		if body.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
			return
		}
		if err := repo.UpsertShopSettings(database, body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// Product image upload → assets/product/<file>, DB stores relative path
	authed.POST("/uploads/product", func(c *gin.Context) {
		fh, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "file required"})
			return
		}
		f, err := fh.Open()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot open file"})
			return
		}
		defer f.Close()

		path, err := media.SaveUpload(f, fh.Header.Get("Content-Type"), fh.Filename)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{
			"path":     path,
			"url":      "/" + path,
			"filename": filepath.Base(path),
		})
	})

	// Users (admin only)
	users := authed.Group("/users", httpx.RequireRole("admin"))
	users.GET("", func(c *gin.Context) {
		us, err := repo.ListUsers(database)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
			return
		}
		// strip password_hash
		out := make([]gin.H, 0, len(us))
		for _, u := range us {
			out = append(out, gin.H{
				"id": u.ID, "fullName": u.FullName, "username": u.Username,
				"role": u.Role, "isActive": u.IsActive,
				"createdAt": u.CreatedAt, "updatedAt": u.UpdatedAt,
			})
		}
		c.JSON(http.StatusOK, out)
	})
	users.POST("", func(c *gin.Context) {
		var body struct {
			ID       string `json:"id"`
			FullName string `json:"fullName"`
			Username string `json:"username"`
			Password string `json:"password"`
			Role     string `json:"role"`
			IsActive bool   `json:"isActive"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}
		if body.ID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
			return
		}
		pwHash, _ := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
		u := models.User{
			ID:           body.ID,
			FullName:     strings.TrimSpace(body.FullName),
			Username:     strings.TrimSpace(body.Username),
			PasswordHash: string(pwHash),
			Role:         body.Role,
			IsActive:     body.IsActive,
		}
		if u.Role == "" {
			u.Role = "staff"
		}
		if err := repo.CreateUser(database, u); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"ok": true})
	})
	users.PUT("/:id", func(c *gin.Context) {
		id := c.Param("id")
		var body struct {
			FullName string `json:"fullName"`
			Username string `json:"username"`
			Password string `json:"password"`
			Role     string `json:"role"`
			IsActive bool   `json:"isActive"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}
		pwHash, _ := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
		u := models.User{
			ID:           id,
			FullName:     strings.TrimSpace(body.FullName),
			Username:     strings.TrimSpace(body.Username),
			PasswordHash: string(pwHash),
			Role:         body.Role,
			IsActive:     body.IsActive,
		}
		if u.Role == "" {
			u.Role = "staff"
		}
		if err := repo.UpdateUser(database, u); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	users.DELETE("/:id", func(c *gin.Context) {
		if err := repo.DeleteUser(database, c.Param("id")); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// Categories (admin write — list/get are public above)
	authed.POST("/categories", func(c *gin.Context) {
		var body models.ProductCategory
		if err := c.ShouldBindJSON(&body); err != nil || body.ID == "" || body.Name == "" || body.Slug == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}
		if err := repo.UpsertCategory(database, body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"ok": true})
	})
	authed.PUT("/categories/:id", func(c *gin.Context) {
		var body models.ProductCategory
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}
		body.ID = c.Param("id")
		if err := repo.UpsertCategory(database, body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	authed.DELETE("/categories/:id", func(c *gin.Context) {
		_ = repo.DeleteCategory(database, c.Param("id"))
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// Products (write ops auth — list/get are public above)
	authed.POST("/products", func(c *gin.Context) {
		var p models.Product
		if err := c.ShouldBindJSON(&p); err != nil || p.ID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}
		if err := repo.UpsertProduct(database, p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"ok": true})
	})
	authed.PUT("/products/:id", func(c *gin.Context) {
		var p models.Product
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}
		p.ID = c.Param("id")
		if err := repo.UpsertProduct(database, p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	authed.DELETE("/products/:id", func(c *gin.Context) {
		_ = repo.DeleteProduct(database, c.Param("id"))
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// Customers
	authed.GET("/customers", func(c *gin.Context) {
		cs, err := repo.ListCustomers(database)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
			return
		}
		c.JSON(http.StatusOK, cs)
	})
	authed.POST("/customers", func(c *gin.Context) {
		var customer models.Customer
		if err := c.ShouldBindJSON(&customer); err != nil || customer.ID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}
		if err := repo.UpsertCustomer(database, customer); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"ok": true})
	})
	authed.PUT("/customers/:id", func(c *gin.Context) {
		var customer models.Customer
		if err := c.ShouldBindJSON(&customer); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}
		customer.ID = c.Param("id")
		if err := repo.UpsertCustomer(database, customer); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	authed.DELETE("/customers/:id", func(c *gin.Context) {
		if err := repo.DeleteCustomer(database, c.Param("id")); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// Invoices
	authed.GET("/invoices", func(c *gin.Context) {
		invs, err := repo.ListInvoices(database, repo.InvoiceListFilter{
			DateFrom:     c.Query("dateFrom"),
			DateTo:       c.Query("dateTo"),
			Number:       c.Query("number"),
			CustomerName: c.Query("customerName"),
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server error", "detail": err.Error()})
			return
		}
		c.JSON(http.StatusOK, invs)
	})
	authed.GET("/invoices/next-number", func(c *gin.Context) {
		n, err := repo.NextInvoiceNumber(database)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"number": n})
	})
	authed.GET("/invoices/:id", func(c *gin.Context) {
		inv, err := repo.GetInvoice(database, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusOK, inv)
	})
	authed.POST("/invoices", func(c *gin.Context) {
		var inv models.Invoice
		if err := c.ShouldBindJSON(&inv); err != nil || inv.ID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}
		if err := repo.UpsertInvoice(database, inv); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"ok": true})
	})
	authed.PUT("/invoices/:id", func(c *gin.Context) {
		var inv models.Invoice
		if err := c.ShouldBindJSON(&inv); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}
		inv.ID = c.Param("id")
		if err := repo.UpsertInvoice(database, inv); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	authed.DELETE("/invoices/:id", func(c *gin.Context) {
		if err := repo.DeleteInvoice(database, c.Param("id")); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// Reports (dashboard + profit-loss derived from products + invoices)
	authed.GET("/dashboard", func(c *gin.Context) {
		ps, err := repo.ListProducts(database)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
			return
		}

		type lowStockRow struct {
			ProductName string `json:"productName"`
			AttrLabel   string `json:"attrLabel"`
			SKU         string `json:"sku"`
			Quantity    int    `json:"quantity"`
		}

		totalVariants := 0
		totalStock := 0
		var purchaseValue int64
		var saleValue int64
		low := []lowStockRow{}

		for _, p := range ps {
			totalVariants += len(p.Variants)
			for _, v := range p.Variants {
				totalStock += v.Quantity
				purchaseValue += v.Price * int64(v.Quantity)
				saleValue += v.SalePrice * int64(v.Quantity)
				if v.Quantity <= 5 {
					attrLabel := "—"
					if len(v.AttributeValues) > 0 {
						parts := make([]string, 0, len(v.AttributeValues))
						for _, val := range v.AttributeValues {
							parts = append(parts, val)
						}
						attrLabel = strings.Join(parts, " / ")
					}
					low = append(low, lowStockRow{ProductName: p.Name, AttrLabel: attrLabel, SKU: v.SKU, Quantity: v.Quantity})
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"totalProducts": len(ps),
			"totalVariants": totalVariants,
			"totalStock":    totalStock,
			"purchaseValue": purchaseValue,
			"saleValue":     saleValue,
			"profit":        saleValue - purchaseValue,
			"lowStock":      low,
		})
	})

	authed.GET("/reports/profit-loss", func(c *gin.Context) {
		ps, err := repo.ListProducts(database)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
			return
		}

		type variantRow struct {
			ID        string `json:"id"`
			AttrLabel string `json:"attrLabel"`
			SKU       string `json:"sku"`
			Quantity  int    `json:"quantity"`
			UnitCost  int64  `json:"unitCost"`
			UnitSale  int64  `json:"unitSale"`
			TotalCost int64  `json:"totalCost"`
			TotalSale int64  `json:"totalSale"`
			Profit    int64  `json:"profit"`
			Margin    *float64 `json:"margin"`
		}
		type productRow struct {
			ID          string       `json:"id"`
			Name        string       `json:"name"`
			VariantCount int         `json:"variantCount"`
			TotalStock  int          `json:"totalStock"`
			TotalCost   int64        `json:"totalCost"`
			TotalSale   int64        `json:"totalSale"`
			Profit      int64        `json:"profit"`
			Margin      *float64     `json:"margin"`
			Variants    []variantRow `json:"variants"`
		}

		rows := make([]productRow, 0, len(ps))
		for _, p := range ps {
			var totalCost int64
			var totalSale int64
			totalStock := 0
			var variants []variantRow
			for _, v := range p.Variants {
				tc := v.Price * int64(v.Quantity)
				ts := v.SalePrice * int64(v.Quantity)
				profit := ts - tc
				totalCost += tc
				totalSale += ts
				totalStock += v.Quantity
				attrLabel := "ترکیب ساده"
				if len(v.AttributeValues) > 0 {
					parts := make([]string, 0, len(v.AttributeValues))
					for _, val := range v.AttributeValues {
						parts = append(parts, val)
					}
					attrLabel = strings.Join(parts, " / ")
				}
				var margin *float64
				if tc > 0 {
					m := (float64(profit) / float64(tc)) * 100
					margin = &m
				}
				variants = append(variants, variantRow{
					ID: v.ID, AttrLabel: attrLabel, SKU: v.SKU, Quantity: v.Quantity,
					UnitCost: v.Price, UnitSale: v.SalePrice,
					TotalCost: tc, TotalSale: ts, Profit: profit, Margin: margin,
				})
			}
			profit := totalSale - totalCost
			var margin *float64
			if totalCost > 0 {
				m := (float64(profit) / float64(totalCost)) * 100
				margin = &m
			}
			rows = append(rows, productRow{
				ID: p.ID, Name: p.Name, VariantCount: len(p.Variants), TotalStock: totalStock,
				TotalCost: totalCost, TotalSale: totalSale, Profit: profit, Margin: margin,
				Variants: variants,
			})
		}

		c.JSON(http.StatusOK, gin.H{"rows": rows})
	})

	port := cfg.Port
	if !strings.HasPrefix(port, ":") {
		port = ":" + port
	}

	// Helpful for local debugging
	_ = os.Setenv("TZ", "Asia/Tehran")

	if err := r.Run(port); err != nil {
		panic(err)
	}
}
