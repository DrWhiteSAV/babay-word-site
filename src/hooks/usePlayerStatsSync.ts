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
  "Neucha", "Ruslan Display", "Tektur",
];
const THEMES: Theme[] = ["normal", "cyberpunk"];

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
        const [statsResult, galleryResult, friendsResult] = await Promise.all([
          supabase.from("player_stats").select("*").eq("telegram_id", telegramId).maybeSingle(),
          supabase.from("gallery").select("image_url, label, created_at")
            .eq("telegram_id", telegramId).order("created_at", { ascending: false }).limit(50),
          supabase.from("friends").select("friend_name, is_ai_enabled")
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

        if (!data) {
          usePlayerStore.setState({
            character: null,
            fear: 0, energy: 100, watermelons: 0, bossLevel: 0,
            inventory: [],
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
            fear: 0, energy: 100, watermelons: 0, bossLevel: 0,
            inventory: [],
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
        const inventory = Array.isArray(cs.inventory)
          ? (cs.inventory as unknown[]).filter((x): x is string => typeof x === "string")
          : [];

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
        });

        usePlayerStore.setState({
          character,
          fear: typeof data.fear === "number" ? data.fear : 0,
          energy: typeof data.energy === "number" ? data.energy : 100,
          watermelons: typeof data.watermelons === "number" ? data.watermelons : 0,
          bossLevel: typeof data.boss_level === "number" ? data.boss_level : 0,
          settings,
          inventory,
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

  // ─── AUTO-SYNC TO DB ─────────────────────────────────────────────────────────
  // CRITICAL: This effect ONLY writes gameplay stats (fear, watermelons, boss_level, telekinesis_level).
  // It NEVER touches: avatar_url, character_name, character_gender, character_style, lore, custom_settings.
  // custom_settings is written ONLY via the "Сохранить настройки" button in Settings.
  // Identity fields are written ONLY by CharacterCreate, Gallery, or explicit save actions.
  const lastWrittenRef = useRef<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    lastWrittenRef.current = null;
    loadedRef.current = false;
  }, [profile?.telegram_id]);

  const store = usePlayerStore();

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

    const payload = JSON.parse(snapshot);
    const timer = setTimeout(async () => {
      // UPDATE only gameplay stats — custom_settings and identity fields are NOT touched here
      console.log(`[DB WRITE] 📝 player_stats UPDATE (gameplay only) for telegram_id=${telegramId}`, {
        fear: payload.fear,
        energy: payload.energy,
        watermelons: payload.watermelons,
        boss_level: payload.boss_level,
        telekinesis_level: payload.telekinesis_level,
        timestamp: new Date().toISOString(),
      });

      const { error } = await supabase
        .from("player_stats")
        .update({
          fear: payload.fear,
          energy: payload.energy,
          watermelons: payload.watermelons,
          boss_level: payload.boss_level,
          telekinesis_level: payload.telekinesis_level,
          // custom_settings intentionally excluded — saved only via Settings page
        })
        .eq("telegram_id", telegramId);

      if (error) {
        console.error("[DB WRITE] ❌ player_stats UPDATE error:", error.message);
      } else {
        console.log("[DB WRITE] ✅ player_stats UPDATE success (gameplay)");
      }

      // Leaderboard cache — read-only for display, uses current store values
      const storeNow = usePlayerStore.getState();
      const avatarForLeader = isRealAvatar(storeNow.character?.avatarUrl)
        ? storeNow.character!.avatarUrl
        : FALLBACK_AVATAR;

      const { error: lbError } = await supabase.from("leaderboard_cache").upsert({
        telegram_id: telegramId,
        display_name: storeNow.character?.name || "Безымянный",
        fear: storeNow.fear,
        telekinesis_level: storeNow.character?.telekinesisLevel ?? 1,
        avatar_url: avatarForLeader,
      }, { onConflict: "telegram_id" });

      if (lbError) {
        console.error("[DB WRITE] ❌ leaderboard_cache UPSERT error:", lbError.message);
      } else {
        console.log("[DB WRITE] ✅ leaderboard_cache UPSERT success");
      }
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
    watermelons: store.watermelons,
    boss_level: store.bossLevel,
    telekinesis_level: store.character?.telekinesisLevel ?? 1,
  });
}
