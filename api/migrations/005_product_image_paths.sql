-- Store image filenames/paths instead of base64 blobs.
-- Existing data: URLs are converted by media.MigrateBase64Images on API startup before this runs
-- (conversion happens in app; this migration only shrinks column types when safe).

ALTER TABLE product_images
  MODIFY COLUMN image VARCHAR(512) NOT NULL;

ALTER TABLE product_variants
  MODIFY COLUMN image VARCHAR(512) NULL;
