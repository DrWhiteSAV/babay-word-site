import { useEffect, useRef } from "react";
import { usePlayerStore, ButtonSize, FontFamily, Theme } from "../store/playerStore";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";

const FALLBACK_AVATAR = "https://i.ibb.co/BVgY7XrT/babai.png";

const DEFAULT_SETTINGS = {
  buttonSize: "small" as ButtonSize,
  fontFamily: "Russo One" as FontFamily,
  fontSize: 12,
  fontBrightness: 100,
  theme: "normal" as Theme,
  musicVolume: 50,
  ttsEnabled: false,
};

const BUTTON_SIZES: ButtonSize[] = ["small", "medium", "large"];
const FONT_FAMILIES: FontFamily[] = [
  "Inter", "Roboto", "Montserrat", "Playfair Display", "JetBrains Mono",
  "Press Start 2P", "Russo One", "Rubik Beastly", "Rubik Burned", "Rubik Glitch",
  "Neucha", "Ruslan Display", "Tektur", "Special Elite", "Cinzel Decorative", "Nunito",
  "Marck Script", "Cuprum", "Lobster", "Pacifico", "Comfortaa",
];
const THEMES: Theme[] = ["normal", "cyberpunk", "horror", "steampunk", "anime", "soviet", "fairytale", "cartoon", "fantasy"];

const isHttpUrl = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value.trim());

const isRealAvatar = (url: unknown): url is string =>
  isHttpUrl(url) && url !== FALLBACK_AVATAR;

const normalizeSettings = (raw: unknown) => {
  const cs = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    buttonSize: BUTTON_SIZES.includes(cs.buttonSize as ButtonSize) ? (cs.buttonSize as ButtonSize) : DEFAULT_SETTINGS.buttonSize,
    fontFamily: FONT_FAMILIES.includes(cs.fontFamily as FontFamily) ? (cs.fontFamily as FontFamily) : DEFAULT_SETTINGS.fontFamily,
    fontSize: typeof cs.fontSize === "number" && cs.fontSize >= 5 && cs.fontSize <= 24 ? cs.fontSize : DEFAULT_SETTINGS.fontSize,
    fontBrightness: typeof cs.fontBrightness === "number" ? cs.fontBrightness : DEFAULT_SETTINGS.fontBrightness,
    theme: THEMES.includes(cs.theme as Theme) ? (cs.theme as Theme) : DEFAULT_SETTINGS.theme,
    musicVolume: typeof cs.musicVolume === "number" ? cs.musicVolume : DEFAULT_SETTINGS.musicVolume,
    ttsEnabled: typeof cs.ttsEnabled === "boolean" ? cs.ttsEnabled : DEFAULT_SETTINGS.ttsEnabled,
  };
};

export { DEFAULT_SETTINGS, FALLBACK_AVATAR };

