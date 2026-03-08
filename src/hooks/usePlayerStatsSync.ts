import { useEffect, useRef } from "react";
import { usePlayerStore, ButtonSize, FontFamily, Theme } from "../store/playerStore";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";

const FALLBACK_AVATAR = "https://i.ibb.co/BVgY7XrT/babai.png";

const DEFAULT_SETTINGS: {
  buttonSize: ButtonSize;
  fontFamily: FontFamily;
  fontSize: number;
  fontBrightness: number;
  theme: Theme;
  musicVolume: number;
  ttsEnabled: boolean;
} = {
  buttonSize: "small",
  fontFamily: "JetBrains Mono",
  fontSize: 12,
  fontBrightness: 100,
  theme: "normal",
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

  const buttonSize = BUTTON_SIZES.includes(cs.buttonSize as ButtonSize)
    ? (cs.buttonSize as ButtonSize)
    : DEFAULT_SETTINGS.buttonSize;

  const fontFamily = FONT_FAMILIES.includes(cs.fontFamily as FontFamily)
    ? (cs.fontFamily as FontFamily)
    : DEFAULT_SETTINGS.fontFamily;

  const fontSize = typeof cs.fontSize === "number" && cs.fontSize >= 5 && cs.fontSize <= 24
    ? cs.fontSize
    : DEFAULT_SETTINGS.fontSize;
  const fontBrightness =
    typeof cs.fontBrightness === "number" ? cs.fontBrightness : DEFAULT_SETTINGS.fontBrightness;
  const theme = THEMES.includes(cs.theme as Theme) ? (cs.theme as Theme) : DEFAULT_SETTINGS.theme;
  const musicVolume =
    typeof cs.musicVolume === "number" ? cs.musicVolume : DEFAULT_SETTINGS.musicVolume;
  const ttsEnabled = typeof cs.ttsEnabled === "boolean" ? cs.ttsEnabled : DEFAULT_SETTINGS.ttsEnabled;

  return { buttonSize, fontFamily, fontSize, fontBrightness, theme, musicVolume, ttsEnabled };
};

