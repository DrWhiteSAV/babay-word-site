import { useEffect, useRef, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";
import { usePlayerStore } from "../store/playerStore";
import { pushNotification } from "../components/NotificationPopup";
import { useLocation } from "react-router-dom";

const SUPABASE_URL = "https://psuvnvqvspqibsezcrny.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzdXZudnF2c3BxaWJzZXpjcm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDI5NTIsImV4cCI6MjA4NzU3ODk1Mn0.VHI6Kefzbz6Hc8TpLI5_JRXAyPJ-y4oeE3Bkh16jFRU";
const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

/**
 * Listens for incoming chat messages addressed to the current user
 * across ALL their chat keys (personal + group).
 * - If user is on the same chat page: shows in-app popup.
 * - If user is offline (last activity > 3min): sends Telegram notification.
 */
export function useIncomingMessageNotifier() {
  const { profile } = useTelegram();
  const { friends, groupChats, character } = usePlayerStore();
  const location = useLocation();
  const lastActivityRef = useRef<number>(Date.now());

  // Track last user activity to determine online status
  useEffect(() => {
    const update = () => { lastActivityRef.current = Date.now(); };
    const events = ["click", "touchstart", "keydown"] as const;
    events.forEach(ev => document.addEventListener(ev, update, { passive: true }));
    return () => events.forEach(ev => document.removeEventListener(ev, update));
  }, []);

  // Build canonical chat keys from both telegram_ids (sorted numerically)
  // We fetch friend telegram_ids from player_stats to build correct keys
  const [friendTidMap, setFriendTidMap] = useState<Record<string, number>>({});
  useEffect(() => {
    const realFriends = friends.filter(f => f.name !== "ДанИИл");
    if (realFriends.length === 0) return;
    supabase
      .from("player_stats")
      .select("telegram_id, character_name")
      .in("character_name", realFriends.map(f => f.name))
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, number> = {};
        for (const row of data) {
          if (row.character_name && row.telegram_id) map[row.character_name] = row.telegram_id;
        }
        setFriendTidMap(map);
      });
  }, [friends.length]);

  useEffect(() => {
    if (!profile?.telegram_id) return;
    const myTid = profile.telegram_id;

    // Build DM keys: [myTid, friendTid].sort() — canonical, same for both users
    const personalKeys = friends
      .filter(f => f.name !== "ДанИИл" && friendTidMap[f.name])
      .map(f => [String(myTid), String(friendTidMap[f.name])].sort().join("_"));

    const groupKeys = groupChats.map(g => `group_${g.id}`);
    const allKeys = [...personalKeys, ...groupKeys];
    if (allKeys.length === 0) return;

    const channel = supabase
      .channel(`global_messages_${myTid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          const m = payload.new as any;
          // Only care about messages in my chats that aren't from me
          if (!allKeys.includes(m.chat_key)) return;
          if (m.sender_telegram_id === myTid) return;

          const content: string = m.content || "";
          const isImg = content.startsWith("[img]:");
          const previewText = isImg ? "📷 Фото" : content.slice(0, 80);
          const senderName: string = m.friend_name || "Кто-то";

          const isOnline = Date.now() - lastActivityRef.current < ONLINE_THRESHOLD_MS;
          const isOnChatPage = location.pathname === "/chat";

          if (!isOnline) {
            // Send Telegram notification
            try {
              await fetch(`${SUPABASE_URL}/functions/v1/send-telegram-notification`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": SUPABASE_ANON_KEY,
                  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                  telegram_id: myTid,
                  caption: `💬 *${senderName}* написал тебе:\n\n${previewText}`,
                }),
              });
            } catch {}
          } else if (!isOnChatPage) {
            // Show in-app popup if user is online but not in chat
            pushNotification({
              type: "chat",
              title: `💬 ${senderName}`,
              message: previewText,
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.telegram_id, friends.length, groupChats.length, location.pathname]);
}
