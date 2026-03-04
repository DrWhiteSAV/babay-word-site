-- Add telegram_blocked flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_blocked boolean NOT NULL DEFAULT false;

-- Create notification send history table
CREATE TABLE IF NOT EXISTS public.notification_send_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id uuid NULL,
  telegram_id bigint NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_send_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "History viewable by everyone" ON public.notification_send_history FOR SELECT USING (true);
CREATE POLICY "History insertable by anyone" ON public.notification_send_history FOR INSERT WITH CHECK (true);
CREATE POLICY "History updatable by anyone" ON public.notification_send_history FOR UPDATE USING (true);
CREATE POLICY "History deletable by anyone" ON public.notification_send_history FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_notification_send_history_telegram_id ON public.notification_send_history(telegram_id);
CREATE INDEX IF NOT EXISTS idx_notification_send_history_notification_id ON public.notification_send_history(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_send_history_status ON public.notification_send_history(status);

-- Ensure admin_notifications table exists with all needed fields
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL DEFAULT 'broadcast',
  title text NOT NULL,
  message text NOT NULL,
  trigger_event text NULL,
  is_active boolean NOT NULL DEFAULT true,
  send_telegram boolean NOT NULL DEFAULT true,
  send_popup boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_notifications' AND policyname='Admin notifs viewable') THEN
    CREATE POLICY "Admin notifs viewable" ON public.admin_notifications FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_notifications' AND policyname='Admin notifs insertable') THEN
    CREATE POLICY "Admin notifs insertable" ON public.admin_notifications FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_notifications' AND policyname='Admin notifs updatable') THEN
    CREATE POLICY "Admin notifs updatable" ON public.admin_notifications FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_notifications' AND policyname='Admin notifs deletable') THEN
    CREATE POLICY "Admin notifs deletable" ON public.admin_notifications FOR DELETE USING (true);
  END IF;
END $$;