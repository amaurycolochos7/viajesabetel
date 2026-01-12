-- ================================================
-- UPDATE GROUPS SCHEMA - RUN IN SUPABASE
-- ================================================

-- Add columns for Betel Reservation Code and Captain ID
ALTER TABLE tour_groups 
ADD COLUMN IF NOT EXISTS betel_code TEXT,
ADD COLUMN IF NOT EXISTS captain_id UUID REFERENCES reservation_passengers(id);

-- Optional: Create index for captain lookup if needed (though groups table is small)
-- CREATE INDEX idx_tour_groups_captain ON tour_groups(captain_id);
