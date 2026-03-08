
UPDATE player_stats
SET custom_settings = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(custom_settings, '{}'::jsonb),
      '{fontFamily}', '"Russo One"'::jsonb
    ),
    '{fontSize}', '12'::jsonb
  ),
  '{buttonSize}', '"small"'::jsonb
)
WHERE telegram_id = 169262990;