export function usePlayerStatsSync() {
  const store = usePlayerStore();
  const { profile } = useTelegram();
  const activeTelegramId = useRef<number | null>(null);
  const lastKnownAvatarUrl = useRef<string>(FALLBACK_AVATAR);
  // Timestamp when DB load completed — we block all writes for 5s after load
  // to prevent energy regen / other instant state changes from overwriting fresh DB data
  const dbLoadedAtRef = useRef<number>(0);

  // ─── LOAD FROM DB — always overwrites localStorage/cache ───────────────────
  useEffect(() => {
    const telegramId = profile?.telegram_id;
    if (!telegramId) return;

    // Reset dbLoaded on every new user/session — force fresh DB check
    activeTelegramId.current = telegramId;
    usePlayerStore.setState({ dbLoaded: false, gameStatus: "loading" });

    let cancelled = false;

    const loadStats = async () => {
      try {
        const [{ data, error }, { data: galleryRows, error: galleryError }] = await Promise.all([
          supabase
            .from("player_stats")
            .select("*")
            .eq("telegram_id", telegramId)
            .maybeSingle(),
          supabase
            .from("gallery")
            .select("image_url, label, created_at")
            .eq("telegram_id", telegramId)
            .order("created_at", { ascending: false })
            .limit(12),
        ]);

        if (cancelled || activeTelegramId.current !== telegramId) return;

        const updates: Record<string, any> = {};

        // Gallery URLs for profile preview
        if (!galleryError && galleryRows && galleryRows.length > 0) {
          const galleryUrls = Array.from(
            new Set(
              galleryRows
                .map((row) => (typeof row.image_url === "string" ? row.image_url.trim() : ""))
                .filter((url) => isHttpUrl(url))
            )
          );
          if (galleryUrls.length > 0) {
            updates.gallery = galleryUrls;
            // Find most recent avatar
            const latestAvatar = galleryRows.find((row) => {
              const label = (row.label || "").toLowerCase();
              return label.includes("[avatars]") || label.includes("[avatar]") || label.includes("аватар");
            });
            if (latestAvatar?.image_url && isHttpUrl(latestAvatar.image_url)) {
              lastKnownAvatarUrl.current = latestAvatar.image_url;
            }
          }
        }

        if (error) {
          console.error("[usePlayerStatsSync] player_stats load error:", error.message);
          // Even on error, mark as loaded so sync doesn't hang
          usePlayerStore.setState({ dbLoaded: true, gameStatus: "playing" });
          return;
        }

        if (!data) {
          // Brand new user — clean defaults, no character
          updates.character = null;
          updates.fear = 0;
          updates.energy = 100;
          updates.watermelons = 0;
          updates.bossLevel = 0;
          updates.inventory = [];
          updates.settings = { ...DEFAULT_SETTINGS };
          updates.gameStatus = "new";
          updates.dbLoaded = true;
          usePlayerStore.setState(updates);
          dbLoadedAtRef.current = Date.now();
          return;
        }

        // ── If game_status = 'reset', block sync and treat as new user ────────
        const gameStatus = data.game_status || "playing";
        updates.gameStatus = gameStatus;

        if (gameStatus === "reset") {
          // User reset and closed app before completing character creation
          // Do NOT write anything to DB — just load empty state and send to /create
          updates.character = null;
          updates.fear = 0;
          updates.energy = 100;
          updates.watermelons = 0;
          updates.bossLevel = 0;
          updates.inventory = [];
          updates.settings = { ...DEFAULT_SETTINGS };
          updates.dbLoaded = true;
          usePlayerStore.setState(updates);
          console.log("[usePlayerStatsSync] game_status=reset — sync blocked, redirecting to create");
          return;
        }

        // ── DB is the source of truth — overwrite everything ──────────────────
        updates.fear = typeof data.fear === "number" ? data.fear : 0;
        updates.energy = typeof data.energy === "number" ? data.energy : 100;
        updates.watermelons = typeof data.watermelons === "number" ? data.watermelons : 0;
        updates.bossLevel = typeof data.boss_level === "number" ? data.boss_level : 0;

        const customSettings =
          data.custom_settings && typeof data.custom_settings === "object"
            ? (data.custom_settings as Record<string, unknown>)
            : {};

        // Settings from DB always win
        updates.settings = normalizeSettings(customSettings);
        updates.inventory = Array.isArray(customSettings.inventory)
          ? customSettings.inventory.filter((item): item is string => typeof item === "string")
          : [];

        if (data.character_name) {
          const wishes = Array.isArray(customSettings.wishes)
            ? customSettings.wishes.filter((wish): wish is string => typeof wish === "string")
            : [];

          // Avatar: prefer DB avatar_url (if valid http), then gallery fallback
          let resolvedAvatar = FALLBACK_AVATAR;
          if (isHttpUrl(data.avatar_url)) {
            resolvedAvatar = data.avatar_url;
          } else if (isHttpUrl(lastKnownAvatarUrl.current)) {
            resolvedAvatar = lastKnownAvatarUrl.current;
          }

          lastKnownAvatarUrl.current = resolvedAvatar;

          updates.character = {
            name: data.character_name,
            gender: (data.character_gender as any) || "Бабай",
            style: (data.character_style as any) || "Хоррор",
            wishes,
            avatarUrl: resolvedAvatar,
            telekinesisLevel: typeof data.telekinesis_level === "number" ? data.telekinesis_level : 1,
            lore: data.lore || undefined,
          };
        } else {
          updates.character = null;
        }

        // CRITICAL: Set dbLoaded=true as the LAST step, only after ALL data is loaded
        // This ensures the sync-to-DB effect only fires AFTER the store has fresh DB data
        updates.dbLoaded = true;
        usePlayerStore.setState(updates);
        // Record when DB load finished — used to block premature writes
        dbLoadedAtRef.current = Date.now();

        console.log("[usePlayerStatsSync] Loaded from DB:", {
          character: updates.character?.name,
          avatar: updates.character?.avatarUrl,
          gameStatus,
          settings: updates.settings,
        });
      } catch (err) {
        console.error("[usePlayerStatsSync] Unexpected error:", err);
        if (!cancelled && activeTelegramId.current === telegramId) {
          usePlayerStore.setState({ dbLoaded: true, gameStatus: "playing" });
          dbLoadedAtRef.current = Date.now();
        }
      }
    };

    loadStats();
    return () => { cancelled = true; };
  }, [profile?.telegram_id]);

  // ─── SYNC TO DB ──────────────────────────────────────────────────────────
  // Uses snapshot-based comparison: only writes when user actually changed something.
  // energy/fear/watermelons are in syncData payload but NOT in deps — they trigger
  // writes only when a "real" field (character, settings) changes, preventing
  // the every-second energy regen from firing constant DB writes on load.
  const dbSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    dbSnapshotRef.current = null;
    dbLoadedAtRef.current = 0;
  }, [profile?.telegram_id]);

  useEffect(() => {
    if (!profile?.telegram_id) return;
    if (!store.dbLoaded) return;       // Gate #1: wait for DB load
    if (!store.character) return;      // Gate #2: no character = nothing to sync
    if (store.gameStatus === "reset" || store.gameStatus === "loading" || store.gameStatus === "new") return; // Gate #3
    // Gate #0: block writes for 5 seconds after DB load to prevent stale-store race writes
    if (dbLoadedAtRef.current > 0 && Date.now() - dbLoadedAtRef.current < 5000) {
      console.log("[usePlayerStatsSync] ⏳ write blocked — within 5s cooldown after DB load");
      return;
    }

    const currentAvatar = isHttpUrl(store.character.avatarUrl)
      ? store.character.avatarUrl
      : lastKnownAvatarUrl.current;
    if (isHttpUrl(currentAvatar)) lastKnownAvatarUrl.current = currentAvatar;

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
      avatar_url: currentAvatar || FALLBACK_AVATAR,
      lore: store.character.lore || null,
      game_status: "playing",
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

    const currentSnapshot = JSON.stringify(syncData);

    // Gate #4: first fire after DB load — save snapshot, skip write
    if (dbSnapshotRef.current === null) {
      dbSnapshotRef.current = currentSnapshot;
      console.log("[usePlayerStatsSync] ✅ snapshot saved for", store.character.name);
      return;
    }

    // Gate #5: nothing changed vs snapshot
    if (dbSnapshotRef.current === currentSnapshot) return;

    // Real change detected — log diff
    const prevSnapshot = dbSnapshotRef.current;
    dbSnapshotRef.current = currentSnapshot;
    try {
      const prev = JSON.parse(prevSnapshot);
      const curr = syncData as Record<string, unknown>;
      const changed = Object.keys(curr).filter(k => JSON.stringify(prev[k]) !== JSON.stringify(curr[k]));
      console.log("[usePlayerStatsSync] 📝 writing to DB for", store.character.name, "| changed:", changed);
    } catch {
      console.log("[usePlayerStatsSync] 📝 writing to DB for", store.character.name);
    }

    const timer = setTimeout(async () => {
      const { error } = await supabase
        .from("player_stats")
        .upsert(syncData, { onConflict: "telegram_id" });
      if (error) console.error("player_stats sync error:", error.message);

      await supabase.from("leaderboard_cache").upsert(
        {
          telegram_id: profile.telegram_id,
          display_name: store.character?.name || "Безымянный",
          fear: store.fear,
          telekinesis_level: store.character?.telekinesisLevel || 1,
          avatar_url: currentAvatar || FALLBACK_AVATAR,
        },
        { onConflict: "telegram_id" }
      );
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    profile?.telegram_id,
    store.dbLoaded,
    // ← energy/fear/watermelons NOT in deps: they change every second via updateEnergy
    // and would fire constant writes. They are included in syncData payload and will
    // be written when a real field (character, settings) triggers a sync.
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
