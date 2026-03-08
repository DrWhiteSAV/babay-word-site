import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore, ButtonSize, FontFamily, Theme, DEFAULT_SETTINGS } from "../store/playerStore";
import { motion, AnimatePresence } from "motion/react";
import {
  Settings as SettingsIcon,
  Volume2,
  VolumeX,
  Type,
  Square,
  Bell,
  ChevronRight,
  Loader2,
  Save,
  History,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";
import Header from "../components/Header";

interface HistorySnapshot {
  id: string;
  snapshot_at: string;
  snapshot_reason: string | null;
  character_name: string | null;
  character_gender: string | null;
  character_style: string | null;
  avatar_url: string | null;
  lore: string | null;
  fear: number;
  watermelons: number;
  energy: number;
  boss_level: number;
  telekinesis_level: number;
  custom_settings: Record<string, unknown> | null;
}

export default function Settings() {
  const navigate = useNavigate();
  const { settings, updateSettings, character } = usePlayerStore();
  const { profile } = useTelegram();
  const [resetting, setResetting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // Reset dialog state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");

  // History state
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const telegramId = profile?.telegram_id;
    if (!telegramId) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from("player_stats_history")
      .select("*")
      .eq("telegram_id", telegramId)
      .order("snapshot_at", { ascending: false })
      .limit(20);
    setHistory((data || []) as HistorySnapshot[]);
    setHistoryLoading(false);
  }, [profile?.telegram_id]);

  useEffect(() => {
    if (historyOpen) loadHistory();
  }, [historyOpen, loadHistory]);

  const handleRestoreSnapshot = async (snap: HistorySnapshot) => {
    if (!window.confirm(`Восстановить персонажа «${snap.character_name || "Безымянный"}»? Текущий прогресс будет перезаписан.`)) return;
    setRestoringId(snap.id);
    try {
      const telegramId = profile?.telegram_id;
      if (!telegramId) return;

      // Save current state as a snapshot before overwriting
      const { data: current } = await supabase
        .from("player_stats")
        .select("*")
        .eq("telegram_id", telegramId)
        .single();
      if (current) {
        await supabase.from("player_stats_history").insert({
          telegram_id: telegramId,
          character_name: current.character_name,
          character_gender: current.character_gender,
          character_style: current.character_style,
          avatar_url: current.avatar_url,
          lore: current.lore,
          fear: current.fear,
          watermelons: current.watermelons,
          energy: current.energy,
          boss_level: current.boss_level,
          telekinesis_level: current.telekinesis_level,
          custom_settings: current.custom_settings,
          snapshot_reason: "before_restore",
        });
      }

      await supabase.from("player_stats").update({
        character_name: snap.character_name,
        character_gender: snap.character_gender,
        character_style: snap.character_style,
        avatar_url: snap.avatar_url,
        lore: snap.lore,
        fear: snap.fear,
        watermelons: snap.watermelons,
        energy: snap.energy,
        boss_level: snap.boss_level,
        telekinesis_level: snap.telekinesis_level,
        custom_settings: (snap.custom_settings || {}) as unknown as import("../integrations/supabase/types").Json,
        game_status: snap.character_name ? "playing" : "reset",
      }).eq("telegram_id", telegramId);

      console.log(`[DB WRITE] 📝 Restore snapshot for telegram_id=${telegramId}, name=${snap.character_name}`);

      // Update store
      const cs = (snap.custom_settings || {}) as Record<string, unknown>;
      usePlayerStore.setState({
        character: snap.character_name ? {
          name: snap.character_name,
          gender: (snap.character_gender as any) || "Бабай",
          style: (snap.character_style as any) || "Хоррор",
          wishes: Array.isArray(cs.wishes) ? (cs.wishes as string[]) : [],
          avatarUrl: snap.avatar_url || "https://i.ibb.co/BVgY7XrT/babai.png",
          telekinesisLevel: snap.telekinesis_level ?? 1,
          lore: snap.lore || undefined,
        } : null,
        fear: snap.fear ?? 0,
        watermelons: snap.watermelons ?? 0,
        energy: snap.energy ?? 100,
        bossLevel: snap.boss_level ?? 0,
        settings: {
          buttonSize: (cs.buttonSize as any) || "small",
          fontFamily: (cs.fontFamily as any) || "Russo One",
          fontSize: typeof cs.fontSize === "number" ? cs.fontSize : 12,
          fontBrightness: typeof cs.fontBrightness === "number" ? cs.fontBrightness : 100,
          theme: (cs.theme as any) || "normal",
          musicVolume: typeof cs.musicVolume === "number" ? cs.musicVolume : 50,
          ttsEnabled: typeof cs.ttsEnabled === "boolean" ? cs.ttsEnabled : false,
        },
        gameStatus: snap.character_name ? "playing" : "reset",
        dbLoaded: true,
      });

      navigate("/");
    } catch (e) {
      console.error("Restore error:", e);
    }
    setRestoringId(null);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const telegramId = profile?.telegram_id;
      if (telegramId) {
        // READ current custom_settings from DB first to preserve wishes/inventory
        const { data: existing } = await supabase
          .from("player_stats")
          .select("custom_settings")
          .eq("telegram_id", telegramId)
          .single();

        const existingCs = (existing?.custom_settings as Record<string, unknown>) || {};

        const newCs = {
          ...existingCs,
          buttonSize: settings.buttonSize,
          fontFamily: settings.fontFamily,
          fontSize: settings.fontSize,
          fontBrightness: settings.fontBrightness,
          theme: settings.theme,
          musicVolume: settings.musicVolume,
          ttsEnabled: settings.ttsEnabled,
        };

        console.log(`[DB WRITE] 📝 Settings SAVE for telegram_id=${telegramId}`, newCs);

        // UPDATE only custom_settings — NEVER touch avatar_url or character fields
        const { error } = await supabase
          .from("player_stats")
          .update({ custom_settings: newCs })
          .eq("telegram_id", telegramId);

        if (error) throw error;
        console.log("[DB WRITE] ✅ Settings saved to DB successfully");
      }
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } catch (e) {
      console.error("[DB WRITE] ❌ Save settings error:", e);
    }
    setSaving(false);
  };

  const handleResetProgress = async () => {
    setResetDialogOpen(false);
    setResetting(true);
    try {
      const telegramId = profile?.telegram_id;
      if (telegramId) {
        const { data: current } = await supabase
          .from("player_stats")
          .select("*")
          .eq("telegram_id", telegramId)
          .single();

        if (current) {
          const label = snapshotName.trim() || current.character_name || "Безымянный";
          await supabase.from("player_stats_history").insert({
            telegram_id: telegramId,
            character_name: label,
            character_gender: current.character_gender,
            character_style: current.character_style,
            avatar_url: current.avatar_url,
            lore: current.lore,
            fear: current.fear,
            watermelons: current.watermelons,
            energy: current.energy,
            boss_level: current.boss_level,
            telekinesis_level: current.telekinesis_level,
            custom_settings: current.custom_settings,
            snapshot_reason: "reset",
          });
        }

        await Promise.all([
          supabase.from("player_stats").update({
            fear: 0, watermelons: 0, energy: 100, boss_level: 0,
            telekinesis_level: 1, total_clicks: 0,
            character_name: null, character_gender: null, character_style: null,
            avatar_url: null, lore: null,
            game_status: "reset",
            referral_bonus_claimed: false,
            custom_settings: {
              buttonSize: "small",
              fontFamily: "Russo One",
              fontSize: 12,
              fontBrightness: 100,
              theme: "normal",
              musicVolume: 50,
              ttsEnabled: false,
              wishes: [],
              inventory: [],
            },
          }).eq("telegram_id", telegramId),
          supabase.from("player_inventory").delete().eq("telegram_id", telegramId),
          supabase.from("player_achievements").delete().eq("telegram_id", telegramId),
          supabase.from("leaderboard_cache").delete().eq("telegram_id", telegramId),
        ]);
        console.log("[DB WRITE] ✅ player_stats RESET complete for telegram_id:", telegramId);
      }
    } catch (e) {
      console.error("Reset error:", e);
    }
    usePlayerStore.setState({
      character: null,
      fear: 0,
      energy: 100,
      watermelons: 0,
      bossLevel: 0,
      lastEnergyUpdate: Date.now(),
      inventory: [],
      achievements: [],
      friends: [],
      quests: [],
      settings: {
        buttonSize: "small",
        fontFamily: "Russo One",
        fontSize: 12,
        fontBrightness: 100,
        theme: "normal",
        musicVolume: 50,
        ttsEnabled: false,
      },
      dbLoaded: false,
    });
    setSnapshotName("");
    setResetting(false);
    navigate("/create");
  };

  // Wait for DB before redirecting — character is null until loadStats completes
  const { dbLoaded } = usePlayerStore();

  useEffect(() => {
    if (dbLoaded && !character) {
      navigate("/");
    }
  }, [dbLoaded, character]);

  if (!dbLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-500">
        <Loader2 size={28} className="animate-spin text-red-700" />
        <span className="text-sm">Загрузка настроек...</span>
      </div>
    );
  }

  if (!character) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col bg-transparent text-white relative overflow-hidden"
    >
      <div className="fog-container">
        <div className="fog-layer"></div>
        <div className="fog-layer-2"></div>
      </div>

      <Header 
        title={<><SettingsIcon size={20} /> Настройки</>}
        backUrl="/hub"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Button Size */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-b border-neutral-800 pb-2 flex items-center gap-2">
            <Square size={18} /> Размер кнопок
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {(["small", "medium", "large"] as ButtonSize[]).map((size) => (
              <button
                key={size}
                onClick={() => updateSettings({ buttonSize: size })}
                className={`p-3 rounded-xl border font-medium transition-all ${settings.buttonSize === size ? "border-red-600 bg-red-900/30 text-white" : "border-neutral-800 bg-neutral-900/50 backdrop-blur-sm text-white hover:bg-neutral-800"}`}
              >
                {size === "small" ? "Мелкие" : size === "medium" ? "Средние" : "Крупные"}
              </button>
            ))}
          </div>
        </section>

        {/* Theme */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-b border-neutral-800 pb-2 flex items-center gap-2">
            <Square size={18} /> Тема оформления
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {(["normal", "cyberpunk"] as Theme[]).map((theme) => (
              <button
                key={theme}
                onClick={() => updateSettings({ theme })}
                className={`p-3 rounded-xl border font-bold transition-all uppercase tracking-wider ${settings.theme === theme ? "border-red-600 bg-red-900/30 text-white" : "border-neutral-800 bg-neutral-900/50 backdrop-blur-sm text-white hover:bg-neutral-800"}`}
              >
                {theme === "normal" ? "Обычная" : "Киберпанк"}
              </button>
            ))}
          </div>
        </section>

        {/* Font Family */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-b border-neutral-800 pb-2 flex items-center gap-2">
            <Type size={18} /> Стиль шрифта
          </h2>
          <div className="bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 rounded-2xl p-4">
            <select
              value={settings.fontFamily ?? "JetBrains Mono"}
              onChange={(e) => updateSettings({ fontFamily: e.target.value as FontFamily })}
              className="w-full bg-neutral-800/50 text-white border border-neutral-700 rounded-xl p-3 outline-none focus:border-red-500 transition-colors"
            >
              <option value="Inter">Обычный (Inter)</option>
              <option value="Roboto">Робото (Roboto)</option>
              <option value="Montserrat">Монтсеррат (Montserrat)</option>
              <option value="Playfair Display">Классический (Playfair)</option>
              <option value="JetBrains Mono">Технический (JetBrains)</option>
              <option value="Press Start 2P">Ретро (8-bit)</option>
              <option value="Russo One">Мощный (Russo One)</option>
              <option value="Rubik Beastly">Монстр (Rubik Beastly)</option>
              <option value="Rubik Burned">Сгоревший (Rubik Burned)</option>
              <option value="Rubik Glitch">Глитч (Rubik Glitch)</option>
              <option value="Neucha">Рукописный (Neucha)</option>
              <option value="Ruslan Display">Славянский (Ruslan)</option>
              <option value="Tektur">Киберпанк (Tektur)</option>
            </select>
          </div>
        </section>

        {/* Font Size */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-b border-neutral-800 pb-2 flex items-center gap-2">
            <Type size={18} /> Размер шрифта: {settings.fontSize}px
          </h2>
          <div className="bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 rounded-2xl p-6">
            <input
              type="range" min="5" max="24"
              value={settings.fontSize ?? 12}
              onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value, 10) })}
              className="w-full accent-red-600 h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-white mt-4 font-mono">
              <span>5px</span><span>24px</span>
            </div>
          </div>
        </section>

        {/* Font Brightness */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-b border-neutral-800 pb-2 flex items-center gap-2">
            <Type size={18} /> Яркость шрифта: {settings.fontBrightness}%
          </h2>
          <div className="bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 rounded-2xl p-6">
            <input
              type="range" min="0" max="100"
              value={settings.fontBrightness ?? 100}
              onChange={(e) => updateSettings({ fontBrightness: parseInt(e.target.value, 10) })}
              className="w-full accent-red-600 h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-white mt-4 font-mono">
              <span>0%</span><span>100%</span>
            </div>
          </div>
        </section>

        {/* TTS Toggle */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-b border-neutral-800 pb-2 flex items-center gap-2">
            {settings.ttsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />} Озвучка текста
          </h2>
          <button
            onClick={() => updateSettings({ ttsEnabled: !settings.ttsEnabled })}
            className={`w-full p-4 rounded-xl border font-bold transition-all flex items-center justify-center gap-2 ${settings.ttsEnabled ? "border-green-600 bg-green-900/30 text-green-400" : "border-neutral-800 bg-neutral-900/50 backdrop-blur-sm text-white"}`}
          >
            {settings.ttsEnabled ? "ВКЛЮЧЕНА" : "ВЫКЛЮЧЕНА"}
          </button>
        </section>

        {/* Music Volume */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-b border-neutral-800 pb-2 flex items-center gap-2">
            <Volume2 size={18} /> Громкость музыки
          </h2>
          <div className="bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 rounded-2xl p-6">
            <input
              type="range" min="0" max="100"
              value={settings.musicVolume ?? 50}
              onChange={(e) => updateSettings({ musicVolume: parseInt(e.target.value) })}
              className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
            <div className="flex justify-between text-xs text-white mt-4">
              <span>0%</span>
              <span className="text-white font-bold">{settings.musicVolume}%</span>
              <span>100%</span>
            </div>
          </div>
        </section>

        {/* Save Settings Button */}
        <section>
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              savedOk
                ? "bg-green-800 border border-green-600 text-green-300"
                : "bg-red-900/30 hover:bg-red-900/50 border border-red-700 text-red-300"
            }`}
          >
            {saving ? <><Loader2 size={18} className="animate-spin" /> Сохранение...</> :
             savedOk ? <>✓ Сохранено!</> :
             <><Save size={18} /> СОХРАНИТЬ НАСТРОЙКИ</>}
          </button>
        </section>

        {/* History of snapshots */}
        <section>
          <button
            onClick={() => setHistoryOpen(v => !v)}
            className="w-full py-4 bg-neutral-900/50 backdrop-blur-sm hover:bg-neutral-800 text-white border border-neutral-800 rounded-xl font-bold transition-colors flex items-center justify-between px-4"
          >
            <span className="flex items-center gap-2">
              <History size={18} className="text-blue-400" /> История версий
              {history.length > 0 && <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">{history.length}</span>}
            </span>
            {historyOpen ? <ChevronUp size={18} className="text-neutral-500" /> : <ChevronDown size={18} className="text-neutral-500" />}
          </button>

          <AnimatePresence>
            {historyOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-2">
                  {historyLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 size={20} className="animate-spin text-neutral-500" />
                    </div>
                  ) : history.length === 0 ? (
                    <p className="text-center text-neutral-500 text-sm py-4">История пуста — сбросьте прогресс хотя бы раз</p>
                  ) : history.map((snap) => {
                    const date = new Date(snap.snapshot_at);
                    const dateStr = date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
                    const timeStr = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
                    const reasonLabel = snap.snapshot_reason === "reset" ? "Сброс" :
                      snap.snapshot_reason === "before_restore" ? "До восстановления" :
                      snap.snapshot_reason || "Снимок";
                    return (
                      <div key={snap.id} className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-3 flex items-center gap-3">
                        {snap.avatar_url ? (
                          <img src={snap.avatar_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-neutral-700" onError={(e) => { (e.target as HTMLImageElement).src = "https://i.ibb.co/BVgY7XrT/babai.png"; }} />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0 text-2xl">👻</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm truncate">{snap.character_name || "Безымянный"}</p>
                          <p className="text-xs text-neutral-400">
                            😱 {snap.fear} • 🍉 {snap.watermelons} • ⚔️ Ур.{snap.boss_level}
                          </p>
                          <p className="text-[10px] text-neutral-600 mt-0.5">
                            {reasonLabel} • {dateStr} {timeStr}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRestoreSnapshot(snap)}
                          disabled={restoringId === snap.id}
                          className="shrink-0 flex items-center gap-1 px-3 py-2 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-800/50 text-blue-300 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {restoringId === snap.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <RotateCcw size={12} />
                          }
                          Вернуть
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Reset Data */}
        <section className="pt-4 space-y-4">
          <button
            onClick={() => { setSnapshotName(character?.name || ""); setResetDialogOpen(true); }}
            disabled={resetting}
            className="w-full py-4 bg-neutral-900/50 backdrop-blur-sm hover:bg-red-900/20 text-red-500 border border-red-900/30 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
          >
            {resetting ? <><Loader2 size={18} className="animate-spin" /> Сброс...</> : "СБРОСИТЬ ПРОГРЕСС"}
          </button>
        </section>

        {/* Reset confirmation dialog */}
        <AnimatePresence>
          {resetDialogOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
              onClick={() => setResetDialogOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-neutral-900 border border-red-900/50 rounded-2xl p-6 w-full max-w-sm space-y-4"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-red-400 text-center">⚠️ Сброс прогресса</h3>
                <p className="text-sm text-neutral-300 text-center leading-relaxed">
                  Весь прогресс, персонаж и инвентарь будут удалены. <span className="text-green-400 font-semibold">Текущая версия будет сохранена в истории</span> — её можно будет восстановить в разделе «История версий».
                </p>
                <div className="space-y-2">
                  <label className="text-xs text-neutral-400 uppercase tracking-wider font-bold">Название для сохранения</label>
                  <input
                    type="text"
                    value={snapshotName}
                    onChange={e => setSnapshotName(e.target.value)}
                    placeholder={character?.name || "Имя персонажа"}
                    maxLength={40}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 outline-none focus:border-red-500 transition-colors text-sm"
                  />
                  <p className="text-[10px] text-neutral-600">Оставьте пустым, чтобы использовать имя персонажа</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setResetDialogOpen(false)}
                    className="flex-1 py-3 rounded-xl border border-neutral-700 text-neutral-300 font-bold hover:bg-neutral-800 transition-colors text-sm"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleResetProgress}
                    className="flex-1 py-3 rounded-xl bg-red-900/60 hover:bg-red-800/70 border border-red-700 text-red-300 font-bold transition-colors text-sm"
                  >
                    Сбросить
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notifications settings link */}
        <section>
          <button
            onClick={() => navigate("/settings/notifications")}
            className="w-full py-4 bg-neutral-900/50 backdrop-blur-sm hover:bg-neutral-800 text-white border border-neutral-800 rounded-xl font-bold transition-colors flex items-center justify-between px-4"
          >
            <span className="flex items-center gap-2"><Bell size={18} className="text-yellow-400" /> Настройки уведомлений</span>
            <ChevronRight size={18} className="text-neutral-500" />
          </button>
        </section>

        <div className="flex justify-center pt-8 pb-4 opacity-50">
          <img 
            src="https://i.ibb.co/BVgY7XrT/babai.png" 
            alt="Bab-AI" 
            className="w-24 grayscale"
          />
        </div>
      </div>
    </motion.div>
  );
}
