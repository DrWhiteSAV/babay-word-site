
CREATE TABLE public.avatars (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id bigint NOT NULL REFERENCES public.profiles(telegram_id) ON DELETE CASCADE,
  image_url text NOT NULL,
  name text NOT NULL DEFAULT '',
  lore text,
  wishes text[] DEFAULT ARRAY[]::text[],
  style text,
  gender text,
  gallery_item_id uuid REFERENCES public.gallery(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Avatars viewable by everyone" ON public.avatars FOR SELECT USING (true);
CREATE POLICY "Avatars insertable by anyone" ON public.avatars FOR INSERT WITH CHECK (true);
CREATE POLICY "Avatars updatable by anyone" ON public.avatars FOR UPDATE USING (true);
CREATE POLICY "Avatars deletable by anyone" ON public.avatars FOR DELETE USING (true);

CREATE INDEX idx_avatars_telegram_id ON public.avatars(telegram_id);
CREATE INDEX idx_avatars_created_at ON public.avatars(telegram_id, created_at DESC);
