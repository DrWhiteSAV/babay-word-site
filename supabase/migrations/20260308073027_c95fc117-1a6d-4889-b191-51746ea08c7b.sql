INSERT INTO public.player_stats (
  telegram_id, character_name, character_gender, character_style,
  game_status, fear, energy, watermelons, telekinesis_level, boss_level,
  custom_settings
) VALUES (
  169262991,
  'Тест Бабай',
  'Бабай',
  'Киберпанк',
  'playing',
  500,
  100,
  10,
  3,
  1,
  '{"buttonSize":"medium","fontFamily":"JetBrains Mono","fontSize":16,"fontBrightness":100,"theme":"normal","musicVolume":50,"ttsEnabled":false,"wishes":["Светящиеся глаза","Длинные когти"],"inventory":[]}'::jsonb
)
ON CONFLICT (telegram_id) DO UPDATE SET
  character_name = EXCLUDED.character_name,
  character_gender = EXCLUDED.character_gender,
  character_style = EXCLUDED.character_style,
  game_status = EXCLUDED.game_status,
  fear = EXCLUDED.fear,
  energy = EXCLUDED.energy,
  watermelons = EXCLUDED.watermelons,
  telekinesis_level = EXCLUDED.telekinesis_level,
  boss_level = EXCLUDED.boss_level,
  custom_settings = EXCLUDED.custom_settings;