import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore, ButtonSize, FontFamily, Theme, DEFAULT_SETTINGS } from "../store/playerStore";
import { motion } from "motion/react";
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
} from "lucide-react";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";
import Header from "../components/Header";

export default function Settings() {
  const navigate = useNavigate();
  const { settings, updateSettings, character } = usePlayerStore();
  const { profile } = useTelegram();
  const [resetting, setResetting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

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

        // UPDATE only custom_settings — NEVER touch avatar_url or character fields
        const { error } = await supabase
          .from("player_stats")
          .update({
            custom_settings: {
              ...existingCs,
              buttonSize: settings.buttonSize,
              fontFamily: settings.fontFamily,
              fontSize: settings.fontSize,
              fontBrightness: settings.fontBrightness,
              theme: settings.theme,
              musicVolume: settings.musicVolume,
              ttsEnabled: settings.ttsEnabled,
            },
          })
          .eq("telegram_id", telegramId);

        if (error) throw error;
      }
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } catch (e) {
      console.error("Save settings error:", e);
    }
    setSaving(false);
  };

  const handleResetProgress = async () => {
    if (!window.confirm("Вы уверены? Весь прогресс, персонаж, очки и инвентарь будут удалены безвозвратно.")) return;
    const word = window.prompt('Для подтверждения введите слово СБРОС:');
    if (word?.trim().toUpperCase() !== "СБРОС") {
      window.alert("Сброс отменён — слово не совпало.");
      return;
    }
    setResetting(true);
    try {
      const telegramId = profile?.telegram_id;
      if (telegramId) {
        // Save snapshot before reset for rollback
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
    // Reset store to defaults
    usePlayerStore.setState({
      character: null,
      fear: 0,
      energy: 100,
      watermelons: 0,
      bossLevel: 0,
      lastEnergyUpdate: Date.now(),
      inventory: [],
      achievements: [],
      friends: [{ name: "ДанИИл", isAiEnabled: true }],
      quests: [],
      settings: { ...DEFAULT_SETTINGS },
      dbLoaded: false,
    });
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

        {/* Reset Data */}
        <section className="pt-4 space-y-4">
          <button
            onClick={handleResetProgress}
            disabled={resetting}
            className="w-full py-4 bg-neutral-900/50 backdrop-blur-sm hover:bg-red-900/20 text-red-500 border border-red-900/30 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
          >
            {resetting ? <><Loader2 size={18} className="animate-spin" /> Сброс...</> : "СБРОСИТЬ ПРОГРЕСС"}
          </button>
        </section>

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
