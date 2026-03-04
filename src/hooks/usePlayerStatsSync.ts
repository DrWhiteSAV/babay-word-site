import { useEffect } from "react";
import { usePlayerStore } from "../store/playerStore";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";

/**
 * Syncs player stats and settings to Supabase player_stats table.
 * Call this hook at the top level of any page that modifies player data.
 */
export function usePlayerStatsSync() {
  const store = usePlayerStore();
  const { profile } = useTelegram();

  useEffect(() => {
    if (!profile?.telegram_id || !store.character) return;

    const syncData = {
      telegram_id: profile.telegram_id,
      fear: store.fear,
      energy: store.energy,
      watermelons: store.watermelons,
      boss_level: store.bossLevel,
      telekinesis_level: store.character.telekinesisLevel,
      character_name: store.character.name,
      character_gender: store.character.gender,
      character_style: store.character.style,
      avatar_url: store.character.avatarUrl,
      lore: store.character.lore || null,
      custom_settings: {
        buttonSize: store.settings.buttonSize,
        fontFamily: store.settings.fontFamily,
        fontSize: store.settings.fontSize,
        fontBrightness: store.settings.fontBrightness,
        theme: store.settings.theme,
        musicVolume: store.settings.musicVolume,
        ttsEnabled: store.settings.ttsEnabled,
        wishes: store.character.wishes,
        inventory: store.inventory,
      },
    };

    // Debounce: sync after 3 seconds of no changes
    const timer = setTimeout(() => {
      supabase
        .from("player_stats")
        .upsert(syncData, { onConflict: "telegram_id" })
        .then(({ error }) => {
          if (error) console.error("player_stats sync error:", error.message);
        });
    }, 3000);

    return () => clearTimeout(timer);
  }, [
    profile?.telegram_id,
    store.fear,
    store.energy,
    store.watermelons,
    store.bossLevel,
    store.character?.telekinesisLevel,
    store.character?.name,
    store.character?.gender,
    store.character?.style,
    store.character?.avatarUrl,
    store.character?.lore,
    store.settings,
    store.inventory,
  ]);
}
