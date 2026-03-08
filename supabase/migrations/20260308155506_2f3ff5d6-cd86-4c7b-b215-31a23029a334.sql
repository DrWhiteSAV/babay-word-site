
-- Fix self-looped key: '6497746504_6497746504' belongs to the DM between 169262990 and 6497746504
UPDATE public.chat_messages
SET chat_key = '169262990_6497746504'
WHERE chat_key = '6497746504_6497746504';
