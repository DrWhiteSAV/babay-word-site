
-- Insert reverse/mutual friend records for all existing friendships
-- where the reverse record doesn't already exist
-- Uses ON CONFLICT DO NOTHING to safely skip duplicates

INSERT INTO public.friends (telegram_id, friend_telegram_id, friend_name, is_ai_enabled)
SELECT
  f.friend_telegram_id          AS telegram_id,
  f.telegram_id                 AS friend_telegram_id,
  COALESCE(ps.character_name, p.first_name, 'Бабай') AS friend_name,
  false                         AS is_ai_enabled
FROM public.friends f
LEFT JOIN public.player_stats ps ON ps.telegram_id = f.telegram_id
LEFT JOIN public.profiles p ON p.telegram_id = f.telegram_id
WHERE f.friend_telegram_id IS NOT NULL
  -- only insert if the reverse doesn't already exist
  AND NOT EXISTS (
    SELECT 1 FROM public.friends r
    WHERE r.telegram_id = f.friend_telegram_id
      AND r.friend_telegram_id = f.telegram_id
  );
