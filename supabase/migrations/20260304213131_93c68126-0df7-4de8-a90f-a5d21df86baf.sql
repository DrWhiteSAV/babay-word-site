
-- Insert 3 daily events
INSERT INTO public.events (title, description, event_type, icon, reward_fear, reward_energy, reward_watermelons, is_active)
VALUES
  ('Утренний Испуг', 'Запугай 10 жильцов до конца дня и получи бонус страха', 'daily', '👻', 150, 20, 0, true),
  ('Сборщик Энергии', 'Выполни 5 действий в игре за день', 'daily', '⚡', 50, 100, 0, true),
  ('Охотник за Арбузами', 'Победи 3 босса за один день', 'daily', '🍉', 100, 30, 10, true),
  ('Великий Исход', 'Все Бабаи вместе должны собрать 1 000 000 единиц страха за месяц! Участвуй — получи эксклюзивный бонус.', 'global', '🌍', 500, 200, 50, true),
  ('Арбузный Апокалипсис', 'Глобальное задание: победить 10 000 боссов всеми игроками. При выполнении — каждый получит бонус!', 'global', '🍉', 300, 150, 100, true);

-- Insert 10 achievements
INSERT INTO public.achievements (key, title, description, icon, condition_type, condition_value, reward_fear, reward_watermelons, is_active)
VALUES
  ('first_scare', 'Первый Испуг', 'Запугай своего первого жителя', '👻', 'fear', 1, 50, 0, true),
  ('fear_100', 'Страшный Новичок', 'Накопи 100 единиц страха', '💀', 'fear', 100, 100, 0, true),
  ('fear_1000', 'Мастер Страха', 'Накопи 1000 единиц страха', '🔥', 'fear', 1000, 500, 5, true),
  ('first_watermelon', 'Арбузный Любитель', 'Получи первый арбуз', '🍉', 'watermelons', 1, 50, 0, true),
  ('watermelon_50', 'Арбузный Магнат', 'Собери 50 арбузов', '🏆', 'watermelons', 50, 200, 20, true),
  ('telekinesis_5', 'Телепат', 'Прокачай телекинез до 5-го уровня', '🧠', 'telekinesis', 5, 300, 10, true),
  ('telekinesis_10', 'Ментальный Гигант', 'Прокачай телекинез до 10-го уровня', '⚡', 'telekinesis', 10, 1000, 25, true),
  ('boss_5', 'Победитель Боссов', 'Победи 5 боссов', '⚔️', 'boss_level', 5, 250, 15, true),
  ('friends_3', 'Душа Компании', 'Добавь 3 друзей', '👥', 'friends', 3, 150, 5, true),
  ('referral_1', 'Вербовщик', 'Пригласи первого друга по реферальной ссылке', '🔗', 'referral', 1, 200, 10, true);
