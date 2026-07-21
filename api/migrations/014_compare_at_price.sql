-- Customer-facing original price for discount badge (قیمت قبل تخفیف)
ALTER TABLE product_variants
  ADD COLUMN compare_at_price BIGINT NOT NULL DEFAULT 0 AFTER sale_price;
