import { useEffect, useRef } from "react";
import { usePlayerStore } from "../store/playerStore";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";

export function usePlayerStatsSync() {
  const store = usePlayerStore();
  const { profile } = useTelegram();
  const hasLoadedFromDB = useRef(false);

  // Load from Supabase on first mount — DB is the source of truth
  useEffect(() => {
    if (!profile?.telegram_id) return;
    if (hasLoadedFromDB.current) return;

    const loadStats = async () => {
      const { data } = await supabase
        .from("player_stats")
        .select("*")
        .eq("telegram_id", profile.telegram_id)
        .single();

      if (!data) return;
      hasLoadedFromDB.current = true;

      // DB is source of truth for all numeric stats — always overwrite local
      const updates: Record<string, any> = {};
      updates.fear = data.fear;
      updates.energy = data.energy;
      updates.watermelons = data.watermelons;
      updates.bossLevel = data.boss_level;

      // Restore character from DB
      if (data.character_name) {
        updates.character = {
          name: data.character_name,
          gender: (data.character_gender as any) || "Бабай",
          style: (data.character_style as any) || "Хоррор",
          wishes: (data.custom_settings as any)?.wishes || [],
          avatarUrl: data.avatar_url || "https://i.ibb.co/BVgY7XrT/babai.png",
          telekinesisLevel: data.telekinesis_level || 1,
          lore: data.lore || undefined,
        };
      }

      // Restore settings from DB — always use DB values when available
      if (data.custom_settings && typeof data.custom_settings === "object") {
        const cs = data.custom_settings as any;
        const settingsUpdate: Record<string, any> = {};
        if (cs.buttonSize !== undefined) settingsUpdate.buttonSize = cs.buttonSize;
        if (cs.fontFamily !== undefined) settingsUpdate.fontFamily = cs.fontFamily;
        if (cs.fontSize !== undefined) settingsUpdate.fontSize = cs.fontSize;
        if (cs.fontBrightness !== undefined) settingsUpdate.fontBrightness = cs.fontBrightness;
        if (cs.theme !== undefined) settingsUpdate.theme = cs.theme;
        if (cs.musicVolume !== undefined) settingsUpdate.musicVolume = cs.musicVolume;
        if (cs.ttsEnabled !== undefined) settingsUpdate.ttsEnabled = cs.ttsEnabled;
        
        if (Object.keys(settingsUpdate).length > 0) {
          updates.settings = { ...usePlayerStore.getState().settings, ...settingsUpdate };
        }

        // Restore inventory from DB
        if (cs.inventory && Array.isArray(cs.inventory)) {
          updates.inventory = cs.inventory;
        }
      }

      // Apply all DB values at once
      usePlayerStore.setState(updates);
    };

    loadStats();
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
