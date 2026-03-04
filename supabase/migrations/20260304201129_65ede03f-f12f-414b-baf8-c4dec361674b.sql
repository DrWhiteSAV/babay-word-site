
-- ============================================================
-- ADMIN SETTINGS TABLES
-- ============================================================

-- Global app texts (admin editable)
CREATE TABLE public.app_texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.app_texts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Texts viewable by everyone" ON public.app_texts FOR SELECT USING (true);
CREATE POLICY "Texts insertable by anyone" ON public.app_texts FOR INSERT WITH CHECK (true);
CREATE POLICY "Texts updatable by anyone" ON public.app_texts FOR UPDATE USING (true);

-- Audio settings (admin editable)
CREATE TABLE public.audio_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  label text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.audio_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audio viewable by everyone" ON public.audio_settings FOR SELECT USING (true);
CREATE POLICY "Audio insertable by anyone" ON public.audio_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Audio updatable by anyone" ON public.audio_settings FOR UPDATE USING (true);

-- Shop items
CREATE TABLE public.shop_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  cost integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'fear',
  icon text NOT NULL DEFAULT '🎭',
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop items viewable by everyone" ON public.shop_items FOR SELECT USING (true);
CREATE POLICY "Shop items insertable by anyone" ON public.shop_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Shop items updatable by anyone" ON public.shop_items FOR UPDATE USING (true);

-- Store config (multipliers, costs, etc.)
CREATE TABLE public.store_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value numeric NOT NULL DEFAULT 0,
  label text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.store_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store config viewable by everyone" ON public.store_config FOR SELECT USING (true);
CREATE POLICY "Store config insertable by anyone" ON public.store_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Store config updatable by anyone" ON public.store_config FOR UPDATE USING (true);

-- AI settings (model, prompt per section)
CREATE TABLE public.ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id text NOT NULL UNIQUE,
  name text NOT NULL,
  service text NOT NULL DEFAULT 'gemini-3.1-pro-preview',
  prompt text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AI settings viewable by everyone" ON public.ai_settings FOR SELECT USING (true);
CREATE POLICY "AI settings insertable by anyone" ON public.ai_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "AI settings updatable by anyone" ON public.ai_settings FOR UPDATE USING (true);

-- Media (images/videos for admin gallery/video sections)
CREATE TABLE public.media_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('image', 'video_vertical', 'video_horizontal')),
  url text NOT NULL,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Media viewable by everyone" ON public.media_items FOR SELECT USING (true);
CREATE POLICY "Media insertable by anyone" ON public.media_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Media updatable by anyone" ON public.media_items FOR UPDATE USING (true);
CREATE POLICY "Media deletable by anyone" ON public.media_items FOR DELETE USING (true);

-- ============================================================
-- GAME DATA TABLES
-- ============================================================

-- Player game state (per telegram_id)
CREATE TABLE public.player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL UNIQUE REFERENCES public.profiles(telegram_id) ON DELETE CASCADE,
  fear integer NOT NULL DEFAULT 0,
  watermelons integer NOT NULL DEFAULT 0,
  energy integer NOT NULL DEFAULT 100,
  max_energy integer NOT NULL DEFAULT 100,
  telekinesis_level integer NOT NULL DEFAULT 0,
  boss_level integer NOT NULL DEFAULT 0,
  total_clicks bigint NOT NULL DEFAULT 0,
  character_name text,
  character_gender text,
  character_style text,
  lore text,
  avatar_url text,
  custom_settings jsonb DEFAULT '{}',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Player stats viewable by everyone" ON public.player_stats FOR SELECT USING (true);
CREATE POLICY "Player stats insertable by anyone" ON public.player_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Player stats updatable by anyone" ON public.player_stats FOR UPDATE USING (true);

-- Inventory (purchased items per player)
CREATE TABLE public.player_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL REFERENCES public.profiles(telegram_id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  purchased_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(telegram_id, item_id)
);
ALTER TABLE public.player_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inventory viewable by everyone" ON public.player_inventory FOR SELECT USING (true);
CREATE POLICY "Inventory insertable by anyone" ON public.player_inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Inventory deletable by anyone" ON public.player_inventory FOR DELETE USING (true);

