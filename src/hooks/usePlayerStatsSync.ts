import { useEffect, useRef } from "react";
import { usePlayerStore, ButtonSize, FontFamily, Theme } from "../store/playerStore";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";

const FALLBACK_AVATAR = "https://i.ibb.co/BVgY7XrT/babai.png";

const DEFAULT_SETTINGS = {
  buttonSize: "small" as ButtonSize,
  fontFamily: "JetBrains Mono" as FontFamily,
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

export function usePlayerStatsSync() {
  const { profile } = useTelegram();

  // ─── LOAD FROM DB ───────────────────────────────────────────────────────────
  useEffect(() => {
    const telegramId = profile?.telegram_id;
    if (!telegramId) return;

    // Mark as loading so pages wait before redirecting
    usePlayerStore.setState({ dbLoaded: false, gameStatus: "loading" });

    let cancelled = false;

    const load = async () => {
      try {
        const [statsResult, galleryResult, friendsResult] = await Promise.all([
          supabase.from("player_stats").select("*").eq("telegram_id", telegramId).maybeSingle(),
          supabase.from("gallery").select("image_url, label, created_at")
            .eq("telegram_id", telegramId).order("created_at", { ascending: false }).limit(12),
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

        // Gallery
        let latestAvatarFromGallery: string | null = null;
        if (galleryResult.data && galleryResult.data.length > 0) {
          const urls = galleryResult.data
            .map(r => r.image_url)
            .filter(isHttpUrl);
          if (urls.length > 0) {
            usePlayerStore.setState({ gallery: Array.from(new Set(urls)) });
          }
          const avatarRow = galleryResult.data.find(r => {
            const lbl = (r.label || "").toLowerCase();
            return lbl.includes("[avatars]") || lbl.includes("[avatar]") || lbl.includes("аватар");
          });
          if (avatarRow?.image_url && isHttpUrl(avatarRow.image_url)) {
            latestAvatarFromGallery = avatarRow.image_url;
          }
        }

        // Friends from DB
        const dbFriends = (friendsResult.data || []).map(f => ({
          name: f.friend_name,
          isAiEnabled: f.is_ai_enabled ?? false,
        }));
        // Always include ДанИИл as AI friend
        const hasAI = dbFriends.some(f => f.name === "ДанИИл");
        const friendsList = hasAI ? dbFriends : [{ name: "ДанИИл", isAiEnabled: true }, ...dbFriends];

        // No row yet → new user
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

        // Reset state → send to /create, don't load old data
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

          let avatarUrl = FALLBACK_AVATAR;
          if (isHttpUrl(data.avatar_url)) avatarUrl = data.avatar_url;
          else if (latestAvatarFromGallery) avatarUrl = latestAvatarFromGallery;

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
          avatar: character?.avatarUrl,
          fontSize: settings.fontSize,
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

  // ─── SYNC TO DB ─────────────────────────────────────────────────────────────
  // Only writes when the user actually changes something meaningful.
  // We track a "last written" snapshot and only write when it differs.
  const lastWrittenRef = useRef<string | null>(null);
  // Flag: has the initial DB load completed for this session?
  const loadedRef = useRef(false);

  // Reset tracking on user change
  useEffect(() => {
    lastWrittenRef.current = null;
    loadedRef.current = false;
  }, [profile?.telegram_id]);

  const store = usePlayerStore();

  useEffect(() => {
    const telegramId = profile?.telegram_id;
    if (!telegramId) return;
    if (!store.dbLoaded) return;                         // wait for load
    if (!store.character) return;                        // no character = nothing to sync
    if (store.gameStatus !== "playing") return;          // only sync when playing

    // First time after load: record baseline, do NOT write to DB
    if (!loadedRef.current) {
      loadedRef.current = true;
      lastWrittenRef.current = buildSnapshot(store, telegramId);
      console.log("[sync] 📌 baseline snapshot saved, skipping write");
      return;
    }

    const snapshot = buildSnapshot(store, telegramId);
    if (lastWrittenRef.current === snapshot) return;    // nothing changed

    // Something changed — schedule write
    const prev = lastWrittenRef.current;
    lastWrittenRef.current = snapshot;

    if (prev !== null) {
      try {
        const p = JSON.parse(prev) as Record<string, unknown>;
        const c = JSON.parse(snapshot) as Record<string, unknown>;
        const changed = Object.keys(c).filter(k => JSON.stringify(p[k]) !== JSON.stringify(c[k]));
        console.log("[sync] 📝 writing to DB, changed fields:", changed);
      } catch { /**/ }
    }

    const payload = JSON.parse(snapshot);
    const timer = setTimeout(async () => {
      const { error } = await supabase.from("player_stats")
        .upsert(payload, { onConflict: "telegram_id" });
      if (error) console.error("[sync] write error:", error.message);

      // Update leaderboard cache
      await supabase.from("leaderboard_cache").upsert({
        telegram_id: telegramId,
        display_name: payload.character_name || "Безымянный",
        fear: payload.fear,
        telekinesis_level: payload.telekinesis_level,
        avatar_url: payload.avatar_url,
      }, { onConflict: "telegram_id" });
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    profile?.telegram_id,
    store.dbLoaded,
    store.gameStatus,
    store.bossLevel,
    store.character?.telekinesisLevel,
    store.character?.name,
    store.character?.gender,
    store.character?.style,
    store.character?.avatarUrl,
    store.character?.lore,
    store.character?.wishes?.join(","),
    store.settings.buttonSize,
    store.settings.fontFamily,
    store.settings.fontSize,
    store.settings.fontBrightness,
    store.settings.theme,
    store.settings.musicVolume,
    store.settings.ttsEnabled,
    store.inventory?.join(","),
  ]);
}

function buildSnapshot(store: ReturnType<typeof usePlayerStore.getState>, telegramId: number): string {
  const avatarUrl = isHttpUrl(store.character?.avatarUrl)
    ? store.character!.avatarUrl
    : FALLBACK_AVATAR;

  return JSON.stringify({
    telegram_id: telegramId,
    fear: store.fear,
    energy: store.energy,
    watermelons: store.watermelons,
    boss_level: store.bossLevel,
    telekinesis_level: store.character?.telekinesisLevel ?? 1,
    character_name: store.character?.name ?? null,
    character_gender: store.character?.gender ?? null,
    character_style: store.character?.style ?? null,
    avatar_url: avatarUrl,
    lore: store.character?.lore ?? null,
    game_status: "playing",
    custom_settings: {
      buttonSize: store.settings.buttonSize,
      fontFamily: store.settings.fontFamily,
      fontSize: store.settings.fontSize,
      fontBrightness: store.settings.fontBrightness,
      theme: store.settings.theme,
      musicVolume: store.settings.musicVolume,
      ttsEnabled: store.settings.ttsEnabled,
      wishes: store.character?.wishes ?? [],
      inventory: store.inventory ?? [],
    },
  });
}
