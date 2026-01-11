-- Add seat_number column to reservation_passengers table
ALTER TABLE reservation_passengers 
ADD COLUMN IF NOT EXISTS seat_number TEXT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reservation_passengers' AND column_name = 'seat_number';
