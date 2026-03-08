import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { motion } from "motion/react";
import {
  Play,
  ShoppingCart,
  Settings,
  Users,
  Trophy,
  Loader2,
  Skull,
  Zap,
  Image as ImageIcon,
  MessageSquare,
} from "lucide-react";
import CurrencyModal, { CurrencyType } from "../components/CurrencyModal";
import { usePvpLobby } from "../hooks/usePvpLobby";
import PvpLobbyBanner from "../components/PvpLobbyBanner";
import { useTelegram } from "../context/TelegramContext";

export default function GameHub() {
  const navigate = useNavigate();
  const { character, dbLoaded, fear, watermelons, energy, lastEnergyUpdate, storeConfig } = usePlayerStore();
  const [infoModal, setInfoModal] = useState<CurrencyType>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const calc = () => {
      const now = Date.now();
      const diff = now - lastEnergyUpdate;
      const regenRateMs = (storeConfig?.energyRegenMinutes || 5) * 60 * 1000;
      setTimeLeft(Math.floor((regenRateMs - (diff % regenRateMs)) / 1000));
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [lastEnergyUpdate, storeConfig?.energyRegenMinutes]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  useEffect(() => {
    if (dbLoaded && !character) navigate("/", { replace: true });
  }, [dbLoaded, character, navigate]);

  if (!dbLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-500">
        <Loader2 size={28} className="animate-spin text-red-700" />
        <span className="text-sm">Загрузка духа...</span>
      </div>
    );
  }

  if (!character) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container">
        <div className="fog-layer"></div>
        <div className="fog-layer-2"></div>
      </div>

      {/* ── Header ── */}
      <header className="relative p-4 bg-black/20 backdrop-blur-2xl border-b border-white/10 sticky top-0 z-20 shrink-0 shadow-lg">
        {/* Row 1: Title */}
        <h1 className="text-[18px] font-bold uppercase tracking-widest text-center mb-2">
          Главная
        </h1>
        {/* Row 2: Stats */}
        <div className="flex items-center justify-center gap-5">
          <button
            onClick={() => setInfoModal("energy")}
            className="flex flex-col items-center text-yellow-500 font-bold"
          >
            <div className="flex items-center gap-1 text-[15px]">
              <Zap size={15} /> {energy}
            </div>
            <div className="text-[9px] text-yellow-500/60 -mt-0.5">{fmt(timeLeft)}</div>
          </button>
          <button
            onClick={() => setInfoModal("fear")}
            className="flex items-center gap-1 text-red-500 font-bold text-[15px]"
          >
            <Skull size={15} /> {fear}
          </button>
          <button
            onClick={() => setInfoModal("watermelons")}
            className="flex items-center gap-1 text-green-500 font-bold text-[15px]"
          >
            🍉 {watermelons}
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 relative z-10">

        {/* Background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/10 via-neutral-950/0 to-neutral-950/0 pointer-events-none" />

        {/* 1. Avatar / Profile block */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          onClick={() => navigate("/profile")}
          data-theme-block="hub-avatar"
          className="w-full flex flex-col items-center bg-neutral-900/70 backdrop-blur-sm border border-neutral-800 rounded-2xl overflow-hidden hover:border-red-900/40 active:scale-[0.98] transition-all"
        >
          {/* Horizontal 16:9 — full width mobile, half width on desktop */}
          <div className="relative w-full md:w-1/2 md:self-center aspect-[16/9]">
            <img
              src={character.avatarUrl}
              alt={character.name}
              className="absolute inset-0 w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
            <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(220,38,38,0.25)] pointer-events-none" />
          </div>
          <div className="w-full px-5 py-4 text-center">
            <h2 className="text-2xl font-black text-white uppercase tracking-wider">{character.name}</h2>
            <p className="text-red-500 text-xs mt-1 uppercase tracking-widest">
              {character.style} · Ур. Телекинеза: {character.telekinesisLevel}
            </p>
            <p className="text-neutral-500 text-[10px] mt-2">Нажмите для перехода в профиль →</p>
          </div>
        </motion.button>

        {/* 2. Play button */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <button
            onClick={() => navigate("/game")}
            data-theme-block="hub-play"
            className="hub-play-btn w-full py-5 bg-red-700 hover:bg-red-600 text-white rounded-2xl font-black text-xl transition-all active:scale-[0.97] flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(220,38,38,0.35)] lightning-btn"
          >
            <Play fill="currentColor" size={20} />
            ИГРАТЬ
          </button>
        </motion.div>

        {/* 3. Leaderboard + Chats row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 gap-3"
        >
          <button
            onClick={() => navigate("/leaderboard")}
            data-theme-block="hub-leaderboard"
            className="flex flex-col items-center justify-center bg-neutral-900/70 backdrop-blur-sm border border-neutral-800 rounded-2xl px-5 py-4 hover:border-yellow-900/50 active:scale-[0.98] transition-all gap-2"
          >
            <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center">
              <Trophy size={18} className="text-yellow-500" />
            </div>
            <p className="font-bold text-white text-sm">Рейтинг</p>
            <p className="text-xs text-neutral-500">Лучшие Бабаи мира</p>
          </button>
          <button
            onClick={() => navigate("/chats")}
            data-theme-block="hub-chats"
            className="flex flex-col items-center justify-center bg-neutral-900/70 backdrop-blur-sm border border-neutral-800 rounded-2xl px-5 py-4 hover:border-blue-900/50 active:scale-[0.98] transition-all gap-2"
          >
            <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center">
              <MessageSquare size={18} className="text-blue-400" />
            </div>
            <p className="font-bold text-white text-sm">Чаты</p>
            <p className="text-xs text-neutral-500">Друзья и группы</p>
          </button>
        </motion.div>

        {/* 4. Settings + Gallery row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 gap-3"
          data-theme-block="hub-grid-top"
        >
          <button
            onClick={() => navigate("/settings")}
            data-theme-block="hub-settings"
            className="flex flex-col items-center justify-center bg-neutral-900/70 backdrop-blur-sm border border-neutral-800 rounded-2xl px-4 py-5 hover:border-neutral-700 active:scale-[0.98] transition-all gap-2"
          >
            <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center">
              <Settings size={18} className="text-neutral-400" />
            </div>
            <p className="font-bold text-white text-sm">Настройки</p>
            <p className="text-[10px] text-neutral-500">Персонаж, звук, интерфейс</p>
          </button>
          <button
            onClick={() => navigate("/gallery")}
            data-theme-block="hub-gallery"
            className="flex flex-col items-center justify-center bg-neutral-900/70 backdrop-blur-sm border border-neutral-800 rounded-2xl px-4 py-5 hover:border-neutral-700 active:scale-[0.98] transition-all gap-2"
          >
            <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center">
              <ImageIcon size={18} className="text-neutral-400" />
            </div>
            <p className="font-bold text-white text-sm">Галерея</p>
            <p className="text-[10px] text-neutral-500">Аватары, фоны, боссы</p>
          </button>
        </motion.div>

        {/* 5. Shop & Friends row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="grid grid-cols-2 gap-3"
          data-theme-block="hub-grid-bottom"
        >
          <button
            onClick={() => navigate("/shop")}
            data-theme-block="hub-shop"
            className="flex flex-col items-center justify-center bg-neutral-900/70 backdrop-blur-sm border border-neutral-800 rounded-2xl px-4 py-5 hover:border-neutral-700 active:scale-[0.98] transition-all gap-2"
          >
            <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center">
              <ShoppingCart size={18} className="text-neutral-400" />
            </div>
            <p className="font-bold text-white text-sm">Магазин</p>
            <p className="text-[10px] text-neutral-500">Предметы и усиления</p>
          </button>
          <button
            onClick={() => navigate("/friends")}
            data-theme-block="hub-friends"
            className="flex flex-col items-center justify-center bg-neutral-900/70 backdrop-blur-sm border border-neutral-800 rounded-2xl px-4 py-5 hover:border-neutral-700 active:scale-[0.98] transition-all gap-2"
          >
            <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center">
              <Users size={18} className="text-neutral-400" />
            </div>
            <p className="font-bold text-white text-sm">Друзья</p>
            <p className="text-[10px] text-neutral-500">Чаты и команда</p>
          </button>
        </motion.div>

        {/* SAV AI footer */}
        <motion.a
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          href="https://t.me/SAV_AIbot"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-2 py-4 opacity-70 hover:opacity-100 transition-opacity"
        >
          <img
            src="https://i.ibb.co/BVgY7XrT/babai.png"
            alt="BABAI"
            className="w-10 h-10 object-contain grayscale"
          />
          <span className="text-[10px] text-neutral-500 tracking-widest uppercase">Сделано SAV AI</span>
        </motion.a>

      </div>

      <CurrencyModal type={infoModal} onClose={() => setInfoModal(null)} />
    </motion.div>
  );
}
