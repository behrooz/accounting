ALTER TABLE invoices
  ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'dashboard'
  AFTER status;
