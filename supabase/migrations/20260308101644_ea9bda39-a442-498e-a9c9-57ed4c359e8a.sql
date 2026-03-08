
-- Reset custom_settings to defaults for telegram_id 169262990
-- Keep: inventory, wishes, musicVolume, ttsEnabled, theme, fontBrightness
-- Fix: fontFamily → "Russo One", fontSize → 12, buttonSize → "small"
UPDATE player_stats
SET custom_settings = jsonb_set(
  jsonb_set(
    jsonb_set(
      custom_settings,
      '{fontFamily}', '"Russo One"'::jsonb
    ),
    '{fontSize}', '12'::jsonb
  ),
  '{buttonSize}', '"small"'::jsonb
)
WHERE telegram_id = 169262990;

-- Also fix all gallery labels that still have "Аватар: " prefix inside the name part
-- New format: "[avatars] Name | Lore" (without "Аватар: " anywhere)
UPDATE gallery
SET label = REGEXP_REPLACE(label, '(\[avatars\]\s*)Аватар:\s*', '\1', 'i')
WHERE telegram_id = 169262990
  AND label ~* '\[avatars\]\s*Аватар:';
