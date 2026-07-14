-- Per-attribute flag: whether variants may upload images for this attribute
ALTER TABLE product_attributes
  ADD COLUMN allow_image TINYINT(1) NOT NULL DEFAULT 1 AFTER name;
