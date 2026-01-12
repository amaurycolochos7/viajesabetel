-- Add payment reference and optional notes to ticket_orders
-- This allows storing MercadoPago payment IDs and other payment details

ALTER TABLE public.ticket_orders 
ADD COLUMN IF NOT EXISTS payment_reference TEXT,
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- Add index for faster queries by reference
CREATE INDEX IF NOT EXISTS idx_ticket_orders_payment_reference 
ON public.ticket_orders(payment_reference) 
WHERE payment_reference IS NOT NULL;

COMMENT ON COLUMN public.ticket_orders.payment_reference IS 'External payment reference (e.g., MercadoPago payment ID)';
COMMENT ON COLUMN public.ticket_orders.payment_notes IS 'Additional payment notes or details';
