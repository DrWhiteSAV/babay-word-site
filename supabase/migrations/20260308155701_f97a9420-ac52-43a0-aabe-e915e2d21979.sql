
-- Group chats table
CREATE TABLE public.group_chats (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_by bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group chats viewable by everyone" ON public.group_chats FOR SELECT USING (true);
CREATE POLICY "Group chats insertable by anyone" ON public.group_chats FOR INSERT WITH CHECK (true);
CREATE POLICY "Group chats updatable by anyone" ON public.group_chats FOR UPDATE USING (true);
CREATE POLICY "Group chats deletable by anyone" ON public.group_chats FOR DELETE USING (true);

-- Group chat members table
CREATE TABLE public.group_chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id text NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  telegram_id bigint NOT NULL,
  character_name text NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (group_id, telegram_id)
);

ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members viewable by everyone" ON public.group_chat_members FOR SELECT USING (true);
CREATE POLICY "Group members insertable by anyone" ON public.group_chat_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Group members updatable by anyone" ON public.group_chat_members FOR UPDATE USING (true);
CREATE POLICY "Group members deletable by anyone" ON public.group_chat_members FOR DELETE USING (true);
