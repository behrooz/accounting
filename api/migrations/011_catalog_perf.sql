-- Catalog read performance (storefront listing, sorting, filters)

-- Newest-first listing
ALTER TABLE products
  ADD KEY ix_products_updated_id (updated_at DESC, id DESC);

-- Category filter + sort
ALTER TABLE products
  ADD KEY ix_products_category_updated (category_id, updated_at DESC, id DESC);

-- Variant lookups (stock, sale filter, price sort subqueries)
ALTER TABLE product_variants
  ADD KEY ix_var_product_sale (product_id, sale_price);

ALTER TABLE product_variants
  ADD KEY ix_var_product_price (product_id, price);

-- Customer phone lookup at checkout
ALTER TABLE customers
  ADD KEY ix_customers_phone (phone);
