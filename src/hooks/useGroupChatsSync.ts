/**
 * useGroupChatsSync
 *
 * Loads all group chats the current user is a member of from Supabase,
 * syncs them into the Zustand store, and subscribes to real-time inserts
 * so new group memberships appear instantly without a page reload.
 *
 * Also sends in-app (or Telegram) notifications when the user is added
 * to a new group chat.
 */
import { useEffect, useRef } from "react";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";
import { usePlayerStore } from "../store/playerStore";
import { pushNotification } from "../components/NotificationPopup";

const SUPABASE_URL = "https://psuvnvqvspqibsezcrny.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzdXZudnF2c3BxaWJzZXpjcm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDI5NTIsImV4cCI6MjA4NzU3ODk1Mn0.VHI6Kefzbz6Hc8TpLI5_JRXAyPJ-y4oeE3Bkh16jFRU";
const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

async function loadGroupChats(telegramId: number) {
  // 1. Find all group_ids this user belongs to
  const { data: memberRows } = await supabase
    .from("group_chat_members")
    .select("group_id")
    .eq("telegram_id", telegramId);

  if (!memberRows || memberRows.length === 0) return [];

  const groupIds = memberRows.map(r => r.group_id);

  // 2. Fetch group metadata
  const { data: groups } = await supabase
    .from("group_chats")
    .select("id, name")
    .in("id", groupIds);

  if (!groups || groups.length === 0) return [];

  // 3. Fetch all members for those groups
  const { data: allMembers } = await supabase
    .from("group_chat_members")
    .select("group_id, character_name")
    .in("group_id", groupIds);

  const membersByGroup: Record<string, string[]> = {};
  for (const m of allMembers || []) {
    if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
    membersByGroup[m.group_id].push(m.character_name);
  }

  return groups.map(g => ({
    id: g.id,
    name: g.name,
    members: membersByGroup[g.id] || [],
  }));
}

export function useGroupChatsSync() {
  const { profile } = useTelegram();
  const lastActivityRef = useRef<number>(Date.now());

  // Track last user activity for online check
  useEffect(() => {
    const update = () => { lastActivityRef.current = Date.now(); };
    const events = ["click", "touchstart", "keydown"] as const;
    events.forEach(ev => document.addEventListener(ev, update, { passive: true }));
    return () => events.forEach(ev => document.removeEventListener(ev, update));
  }, []);

  useEffect(() => {
    const telegramId = profile?.telegram_id;
    if (!telegramId) return;

    // Initial load
    loadGroupChats(telegramId).then(groups => {
      if (groups.length > 0) {
        usePlayerStore.setState({ groupChats: groups });
      }
    });

    // Real-time: when this user is added to a new group membership row
    const channel = supabase
      .channel(`group_membership_${telegramId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_chat_members",
          filter: `telegram_id=eq.${telegramId}`,
        },
        async (payload) => {
          // Re-load all groups so store stays consistent
          const groups = await loadGroupChats(telegramId);
          usePlayerStore.setState({ groupChats: groups });

          // Notify user about being added
          const groupId = (payload.new as any).group_id;
          const { data: groupData } = await supabase
            .from("group_chats")
            .select("name")
            .eq("id", groupId)
            .single();

          const groupName = groupData?.name || "Группа";
          const isOnline = Date.now() - lastActivityRef.current < ONLINE_THRESHOLD_MS;

          if (isOnline) {
            pushNotification({
              type: "chat",
              title: `👥 Добавлен в группу`,
              message: `Тебя добавили в «${groupName}»`,
            });
          } else {
            // Offline → Telegram notification
            try {
              await fetch(`${SUPABASE_URL}/functions/v1/send-telegram-notification`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": SUPABASE_ANON_KEY,
                  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                  telegram_id: telegramId,
                  caption: `👥 Тебя добавили в групповой чат *«${groupName}»*`,
                }),
              });
            } catch {}
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.telegram_id]);
}
