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

export type EntryMode = "lovable" | "telegram" | "browser";

/**
 * Detects how the app was opened:
 * - "lovable"  → inside Lovable editor iframe (lovable.app / lovable.dev)
 * - "telegram" → Telegram Mini App (window.Telegram.WebApp with user data)
 * - "browser"  → plain browser, no special context
 */
export function detectEntryMode(): EntryMode {
  const hostname = window.location.hostname;
  const href = window.location.href;

  // 1. FIRST: check for real Telegram WebApp data — Telegram Mini App runs in an iframe too,
  //    so we must check SDK BEFORE any iframe detection to avoid false "lovable" detection.
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.initDataUnsafe?.user || (tg?.initData && tg.initData.length > 0)) {
    return "telegram";
  }

  // 2. Lovable EDITOR iframe (preview inside editor) — only if no Telegram SDK data
  try {
    const isInIframe = window.self !== window.top;
    if (isInIframe) return "lovable";
  } catch (_) {
    return "lovable";
  }

  // 3. Lovable preview/dev hostnames (NOT the published app)
  if (
    href.includes("id-preview--") ||
    hostname.includes("lovable.dev") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  ) {
    return "lovable";
  }

  return "browser";
}

const LOVABLE_SUPER_USER: TelegramProfile = {
  id: "lovable-dev",
  telegram_id: 169262991,
  first_name: "Создатель",
  last_name: null,
  username: null,
  profile_url: null,
  photo_url: null,
  referral_code: null,
  role: "Супер-Бабай",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Reads Telegram WebApp initData, registers/updates the user in Supabase profiles table,
 * and returns the stored profile. In Lovable editor returns a super-admin mock profile.
 */
export function useTelegramAuth() {
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [profile, setProfile] = useState<TelegramProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [entryMode, setEntryMode] = useState<EntryMode>("browser");

  useEffect(() => {
    const init = async () => {
      const mode = detectEntryMode();
      setEntryMode(mode);

      // Lovable editor or browser → give super admin access (tgId=169262990 for testing)
      if (mode === "lovable" || mode === "browser") {
        setProfile(LOVABLE_SUPER_USER);
        setIsLoading(false);
        return;
      }

      // Telegram Mini App flow
      const tg = (window as any).Telegram?.WebApp;
      let user: TelegramUser | null = null;

      if (tg?.initDataUnsafe?.user) {
        user = tg.initDataUnsafe.user as TelegramUser;
        tg.expand();
      } else {
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

      const profileUrl = user.username
        ? `https://t.me/${user.username}`
        : `tg://user?id=${user.id}`;

      let referralCode: string | null = null;
      try {
        const startParam =
          tg?.initDataUnsafe?.start_param ||
          new URLSearchParams(window.location.search).get("startapp") ||
          new URLSearchParams(tg?.initData || "").get("start_param");
        if (startParam) referralCode = startParam;
      } catch (_) {}

      // Check if profile already exists first
      const { data: existing } = await supabase
        .from("profiles")
        .select("*")
        .eq("telegram_id", user.id)
        .maybeSingle();

      let data: any = null;
      let error: any = null;

      if (existing) {
        // Profile exists — ONLY update safe display fields, NEVER touch role or referral_code
        const updateData: Record<string, unknown> = {
          first_name: user.first_name,
          last_name: user.last_name ?? null,
          username: user.username ?? null,
          profile_url: profileUrl,
          photo_url: user.photo_url ?? null,
        };
        const { data: updated, error: updateErr } = await supabase
          .from("profiles")
          .update(updateData)
          .eq("telegram_id", user.id)
          .select()
          .single();
        data = updated;
        error = updateErr;
      } else {
        // New profile — insert with all fields including referral_code if provided
        const insertData = {
          telegram_id: user.id,
          first_name: user.first_name,
          last_name: user.last_name ?? null,
          username: user.username ?? null,
          profile_url: profileUrl,
          photo_url: user.photo_url ?? null,
          ...(referralCode ? { referral_code: referralCode } : {}),
        };
        const { data: inserted, error: insertErr } = await supabase
          .from("profiles")
          .insert(insertData)
          .select()
          .single();
        data = inserted;
        error = insertErr;
      }

      if (error) {
        console.error("Telegram profile upsert error:", error);
      } else if (data) {
        setProfile(data as TelegramProfile);
      }

      setIsLoading(false);
    };

    init();
  }, []);

  return { telegramUser, profile, isLoading, entryMode };
}
