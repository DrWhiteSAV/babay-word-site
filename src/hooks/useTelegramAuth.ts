import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export interface TelegramProfile {
  id: string;
  telegram_id: number;
  first_name: string;
  last_name: string | null;
  username: string | null;
  profile_url: string | null;
  photo_url: string | null;
  referral_code: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

/**
 * Reads Telegram WebApp initData, registers/updates the user in Supabase profiles table,
 * and returns the stored profile.
 */
export function useTelegramAuth() {
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [profile, setProfile] = useState<TelegramProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const tg = (window as any).Telegram?.WebApp;

      // Parse user from Telegram WebApp initData
      let user: TelegramUser | null = null;

      if (tg?.initDataUnsafe?.user) {
        user = tg.initDataUnsafe.user as TelegramUser;
        // Expand the WebApp to full height
        tg.expand();
      } else {
        // Dev fallback: try to parse from URL hash or search params
        try {
          const raw = tg?.initData || "";
          if (raw) {
            const params = new URLSearchParams(raw);
            const userStr = params.get("user");
            if (userStr) user = JSON.parse(decodeURIComponent(userStr));
          }
        } catch (_) {}
      }

      if (!user) {
        setIsLoading(false);
        return;
      }

      setTelegramUser(user);

      // Build profile_url
      const profileUrl = user.username
        ? `https://t.me/${user.username}`
        : `tg://user?id=${user.id}`;

      // Extract referral code from startapp param:
      // https://t.me/Bab_AIbot/app?startapp=babai  →  startapp=babai
      let referralCode: string | null = null;
      try {
        const startParam =
          tg?.initDataUnsafe?.start_param ||
          new URLSearchParams(window.location.search).get("startapp") ||
          new URLSearchParams(tg?.initData || "").get("start_param");
        if (startParam) referralCode = startParam;
      } catch (_) {}

      // Upsert into Supabase profiles (by telegram_id)
      const upsertData = {
        telegram_id: user.id,
        first_name: user.first_name,
        last_name: user.last_name ?? null,
        username: user.username ?? null,
        profile_url: profileUrl,
        photo_url: user.photo_url ?? null,
        ...(referralCode ? { referral_code: referralCode } : {}),
      };

      const { data, error } = await supabase
        .from("profiles")
        .upsert(upsertData, { onConflict: "telegram_id", ignoreDuplicates: false })
        .select()
        .single();

      if (error) {
        console.error("Telegram profile upsert error:", error);
      } else if (data) {
        setProfile(data as TelegramProfile);
      }

      setIsLoading(false);
    };

    init();
  }, []);

  return { telegramUser, profile, isLoading };
}
