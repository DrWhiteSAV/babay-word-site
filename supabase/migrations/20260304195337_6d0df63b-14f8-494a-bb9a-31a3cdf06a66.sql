
-- Таблица профилей пользователей Telegram
CREATE TABLE public.profiles (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id   BIGINT      NOT NULL UNIQUE,
  first_name    TEXT        NOT NULL DEFAULT '',
  last_name     TEXT,
  username      TEXT,
  profile_url   TEXT,
  photo_url     TEXT,
  referral_code TEXT,
  role          TEXT        NOT NULL DEFAULT 'Бабай',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Anyone can insert a profile"
  ON public.profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update a profile"
  ON public.profiles FOR UPDATE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_profiles_telegram_id ON public.profiles(telegram_id);
CREATE INDEX idx_profiles_referral_code ON public.profiles(referral_code);
