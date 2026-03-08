import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../components/Header";
import { usePlayerStore } from "../store/playerStore";
import { motion } from "motion/react";
import {
  Play,
  ShoppingCart,
  Settings,
  User,
  Zap,
  Skull,
  Users,
  Trophy,
  Loader2,
} from "lucide-react";
import CurrencyModal, { CurrencyType } from "../components/CurrencyModal";


export default function GameHub() {
  const navigate = useNavigate();
  const location = useLocation();
  const { character, dbLoaded, fear, energy, watermelons, globalBackgroundUrl, pageBackgrounds } = usePlayerStore();
  const [infoModal, setInfoModal] = useState<CurrencyType>(null);

  // Wait for DB load — don't redirect prematurely
  useEffect(() => {
    if (dbLoaded && !character) {
      navigate("/");
    }
  }, [dbLoaded, character]);

  if (!dbLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-500">
        <Loader2 size={28} className="animate-spin text-red-700" />
        <span className="text-sm">Загрузка духа...</span>
      </div>
    );
  }

  if (!character) {
    return null;
  }

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

      <Header 
        onInfoClick={(type) => setInfoModal(type)}
        rightContent={
          <>
            <button
              onClick={() => navigate("/profile")}
              className="p-2 hover:bg-neutral-800 rounded-full transition-colors flex items-center justify-center"
            >
              <img src={character.avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-neutral-500" />
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="p-2 hover:bg-neutral-800 rounded-full transition-colors text-neutral-400 hover:text-white"
            >
              <Settings size={20} />
            </button>
          </>
        }
      />

      {/* Character Display */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-neutral-950 to-neutral-950 pointer-events-none" />

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 15 }}
          className="relative z-10 text-center"
        >
          <div className="w-48 h-48 mx-auto rounded-full border-4 border-neutral-800 overflow-hidden shadow-[0_0_40px_rgba(220,38,38,0.15)] bg-neutral-900 mb-6 relative group">
            <img
              src={character.avatarUrl}
              alt={character.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 ring-inset ring-1 ring-white/10 rounded-full pointer-events-none" />
          </div>

          <h2
            className="text-3xl font-black text-white uppercase tracking-wider"
          >
            {character.name}
          </h2>
          <p className="text-red-500 text-xs mt-2 uppercase tracking-widest">
            {character.style} 
            • Ур. Телекинеза: {character.telekinesisLevel}
          </p>
        </motion.div>
      </div>

      {/* Action Buttons */}
      <div className="p-6 bg-neutral-900/50 backdrop-blur-sm border-t border-neutral-800 rounded-t-3xl space-y-3 relative z-20">
        <button
          onClick={() => navigate("/game")}
          className="w-full py-4 bg-red-700 hover:bg-red-600 text-white rounded-2xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(220,38,38,0.3)] lightning-btn"
        >
          <Play fill="currentColor" size={20} />
          ИГРАТЬ
        </button>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => navigate("/shop")}
            className="py-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-2xl font-medium transition-all active:scale-95 flex flex-col items-center justify-center gap-2 border border-neutral-700"
          >
            <ShoppingCart size={20} className="text-neutral-400" />
            <span className="text-[10px] uppercase tracking-wider font-bold">
              Магазин
            </span>
          </button>
          <button
            onClick={() => navigate("/friends")}
            className="py-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-2xl font-medium transition-all active:scale-95 flex flex-col items-center justify-center gap-2 border border-neutral-700"
          >
            <Users size={20} className="text-neutral-400" />
            <span className="text-[10px] uppercase tracking-wider font-bold">
              Друзья
            </span>
          </button>
          <button
            onClick={() => navigate("/leaderboard")}
            className="py-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-2xl font-medium transition-all active:scale-95 flex flex-col items-center justify-center gap-2 border border-neutral-700"
          >
            <Trophy size={20} className="text-yellow-500" />
            <span className="text-[10px] uppercase tracking-wider font-bold">
              Рейтинг
            </span>
          </button>
        </div>
      </div>

      <CurrencyModal type={infoModal} onClose={() => setInfoModal(null)} />
    </motion.div>
  );
}
