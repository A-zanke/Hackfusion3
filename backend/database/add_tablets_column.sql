-- Add individual tablets tracking column
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS individual_tablets INTEGER DEFAULT 0;

-- Update the total tablets calculation to include individual tablets
-- First, drop the existing generated column if it exists
DROP TRIGGER IF EXISTS update_total_tablets_trigger ON medicines;
DROP FUNCTION IF EXISTS calculate_total_tablets();

-- Create a new function to calculate total tablets
CREATE OR REPLACE FUNCTION calculate_total_tablets() RETURNS TRIGGER AS $$
BEGIN
    NEW.total_tablets = (NEW.stock_packets * NEW.tablets_per_packet) + NEW.individual_tablets;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update total_tablets
CREATE TRIGGER update_total_tablets_trigger
    BEFORE INSERT OR UPDATE ON medicines
    FOR EACH ROW
    EXECUTE FUNCTION calculate_total_tablets();

-- Update existing records to set initial total_tablets
UPDATE medicines SET total_tablets = (stock_packets * tablets_per_packet) + individual_tablets;
