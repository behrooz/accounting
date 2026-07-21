package repo

import "accounting-api/internal/models"

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
