
-- Reduce dimming for game pages to make them less dark (was 80, now 35)
UPDATE public.page_backgrounds
SET dimming = 35
WHERE page_path IN ('/game', '/pvp/room', '/pvp/results')
  AND dimming > 35;

-- Also update ai_settings prompts to include mandatory image URL instruction
UPDATE public.ai_settings
SET prompt = CASE
  WHEN section_id = 'avatar' AND prompt NOT LIKE '%ОБЯЗАТЕЛЬНО верни%' THEN
    prompt || ' ОБЯЗАТЕЛЬНО верни прямую ссылку на сгенерированное изображение.'
  WHEN section_id = 'avatar_shop' AND prompt NOT LIKE '%ОБЯЗАТЕЛЬНО верни%' THEN
    prompt || ' ОБЯЗАТЕЛЬНО верни прямую ссылку на сгенерированное изображение.'
  WHEN section_id = 'background' AND prompt NOT LIKE '%ОБЯЗАТЕЛЬНО верни%' THEN
    prompt || ' ОБЯЗАТЕЛЬНО верни прямую ссылку на сгенерированное изображение.'
  WHEN section_id = 'boss' AND prompt NOT LIKE '%ОБЯЗАТЕЛЬНО верни%' THEN
    prompt || ' ОБЯЗАТЕЛЬНО верни прямую ссылку на сгенерированное изображение.'
  ELSE prompt
END
WHERE section_id IN ('avatar', 'avatar_shop', 'background', 'boss')
  AND prompt != '';
