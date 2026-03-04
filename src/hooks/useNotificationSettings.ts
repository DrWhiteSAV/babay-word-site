import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";

export interface NotificationSettings {
  notify_friend_added: boolean;
  notify_event_complete: boolean;
  notify_achievement: boolean;
  notify_chat_offline: boolean;
  popup_events: boolean;
  popup_achievements: boolean;
  popup_chat: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  notify_friend_added: true,
  notify_event_complete: true,
  notify_achievement: true,
  notify_chat_offline: true,
  popup_events: true,
  popup_achievements: true,
  popup_chat: true,
};

export function useNotificationSettings() {
  const { profile } = useTelegram();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.telegram_id) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("notification_settings")
      .select("*")
      .eq("telegram_id", profile.telegram_id)
      .single()
      .then(({ data }: { data: any }) => {
        if (data) {
          setSettings({
            notify_friend_added: data.notify_friend_added,
            notify_event_complete: data.notify_event_complete,
            notify_achievement: data.notify_achievement,
            notify_chat_offline: data.notify_chat_offline,
            popup_events: data.popup_events,
            popup_achievements: data.popup_achievements,
            popup_chat: data.popup_chat,
          });
        }
        setLoading(false);
      });
  }, [profile?.telegram_id]);

  const update = async (updates: Partial<NotificationSettings>) => {
    if (!profile?.telegram_id) return;
    const next = { ...settings, ...updates };
    setSettings(next);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("notification_settings").upsert({
      telegram_id: profile.telegram_id,
      ...next,
    }, { onConflict: "telegram_id" });
  };

  return { settings, update, loading };
}
