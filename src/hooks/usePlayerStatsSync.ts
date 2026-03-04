import { useEffect } from "react";
import { usePlayerStore } from "../store/playerStore";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";

/**
 * Loads player stats from Supabase on mount (to restore progress),
 * then syncs stats back to Supabase whenever they change.
 */
export function usePlayerStatsSync() {
  const store = usePlayerStore();
  const { profile } = useTelegram();

  // Load from Supabase on first mount
  useEffect(() => {
    if (!profile?.telegram_id) return;

    const loadStats = async () => {
      const { data } = await supabase
        .from("player_stats")
        .select("*")
        .eq("telegram_id", profile.telegram_id)
        .single();

      if (!data) return;

      const state = usePlayerStore.getState();

      // Restore numeric stats only if DB has higher values (avoid overwriting fresh session)
      if (data.fear > state.fear) store.addFear(data.fear - state.fear);
      if (data.energy > state.energy) store.addEnergy(data.energy - state.energy);
      if (data.watermelons > state.watermelons) store.addWatermelons(data.watermelons - state.watermelons);

      // Restore character if not set
      if (!state.character && data.character_name) {
        store.setCharacter({
          name: data.character_name,
          gender: (data.character_gender as any) || "Бабай",
          style: (data.character_style as any) || "Хоррор",
          wishes: (data.custom_settings as any)?.wishes || [],
          avatarUrl: data.avatar_url || "https://i.ibb.co/BVgY7XrT/babai.png",
          telekinesisLevel: data.telekinesis_level || 1,
          lore: data.lore || undefined,
        });
      } else if (state.character && data.lore && !state.character.lore) {
        store.updateCharacter({ lore: data.lore });
      }

      // Restore settings
      if (data.custom_settings && typeof data.custom_settings === "object") {
        const cs = data.custom_settings as any;
        if (cs.buttonSize || cs.fontFamily || cs.theme) {
          store.updateSettings({
            ...(cs.buttonSize && { buttonSize: cs.buttonSize }),
            ...(cs.fontFamily && { fontFamily: cs.fontFamily }),
            ...(cs.fontSize && { fontSize: cs.fontSize }),
            ...(cs.fontBrightness && { fontBrightness: cs.fontBrightness }),
            ...(cs.theme && { theme: cs.theme }),
            ...(cs.musicVolume !== undefined && { musicVolume: cs.musicVolume }),
            ...(cs.ttsEnabled !== undefined && { ttsEnabled: cs.ttsEnabled }),
          });
        }
      }
    };

    loadStats();
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.telegram_id]);

  // Sync to Supabase on state changes (debounced)
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

    const timer = setTimeout(async () => {
      const { error } = await supabase
        .from("player_stats")
        .upsert(syncData, { onConflict: "telegram_id" });
      if (error) console.error("player_stats sync error:", error.message);

      // Also update leaderboard_cache
      if (store.character) {
        await supabase.from("leaderboard_cache").upsert({
          telegram_id: profile.telegram_id,
          display_name: store.character.name,
          fear: store.fear,
          telekinesis_level: store.character.telekinesisLevel,
          avatar_url: store.character.avatarUrl,
        }, { onConflict: "telegram_id" });
      }
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
