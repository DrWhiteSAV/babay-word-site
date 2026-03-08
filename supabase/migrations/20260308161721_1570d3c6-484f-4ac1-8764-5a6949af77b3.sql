-- Required for Supabase Realtime to broadcast full row data on INSERT/UPDATE
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;