export function usePlayerStatsSync() {
  const { profile, isLoading: tgLoading } = useTelegram();

  // ─── FALLBACK: browser mode without telegram_id ──────────────────────────────
  useEffect(() => {
    if (tgLoading) return;
    if (profile?.telegram_id) return;
    usePlayerStore.setState({ dbLoaded: true, gameStatus: "playing" });
  }, [tgLoading, profile?.telegram_id]);

  // ─── LOAD FROM DB ────────────────────────────────────────────────────────────
  useEffect(() => {
    const telegramId = profile?.telegram_id;
    if (!telegramId) return;

    usePlayerStore.setState({ dbLoaded: false, gameStatus: "loading" });

    let cancelled = false;

    const load = async () => {
      try {
        const [statsResult, galleryResult, friendsResult, inventoryResult] = await Promise.all([
          supabase.from("player_stats").select("*").eq("telegram_id", telegramId).maybeSingle(),
          supabase.from("gallery").select("image_url, label, created_at")
            .eq("telegram_id", telegramId).order("created_at", { ascending: false }).limit(50),
          supabase.from("friends").select("friend_name, is_ai_enabled")
            .eq("telegram_id", telegramId),
          supabase.from("player_inventory").select("item_id")
            .eq("telegram_id", telegramId),
        ]);

        if (cancelled) return;

        const { data, error } = statsResult;

        if (error) {
          console.error("[sync] load error:", error.message);
          usePlayerStore.setState({ dbLoaded: true, gameStatus: "playing" });
          return;
        }

        // Gallery — build list and find latest real avatar
        let latestAvatarFromGallery: string | null = null;
        if (galleryResult.data && galleryResult.data.length > 0) {
          const urls = galleryResult.data.map(r => r.image_url).filter(isHttpUrl);
          if (urls.length > 0) {
            usePlayerStore.setState({ gallery: Array.from(new Set(urls)) });
          }
          // Find most recent avatar entry in gallery (newest first)
          const avatarRow = galleryResult.data.find(r => {
            const lbl = (r.label || "").toLowerCase();
            return lbl.includes("[avatars]") || lbl.includes("[avatar]") || lbl.includes("аватар");
          });
          if (avatarRow?.image_url && isRealAvatar(avatarRow.image_url)) {
            latestAvatarFromGallery = avatarRow.image_url;
          }
        }

        const friendsList = (friendsResult.data || []).map(f => ({
          name: f.friend_name,
          isAiEnabled: f.is_ai_enabled ?? false,
        }));

        // Load inventory from player_inventory table (source of truth, not custom_settings)
        const inventoryFromDB = (inventoryResult.data || []).map(i => i.item_id);

        if (!data) {
          usePlayerStore.setState({
            character: null,
            fear: 0, energy: 100, watermelons: 0, bossLevel: 1,
            inventory: inventoryFromDB,
            friends: friendsList,
            settings: { ...DEFAULT_SETTINGS },
            gameStatus: "new",
            dbLoaded: true,
          });
          return;
        }

        const gameStatus = data.game_status || "playing";

        if (gameStatus === "reset") {
          usePlayerStore.setState({
            character: null,
            fear: 0, energy: 100, watermelons: 0, bossLevel: 1,
            inventory: inventoryFromDB,
            friends: friendsList,
            settings: { ...DEFAULT_SETTINGS },
            gameStatus: "reset",
            dbLoaded: true,
          });
          return;
        }

        const cs = data.custom_settings && typeof data.custom_settings === "object"
          ? (data.custom_settings as Record<string, unknown>)
          : {};

        const settings = normalizeSettings(cs);

        let character = null;
        if (data.character_name) {
          const wishes = Array.isArray(cs.wishes)
            ? (cs.wishes as unknown[]).filter((x): x is string => typeof x === "string")
            : [];

          // Avatar priority:
          // 1. Real URL stored in player_stats.avatar_url  ← ONLY source, no DB writes on load
          // 2. Latest avatar from gallery (display only, NO write to DB)
          // 3. Fallback
          let avatarUrl = FALLBACK_AVATAR;
          if (isRealAvatar(data.avatar_url)) {
            avatarUrl = data.avatar_url;
          } else if (latestAvatarFromGallery) {
            // ⚠️ DISPLAY ONLY — do NOT write back to player_stats on app load
            avatarUrl = latestAvatarFromGallery;
            console.log("[sync] 📷 using gallery avatar for display (no DB write on load)");
          }

          character = {
            name: data.character_name,
            gender: (data.character_gender as any) || "Бабай",
            style: (data.character_style as any) || "Хоррор",
            wishes,
            avatarUrl,
            telekinesisLevel: typeof data.telekinesis_level === "number" ? data.telekinesis_level : 1,
            lore: data.lore || undefined,
          };
        }

        console.log("[sync] ✅ loaded from DB:", {
          name: character?.name,
          avatar: character?.avatarUrl?.substring(0, 60),
          fontSize: settings.fontSize,
          fontFamily: settings.fontFamily,
          buttonSize: settings.buttonSize,
          gameStatus,
          inventoryCount: inventoryFromDB.length,
        });

        usePlayerStore.setState({
          character,
          fear: typeof data.fear === "number" ? data.fear : 0,
          energy: typeof data.energy === "number" ? data.energy : 100,
          watermelons: typeof data.watermelons === "number" ? data.watermelons : 0,
          bossLevel: typeof data.boss_level === "number" ? Math.max(1, data.boss_level) : 1,
          settings,
          inventory: inventoryFromDB,
          friends: friendsList,
          gameStatus,
          dbLoaded: true,
        });

      } catch (err) {
        console.error("[sync] unexpected error:", err);
        if (!cancelled) {
          usePlayerStore.setState({ dbLoaded: true, gameStatus: "playing" });
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [profile?.telegram_id]);

  const store = usePlayerStore();

  // ─── AUTO-SYNC settings TO DB (debounced 800ms, fires from anywhere in the app) ──
  const settingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsLoadedRef = useRef(false);

  useEffect(() => {
    settingsLoadedRef.current = false;
  }, [profile?.telegram_id]);

  useEffect(() => {
    const telegramId = profile?.telegram_id;
    if (!telegramId) return;
    if (!store.dbLoaded) return;

    // Skip the very first render after DB load to avoid overwriting with stale defaults
    if (!settingsLoadedRef.current) {
      settingsLoadedRef.current = true;
      return;
    }

    if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current);
    settingsTimerRef.current = setTimeout(async () => {
      try {
        const { data: existing } = await supabase
          .from("player_stats")
          .select("custom_settings")
          .eq("telegram_id", telegramId)
          .single();
        const existingCs = (existing?.custom_settings as Record<string, unknown>) || {};
        const s = store.settings;
        const newCs = {
          ...existingCs,
          buttonSize: s.buttonSize,
          fontFamily: s.fontFamily,
          fontSize: s.fontSize,
          fontBrightness: s.fontBrightness,
          theme: s.theme,
          musicVolume: s.musicVolume,
          ttsEnabled: s.ttsEnabled,
        };
        await supabase
          .from("player_stats")
          .update({ custom_settings: newCs })
          .eq("telegram_id", telegramId);
        console.log("[sync] ✅ settings auto-saved to DB");
      } catch (e) {
        console.error("[sync] ❌ settings save error:", e);
      }
    }, 800);

    return () => {
      if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current);
    };
  }, [
    profile?.telegram_id,
    store.dbLoaded,
    store.settings.buttonSize,
    store.settings.fontFamily,
    store.settings.fontSize,
    store.settings.fontBrightness,
    store.settings.theme,
    store.settings.musicVolume,
    store.settings.ttsEnabled,
  ]);

  // ─── AUTO-SYNC TO DB ─────────────────────────────────────────────────────────
  // CRITICAL: This effect ONLY writes gameplay stats (fear, watermelons, boss_level, telekinesis_level, energy).
  const lastWrittenRef = useRef<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    lastWrittenRef.current = null;
    loadedRef.current = false;
  }, [profile?.telegram_id]);

  // Helper: write gameplay stats to DB immediately (no delay)
  interface GameplayPayload {
    fear: number;
    energy: number;
    watermelons: number;
    boss_level: number;
    telekinesis_level: number;
  }
  const writeGameplayToDB = useRef<(telegramId: number, payload: GameplayPayload) => Promise<void>>(async () => {});
  writeGameplayToDB.current = async (telegramId: number, payload: GameplayPayload) => {
    console.log(`[DB WRITE] ⚡ player_stats IMMEDIATE UPDATE for telegram_id=${telegramId}`, {
      fear: payload.fear,
      energy: payload.energy,
      watermelons: payload.watermelons,
      boss_level: payload.boss_level,
      telekinesis_level: payload.telekinesis_level,
    });
    const { error } = await supabase
      .from("player_stats")
      .update({
        fear: payload.fear,
        energy: payload.energy,
        watermelons: payload.watermelons,
        boss_level: payload.boss_level,
        telekinesis_level: payload.telekinesis_level,
      })
      .eq("telegram_id", telegramId);

    if (error) {
      console.error("[DB WRITE] ❌ player_stats UPDATE error:", error.message);
    } else {
      console.log("[DB WRITE] ✅ player_stats UPDATE success");
    }

    // Leaderboard cache update
    const storeNow = usePlayerStore.getState();
    const avatarForLeader = isRealAvatar(storeNow.character?.avatarUrl)
      ? storeNow.character!.avatarUrl
      : FALLBACK_AVATAR;

    await supabase.from("leaderboard_cache").upsert({
      telegram_id: telegramId,
      display_name: storeNow.character?.name || "Безымянный",
      fear: storeNow.fear,
      telekinesis_level: storeNow.character?.telekinesisLevel ?? 1,
      avatar_url: avatarForLeader,
    }, { onConflict: "telegram_id" });
  };

  useEffect(() => {
    const telegramId = profile?.telegram_id;
    if (!telegramId) return;
    if (!store.dbLoaded) return;
    if (!store.character) return;
    if (store.gameStatus !== "playing") return;

    const snapshot = buildGameplaySnapshot(store);

    if (!loadedRef.current) {
      loadedRef.current = true;
      lastWrittenRef.current = snapshot;
      console.log("[sync] 📌 baseline saved (gameplay only), no write on load");
      return;
    }

    if (lastWrittenRef.current === snapshot) return;

    const prev = lastWrittenRef.current;
    lastWrittenRef.current = snapshot;

    if (prev !== null) {
      try {
        const p = JSON.parse(prev) as Record<string, unknown>;
        const c = JSON.parse(snapshot) as Record<string, unknown>;
        const changed = Object.keys(c).filter(k => JSON.stringify(p[k]) !== JSON.stringify(c[k]));
        console.log("[sync] 📝 gameplay fields changed:", changed);
      } catch { /**/ }
    }

    const payload = JSON.parse(snapshot) as GameplayPayload;

    // ⚡ IMMEDIATE write when energy is spent (decreased) or hits 0 — no delay
    const prevEnergy = prev ? (JSON.parse(prev) as GameplayPayload).energy : null;
    const energyDecreased = prevEnergy !== null && payload.energy < prevEnergy;
    const energyZero = payload.energy === 0;

    if (energyDecreased || energyZero) {
      console.log("[sync] ⚡ energy changed (immediate write):", prevEnergy, "→", payload.energy);
      writeGameplayToDB.current!(telegramId, payload);
      return; // no delayed write needed — already written
    }

    // For all other changes (fear, watermelons, boss_level, telekinesis) — debounce 2s
    const timer = setTimeout(() => {
      writeGameplayToDB.current!(telegramId, payload);
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    profile?.telegram_id,
    store.dbLoaded,
    store.gameStatus,
    store.fear,
    store.energy,
    store.watermelons,
    store.bossLevel,
    store.character?.telekinesisLevel,
  ]);
}

/**
 * Snapshot of ONLY gameplay stats.
 * Does NOT include custom_settings (saved via Settings button only).
 * Does NOT include character identity fields (saved via CharacterCreate/Gallery only).
 */
function buildGameplaySnapshot(store: ReturnType<typeof usePlayerStore.getState>): string {
  return JSON.stringify({
    fear: store.fear,
    energy: store.energy,
    watermelons: store.watermelons,
    boss_level: store.bossLevel,
    telekinesis_level: store.character?.telekinesisLevel ?? 1,
  });
}
