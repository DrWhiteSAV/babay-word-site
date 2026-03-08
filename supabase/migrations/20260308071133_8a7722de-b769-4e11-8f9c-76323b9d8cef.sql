INSERT INTO public.profiles (telegram_id, first_name, last_name, username, role)
VALUES (169262991, 'Lovable', 'Dev', 'lovable_dev', 'Супер-Бабай')
ON CONFLICT (telegram_id) DO UPDATE SET role = 'Супер-Бабай', first_name = 'Lovable Dev';