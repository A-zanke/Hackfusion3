-- Optional: Add age column to orders table
-- Run this migration if you want to store customer age in the orders table

ALTER TABLE orders 
ADD COLUMN age INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN orders.age IS 'Customer age (optional)';
