import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";

// Update online_at every 30 seconds while app is open
export function useOnlinePresence() {
  const { profile } = useTelegram();

  useEffect(() => {
    if (!profile?.telegram_id) return;

    const updateOnline = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("profiles").update({ online_at: new Date().toISOString() })
        .eq("telegram_id", profile.telegram_id).then(() => {});
    };

    updateOnline();
    const interval = setInterval(updateOnline, 30000);
    return () => clearInterval(interval);
  }, [profile?.telegram_id]);
}

// Check if a friend is online (seen in last 60 seconds)
export function useFriendOnlineStatus(friendTelegramIds: number[]) {
  const [onlineMap, setOnlineMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!friendTelegramIds.length) return;

    const check = async () => {
      const cutoff = new Date(Date.now() - 60000).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("profiles")
        .select("telegram_id, online_at")
        .in("telegram_id", friendTelegramIds);

      if (data) {
        const map: Record<number, boolean> = {};
        (data as any[]).forEach((p: any) => {
          map[p.telegram_id] = !!(p.online_at && p.online_at > cutoff);
        });
        setOnlineMap(map);
      }
    };

    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendTelegramIds.join(',')]);

  return onlineMap;
}
