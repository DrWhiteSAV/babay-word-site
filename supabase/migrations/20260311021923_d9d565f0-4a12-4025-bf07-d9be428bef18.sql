
-- Drop the unique constraint on page_path to allow multiple backgrounds per page
ALTER TABLE public.page_backgrounds DROP CONSTRAINT IF EXISTS page_backgrounds_page_path_key;

-- Add sort_order column for ordering multiple backgrounds per page
ALTER TABLE public.page_backgrounds ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