-- Friends list
CREATE TABLE public.friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL REFERENCES public.profiles(telegram_id) ON DELETE CASCADE,
  friend_telegram_id bigint REFERENCES public.profiles(telegram_id) ON DELETE SET NULL,
  friend_name text NOT NULL,
  is_ai_enabled boolean NOT NULL DEFAULT false,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(telegram_id, friend_name)
);
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Friends viewable by everyone" ON public.friends FOR SELECT USING (true);
CREATE POLICY "Friends insertable by anyone" ON public.friends FOR INSERT WITH CHECK (true);
CREATE POLICY "Friends updatable by anyone" ON public.friends FOR UPDATE USING (true);
CREATE POLICY "Friends deletable by anyone" ON public.friends FOR DELETE USING (true);

-- Chat messages (between player and AI friends)
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL REFERENCES public.profiles(telegram_id) ON DELETE CASCADE,
  friend_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chat messages viewable by everyone" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Chat messages insertable by anyone" ON public.chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Chat messages deletable by anyone" ON public.chat_messages FOR DELETE USING (true);
CREATE INDEX idx_chat_messages_lookup ON public.chat_messages(telegram_id, friend_name, created_at DESC);

-- Events (global + assigned per player)
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  icon text DEFAULT '🎃',
  event_type text NOT NULL DEFAULT 'global',
  start_at timestamp with time zone,
  end_at timestamp with time zone,
  reward_fear integer DEFAULT 0,
  reward_watermelons integer DEFAULT 0,
  reward_energy integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events viewable by everyone" ON public.events FOR SELECT USING (true);
CREATE POLICY "Events insertable by anyone" ON public.events FOR INSERT WITH CHECK (true);
CREATE POLICY "Events updatable by anyone" ON public.events FOR UPDATE USING (true);
CREATE POLICY "Events deletable by anyone" ON public.events FOR DELETE USING (true);

-- Player event completions
CREATE TABLE public.player_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL REFERENCES public.profiles(telegram_id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed')),
  completed_at timestamp with time zone,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(telegram_id, event_id)
);
ALTER TABLE public.player_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Player events viewable by everyone" ON public.player_events FOR SELECT USING (true);
CREATE POLICY "Player events insertable by anyone" ON public.player_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Player events updatable by anyone" ON public.player_events FOR UPDATE USING (true);

-- Achievements definitions
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  icon text DEFAULT '🏆',
  condition_type text NOT NULL DEFAULT 'manual',
  condition_value integer DEFAULT 0,
  reward_fear integer DEFAULT 0,
  reward_watermelons integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Achievements viewable by everyone" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "Achievements insertable by anyone" ON public.achievements FOR INSERT WITH CHECK (true);
CREATE POLICY "Achievements updatable by anyone" ON public.achievements FOR UPDATE USING (true);

-- Player achievements (unlocked)
CREATE TABLE public.player_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL REFERENCES public.profiles(telegram_id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(telegram_id, achievement_id)
);
ALTER TABLE public.player_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Player achievements viewable by everyone" ON public.player_achievements FOR SELECT USING (true);
CREATE POLICY "Player achievements insertable by anyone" ON public.player_achievements FOR INSERT WITH CHECK (true);

-- Gallery (saved avatars / generated images per player)
CREATE TABLE public.gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL REFERENCES public.profiles(telegram_id) ON DELETE CASCADE,
  image_url text NOT NULL,
  label text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gallery viewable by everyone" ON public.gallery FOR SELECT USING (true);
CREATE POLICY "Gallery insertable by anyone" ON public.gallery FOR INSERT WITH CHECK (true);
CREATE POLICY "Gallery deletable by anyone" ON public.gallery FOR DELETE USING (true);

-- Leaderboard cache (fast reads)
CREATE TABLE public.leaderboard_cache (
  telegram_id bigint PRIMARY KEY REFERENCES public.profiles(telegram_id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  fear integer NOT NULL DEFAULT 0,
  telekinesis_level integer NOT NULL DEFAULT 0,
  rank integer,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.leaderboard_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaderboard viewable by everyone" ON public.leaderboard_cache FOR SELECT USING (true);
CREATE POLICY "Leaderboard insertable by anyone" ON public.leaderboard_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Leaderboard updatable by anyone" ON public.leaderboard_cache FOR UPDATE USING (true);

-- ============================================================
-- TRIGGERS for updated_at
-- ============================================================
CREATE TRIGGER trg_app_texts_updated_at BEFORE UPDATE ON public.app_texts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_audio_settings_updated_at BEFORE UPDATE ON public.audio_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_shop_items_updated_at BEFORE UPDATE ON public.shop_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_store_config_updated_at BEFORE UPDATE ON public.store_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_settings_updated_at BEFORE UPDATE ON public.ai_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_player_stats_updated_at BEFORE UPDATE ON public.player_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_leaderboard_updated_at BEFORE UPDATE ON public.leaderboard_cache FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
