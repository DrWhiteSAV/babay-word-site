
-- Add game_status to player_stats to track if user has a character or has been reset
ALTER TABLE public.player_stats 
ADD COLUMN IF NOT EXISTS game_status text NOT NULL DEFAULT 'creating';

-- Update existing rows that have a character_name to 'playing'
UPDATE public.player_stats 
SET game_status = 'playing' 
WHERE character_name IS NOT NULL AND character_name != '';

-- Add referral_bonus_claimed to player_stats to prevent duplicate referral bonuses
ALTER TABLE public.player_stats
ADD COLUMN IF NOT EXISTS referral_bonus_claimed boolean NOT NULL DEFAULT false;

-- Add a table to track profile snapshots for rollback feature
CREATE TABLE IF NOT EXISTS public.player_stats_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id bigint NOT NULL,
  snapshot_at timestamp with time zone NOT NULL DEFAULT now(),
  character_name text,
  character_gender text,
  character_style text,
  avatar_url text,
  lore text,
  fear integer NOT NULL DEFAULT 0,
  watermelons integer NOT NULL DEFAULT 0,
  energy integer NOT NULL DEFAULT 100,
  boss_level integer NOT NULL DEFAULT 0,
  telekinesis_level integer NOT NULL DEFAULT 1,
  custom_settings jsonb DEFAULT '{}'::jsonb,
  snapshot_reason text DEFAULT 'manual'
);

ALTER TABLE public.player_stats_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "History viewable by everyone" ON public.player_stats_history
  FOR SELECT USING (true);

CREATE POLICY "History insertable by anyone" ON public.player_stats_history
  FOR INSERT WITH CHECK (true);
