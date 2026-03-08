import { supabase } from "../integrations/supabase/client";

// Use hardcoded values matching the supabase client (anon key is publishable/safe)
const SUPABASE_URL = "https://psuvnvqvspqibsezcrny.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzdXZudnF2c3BxaWJzZXpjcm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDI5NTIsImV4cCI6MjA4NzU3ODk1Mn0.VHI6Kefzbz6Hc8TpLI5_JRXAyPJ-y4oeE3Bkh16jFRU";

/**
 * Sends a Telegram notification to `targetTelegramId` informing them
 * that `adderTelegramId` added them as a friend.
 */
export async function notifyFriendAdded(
  adderTelegramId: number,
  targetTelegramId: number
) {
  try {
    console.log("[notifyFriendAdded] 📨 Sending friend notification", { adderTelegramId, targetTelegramId });

    // Load adder's profile + stats
    const [profRes, statsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, last_name, username")
        .eq("telegram_id", adderTelegramId)
        .single(),
      supabase
        .from("player_stats")
        .select("character_name, avatar_url, lore, telekinesis_level, fear")
        .eq("telegram_id", adderTelegramId)
        .single(),
    ]);

    const prof = profRes.data;
    const stats = statsRes.data;

    const fullName = [prof?.first_name, prof?.last_name].filter(Boolean).join(" ") || "Бабай";
    const babayName = stats?.character_name || fullName;
    const lore = stats?.lore || "История этого Бабая покрыта мраком...";
    const avatarUrl = stats?.avatar_url || null;
    const tk = stats?.telekinesis_level ?? 1;
    const fear = stats?.fear ?? 0;

    // Build Telegram link — use plain Markdown (not V2) to avoid escaping issues
    const tgLink = prof?.username
      ? `[${fullName} @${prof.username}](https://t.me/${prof.username})`
      : fullName;

    // Plain Markdown (parse_mode: 'Markdown') — no escaping needed
    const caption =
      `👻 *Тебя добавили в друзья!*\n\n` +
      `${tgLink} добавил тебя как контакт в игре Бабай.\n\n` +
      `🧿 *Бабай:* ${babayName}\n` +
      `⚡ Телекинез: ${tk} ур. · 😱 Страх: ${fear}\n\n` +
      `📖 *Лор:* _${lore}_`;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-telegram-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        telegram_id: targetTelegramId,
        photo_url: avatarUrl,
        caption,
      }),
    });

    const json = await res.json();
    console.log("[notifyFriendAdded] ✅ Response:", json);
  } catch (e) {
    console.error("[notifyFriendAdded] ❌ Error:", e);
  }
}
