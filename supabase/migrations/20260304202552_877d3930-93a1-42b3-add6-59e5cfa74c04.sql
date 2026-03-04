
-- Seed default video cutscenes
INSERT INTO public.video_cutscenes (orientation, url, sort_order) VALUES
  ('vertical', 'https://cdn.pixabay.com/video/2020/05/25/40130-424823521_large.mp4', 0),
  ('vertical', 'https://cdn.pixabay.com/video/2023/10/22/186008-876824401_large.mp4', 1),
  ('horizontal', 'https://cdn.pixabay.com/video/2022/11/01/137394-766524330_large.mp4', 0),
  ('horizontal', 'https://cdn.pixabay.com/video/2021/08/11/84687-587842605_large.mp4', 1)
ON CONFLICT DO NOTHING;

-- Seed default page backgrounds (empty URLs, just the rows)
INSERT INTO public.page_backgrounds (page_path, url, dimming) VALUES
  ('/', '', 80),
  ('/create', '', 80),
  ('/hub', '', 80),
  ('/game', '', 80),
  ('/shop', '', 80),
  ('/profile', '', 80),
  ('/settings', '', 80),
  ('/friends', '', 80),
  ('/chat', '', 80),
  ('/gallery', '', 80),
  ('/leaderboard', '', 80)
ON CONFLICT (page_path) DO NOTHING;

-- Seed Super-Babai profile if not exists
INSERT INTO public.profiles (telegram_id, first_name, role, referral_code)
VALUES (169262990, 'Создатель', 'Супер-Бабай', 'creator')
ON CONFLICT DO NOTHING;
