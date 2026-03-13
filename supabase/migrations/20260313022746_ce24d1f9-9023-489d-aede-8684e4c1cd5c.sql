-- Add target goal to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS target integer NOT NULL DEFAULT 1;

-- Add progress tracking to player_events
ALTER TABLE public.player_events ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0;
ALTER TABLE public.player_events ADD COLUMN IF NOT EXISTS target integer NOT NULL DEFAULT 1;

-- Add unique constraint for player_events to allow upsert
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_events_telegram_event_unique') THEN
    ALTER TABLE public.player_events ADD CONSTRAINT player_events_telegram_event_unique UNIQUE (telegram_id, event_id);
  END IF;
END $$;