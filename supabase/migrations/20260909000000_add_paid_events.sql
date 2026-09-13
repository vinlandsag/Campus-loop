-- Add paid event fields to the events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) NULL;
