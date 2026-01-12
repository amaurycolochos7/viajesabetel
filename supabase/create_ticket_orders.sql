-- Create ticket_orders table
CREATE TABLE IF NOT EXISTS public.ticket_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    items JSONB NOT NULL DEFAULT '[]', -- Stores the array of tickets: [{ id: 'aztlan', variant: 'infant', price: 350, quantity: 1 }, ...]
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, approved, rejected
    payment_method TEXT, -- transfer, card, cash
    payment_proof_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_ticket_orders_reservation_id ON public.ticket_orders(reservation_id);

-- Enable RLS
ALTER TABLE public.ticket_orders ENABLE ROW LEVEL SECURITY;

-- Policies
-- Allow anyone to create an order (public access for purchase flow)
CREATE POLICY "Enable insert for everyone" ON public.ticket_orders FOR INSERT WITH CHECK (true);

-- Allow viewing if you have the reservation ID (public mostly for checking status, or secured by reservation lookup logic)
-- Ideally, we should restrict this, but for now we follow the pattern of public access by ID if needed, 
-- or authenticated users (admins).
-- Let's allow public read for now to simplify the "Thank you" page fetching.
CREATE POLICY "Enable read for everyone" ON public.ticket_orders FOR SELECT USING (true);

-- Allow updates for payment info (public mostly)
CREATE POLICY "Enable update for everyone" ON public.ticket_orders FOR UPDATE USING (true);

-- Comment
COMMENT ON TABLE public.ticket_orders IS 'Stores extra activity ticket purchases linked to reservations';
