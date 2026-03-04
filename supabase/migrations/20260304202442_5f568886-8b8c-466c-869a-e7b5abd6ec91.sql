
CREATE TABLE public.video_cutscenes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orientation text NOT NULL DEFAULT 'vertical',
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.video_cutscenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Video cutscenes viewable by everyone" ON public.video_cutscenes FOR SELECT USING (true);
CREATE POLICY "Video cutscenes insertable by anyone" ON public.video_cutscenes FOR INSERT WITH CHECK (true);
CREATE POLICY "Video cutscenes updatable by anyone" ON public.video_cutscenes FOR UPDATE USING (true);
CREATE POLICY "Video cutscenes deletable by anyone" ON public.video_cutscenes FOR DELETE USING (true);

CREATE TABLE public.page_backgrounds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_path text NOT NULL UNIQUE,
  url text NOT NULL DEFAULT '',
  dimming integer NOT NULL DEFAULT 80,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.page_backgrounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Page backgrounds viewable by everyone" ON public.page_backgrounds FOR SELECT USING (true);
CREATE POLICY "Page backgrounds insertable by anyone" ON public.page_backgrounds FOR INSERT WITH CHECK (true);
CREATE POLICY "Page backgrounds updatable by anyone" ON public.page_backgrounds FOR UPDATE USING (true);
CREATE POLICY "Page backgrounds deletable by anyone" ON public.page_backgrounds FOR DELETE USING (true);

CREATE TRIGGER update_page_backgrounds_updated_at
  BEFORE UPDATE ON public.page_backgrounds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
