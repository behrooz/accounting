package repo

import "accounting-api/internal/models"

// SQL helpers for storefront sale/discount filters.
const (
	variantDisplayPriceSQL = `CASE WHEN v.sale_price > 0 THEN v.sale_price ELSE v.price END`
	onSaleProductExistsSQL   = `EXISTS (
  SELECT 1 FROM product_variants v
  WHERE v.product_id = p.id
    AND v.compare_at_price > 0
    AND (` + variantDisplayPriceSQL + `) > 0
    AND v.compare_at_price > (` + variantDisplayPriceSQL + `)
)`
	maxDiscountPercentSQL = `COALESCE((
  SELECT MAX(
    CASE
      WHEN v.compare_at_price > 0
        AND (` + variantDisplayPriceSQL + `) > 0
        AND v.compare_at_price > (` + variantDisplayPriceSQL + `)
      THEN FLOOR((v.compare_at_price - (` + variantDisplayPriceSQL + `)) * 100 / v.compare_at_price)
      ELSE 0
    END
  )
  FROM product_variants v
  WHERE v.product_id = p.id
), 0)`
)

func variantDisplayPrice(v models.ProductVariant) int64 {
	if v.SalePrice > 0 {
		return v.SalePrice
	}
	if v.Price > 0 {
		return v.Price
	}
	return 0
}

func variantDiscountPercent(v models.ProductVariant) int {
	display := variantDisplayPrice(v)
	if v.CompareAtPrice <= 0 || display <= 0 || v.CompareAtPrice <= display {
		return 0
	}
	return int((v.CompareAtPrice - display) * 100 / v.CompareAtPrice)
}

// ApplyProductListingPricing fills storefront listing fields from variant prices.
func ApplyProductListingPricing(p *models.Product) {
	if p == nil {
		return
	}

	var minDisplay int64
	var compareForMin int64
	maxDiscount := 0
	onSale := false

	for _, v := range p.Variants {
		display := variantDisplayPrice(v)
		if display <= 0 {
			continue
		}

		if minDisplay == 0 || display < minDisplay {
			minDisplay = display
			compareForMin = 0
			if v.CompareAtPrice > display {
				compareForMin = v.CompareAtPrice
			}
		}

		if pct := variantDiscountPercent(v); pct > 0 {
			onSale = true
			if pct > maxDiscount {
				maxDiscount = pct
			}
		}
	}

	p.DisplayPrice = minDisplay
	p.CompareAtPrice = 0
	p.DiscountPercent = 0
	p.OnSale = false

	if minDisplay > 0 && onSale {
		p.OnSale = true
		p.DiscountPercent = maxDiscount
		if compareForMin > minDisplay {
			p.CompareAtPrice = compareForMin
		}
	}
}
