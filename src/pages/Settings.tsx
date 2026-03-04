import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore, ButtonSize, FontFamily, Theme } from "../store/playerStore";
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
} from "lucide-react";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";

import Header from "../components/Header";

export default function Settings() {
  const navigate = useNavigate();
  const { settings, updateSettings, character } = usePlayerStore();
  const { profile } = useTelegram();
  const [resetting, setResetting] = useState(false);

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
        // Удаляем данные из Supabase
        await Promise.all([
          supabase.from("player_stats").delete().eq("telegram_id", telegramId),
          supabase.from("player_inventory").delete().eq("telegram_id", telegramId),
          supabase.from("player_achievements").delete().eq("telegram_id", telegramId),
          supabase.from("leaderboard_cache").delete().eq("telegram_id", telegramId),
        ]);
      }
    } catch (e) {
      console.error("Reset error:", e);
    }
    // Сбрасываем store и localStorage
    usePlayerStore.setState({
      character: null,
      fear: 0,
      energy: 50,
      watermelons: 0,
      bossLevel: 1,
      lastEnergyUpdate: Date.now(),
      inventory: [],
      achievements: [],
      friends: [{ name: "ДанИИл", isAiEnabled: true }],
      quests: [],
    });
    localStorage.removeItem("babai-storage");
    setResetting(false);
    navigate("/create");
  };

  if (!character) {
    navigate("/");
    return null;
  }

  const handleButtonSizeChange = (size: ButtonSize) => {
    updateSettings({ buttonSize: size });
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ fontSize: parseInt(e.target.value, 10) });
  };

  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ fontFamily: e.target.value as FontFamily });
  };

  const handleThemeChange = (theme: Theme) => {
    updateSettings({ theme });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ musicVolume: parseInt(e.target.value) });
  };

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
                onClick={() => handleButtonSizeChange(size)}
                className={`p-3 rounded-xl border font-medium transition-all ${settings.buttonSize === size ? "border-red-600 bg-red-900/30 text-white" : "border-neutral-800 bg-neutral-900/50 backdrop-blur-sm text-white hover:bg-neutral-800"}`}
              >
                {size === "small"
                  ? "Мелкие"
                  : size === "medium"
                    ? "Средние"
                    : "Крупные"}
              </button>
            ))}
          </div>
        </section>

        {/* Theme Selection */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-b border-neutral-800 pb-2 flex items-center gap-2">
            <Square size={18} /> Тема оформления
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {(["normal", "cyberpunk"] as Theme[]).map((theme) => (
              <button
                key={theme}
                onClick={() => handleThemeChange(theme)}
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
              id="fontFamily"
              value={settings.fontFamily ?? "JetBrains Mono"}
              onChange={handleFontFamilyChange}
              className="w-full bg-neutral-800/50 text-white border border-neutral-700 rounded-xl p-3 outline-none focus:border-red-500 transition-colors"
            >
              <option value="Inter" className="font-sans">Обычный (Inter)</option>
              <option value="Roboto" style={{ fontFamily: "'Roboto', sans-serif" }}>Робото (Roboto)</option>
              <option value="Montserrat" style={{ fontFamily: "'Montserrat', sans-serif" }}>Монтсеррат (Montserrat)</option>
              <option value="Playfair Display" style={{ fontFamily: "'Playfair Display', serif" }}>Классический (Playfair)</option>
              <option value="JetBrains Mono" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Технический (JetBrains)</option>
              <option value="Press Start 2P" style={{ fontFamily: "'Press Start 2P', cursive" }}>Ретро (8-bit)</option>
              <option value="Russo One" style={{ fontFamily: "'Russo One', sans-serif" }}>Мощный (Russo One)</option>
              <option value="Rubik Beastly" style={{ fontFamily: "'Rubik Beastly', cursive" }}>Монстр (Rubik Beastly)</option>
              <option value="Rubik Burned" style={{ fontFamily: "'Rubik Burned', cursive" }}>Сгоревший (Rubik Burned)</option>
              <option value="Rubik Glitch" style={{ fontFamily: "'Rubik Glitch', cursive" }}>Глитч (Rubik Glitch)</option>
              <option value="Neucha" style={{ fontFamily: "'Neucha', cursive" }}>Рукописный (Neucha)</option>
              <option value="Ruslan Display" style={{ fontFamily: "'Ruslan Display', cursive" }}>Славянский (Ruslan)</option>
              <option value="Tektur" style={{ fontFamily: "'Tektur', sans-serif" }}>Киберпанк (Tektur)</option>
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
              id="fontSize"
              type="range"
              min="5"
              max="24"
              value={settings.fontSize ?? 16}
              onChange={handleFontSizeChange}
              className="w-full accent-red-600 h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-white mt-4 font-mono">
              <span>5px</span>
              <span>24px</span>
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
              id="fontBrightness"
              type="range"
              min="0"
              max="100"
              value={settings.fontBrightness ?? 100}
              onChange={(e) => updateSettings({ fontBrightness: parseInt(e.target.value, 10) })}
              className="w-full accent-red-600 h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-white mt-4 font-mono">
              <span>0%</span>
              <span>100%</span>
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
              id="musicVolume"
              type="range"
              min="0"
              max="100"
              value={settings.musicVolume ?? 50}
              onChange={handleVolumeChange}
              className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
            <div className="flex justify-between text-xs text-white mt-4">
              <span>0%</span>
              <span className="text-white font-bold">
                {settings.musicVolume}%
              </span>
              <span>100%</span>
            </div>
          </div>
        </section>

        {/* Reset Data */}
        <section className="pt-8 space-y-4">
          <button
            onClick={() => {
              if (window.confirm("Очистить галерею? Это освободит место в памяти устройства.")) {
                usePlayerStore.setState({ gallery: [] });
                alert("Галерея очищена.");
              }
            }}
            className="w-full py-3 bg-neutral-900/50 backdrop-blur-sm hover:bg-neutral-800 text-white border border-neutral-800 rounded-xl font-bold transition-colors text-sm"
          >
            ОЧИСТИТЬ ГАЛЕРЕЮ
          </button>

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
