import { useEffect, useRef, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";

const ONLINE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes = online
const DEBOUNCE_MS = 30_000; // update DB at most every 30s on activity

/**
 * Write current user's heartbeat to profiles.updated_at on activity.
 * Much cheaper than a fixed interval: only fires when the user is actually
 * doing something (click / touch / keydown).
 */
export function useOnlinePresence() {
  const { profile } = useTelegram();
  const lastBeatRef = useRef<number>(0);

  useEffect(() => {
    const tid = profile?.telegram_id;
    if (!tid) return;

    const beat = async () => {
      const now = Date.now();
      if (now - lastBeatRef.current < DEBOUNCE_MS) return;
      lastBeatRef.current = now;
      await supabase
        .from("profiles")
        .update({ updated_at: new Date().toISOString() })
        .eq("telegram_id", tid);
    };

    // Fire immediately on mount (user just opened the app)
    beat();

    // Then only on real user activity
    const events = ["click", "touchstart", "keydown", "scroll"] as const;
    events.forEach(ev => document.addEventListener(ev, beat, { passive: true }));
    return () => events.forEach(ev => document.removeEventListener(ev, beat));
  }, [profile?.telegram_id]);
}

/** Check if a list of friends are online based on their profiles.updated_at */
export function useFriendOnlineStatus(friendTelegramIds: number[]) {
  const [onlineMap, setOnlineMap] = useState<Record<number, boolean>>({});
  const idsKey = friendTelegramIds.join(",");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (friendTelegramIds.length === 0) return;

    const check = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("telegram_id, updated_at")
        .in("telegram_id", friendTelegramIds);

      if (!data) return;
      const now = Date.now();
      const map: Record<number, boolean> = {};
      for (const row of data) {
        const lastSeen = row.updated_at ? new Date(row.updated_at).getTime() : 0;
        map[row.telegram_id] = now - lastSeen < ONLINE_THRESHOLD_MS;
      }
      setOnlineMap(map);
    };

    check();
    // Poll every 60s – enough for a 3-min window
    intervalRef.current = setInterval(check, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return onlineMap;
}
