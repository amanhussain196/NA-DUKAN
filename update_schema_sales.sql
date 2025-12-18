-- Run this in your Supabase SQL Editor to add a readable Bill Number

-- Add an auto-incrementing bill_number column
ALTER TABLE public.bills 
ADD COLUMN bill_number SERIAL;

-- If you already have data, this will automatically populate unique numbers for existing rows.
