
-- Add UPDATE policy to chat_messages (correct syntax without IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Chat messages updatable by anyone'
  ) THEN
    EXECUTE 'CREATE POLICY "Chat messages updatable by anyone" ON public.chat_messages FOR UPDATE USING (true)';
  END IF;
END $$;
