-- Restore correct avatar for telegram_id 169262990 from gallery (most recent avatar entry)
UPDATE player_stats
SET avatar_url = (
  SELECT image_url FROM gallery
  WHERE telegram_id = 169262990
    AND (LOWER(label) LIKE '%[avatar%' OR LOWER(label) LIKE '%аватар%')
  ORDER BY created_at DESC
  LIMIT 1
)
WHERE telegram_id = 169262990;