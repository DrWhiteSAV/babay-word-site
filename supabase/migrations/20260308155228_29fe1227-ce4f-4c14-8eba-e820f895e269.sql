
-- Fix remaining name-based chat_keys → canonical numeric format
-- "169262990_Шкряб Теневой" → "169262990_6497746504"
UPDATE public.chat_messages
SET chat_key = '169262990_6497746504'
WHERE chat_key = '169262990_Шкряб Теневой';

-- Generic future-proof: convert any remaining name-based keys
-- where sender and friend both have known telegram_ids
-- (runs as no-op if no more rows match)
UPDATE public.chat_messages cm
SET chat_key = (
  SELECT 
    CASE 
      WHEN ps1.telegram_id::text < ps2.telegram_id::text 
        THEN ps1.telegram_id::text || '_' || ps2.telegram_id::text
      ELSE ps2.telegram_id::text || '_' || ps1.telegram_id::text
    END
  FROM public.player_stats ps1
  JOIN public.player_stats ps2 ON ps2.character_name = cm.friend_name
  WHERE ps1.telegram_id = cm.telegram_id
  LIMIT 1
)
WHERE chat_key IS NOT NULL
  AND chat_key NOT LIKE 'group_%'
  AND chat_key NOT LIKE 'ai_%'
  AND chat_key ~ '[A-Za-zА-Яа-яЁё]';
