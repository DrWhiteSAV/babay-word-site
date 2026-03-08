import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { motion } from "motion/react";
import { Play, Settings as SettingsIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";

export default function Home() {
  const navigate = useNavigate();
  const { character } = usePlayerStore(); // used only for avatar preview on Home buttons
  const { profile, isLoading: tgLoading } = useTelegram();

  // null = still checking, true = has character, false = no character
  const [hasCharacter, setHasCharacter] = useState<boolean | null>(null);

  // Direct DB check — always authoritative, bypasses any cache
  useEffect(() => {
    if (tgLoading) return;
    if (!profile?.telegram_id) return;

    let cancelled = false;
    setHasCharacter(null); // reset on every check

    const checkDB = async (attempt = 1) => {
      try {
        const { data, error } = await supabase
          .from("player_stats")
          .select("character_name, game_status, telekinesis_level, character_style")
          .eq("telegram_id", profile.telegram_id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error(`[Home] DB check error (attempt ${attempt}):`, error.message);
          // Retry once on network error
          if (attempt < 2) {
            setTimeout(() => { if (!cancelled) checkDB(2); }, 1500);
            return;
          }
          // On persistent error — show НАЧАТЬ to avoid stuck loading
          setHasCharacter(false);
          return;
        }

        console.log("[Home] DB check result:", {
          telegram_id: profile.telegram_id,
          game_status: data?.game_status,
          character_name: data?.character_name,
          character_style: data?.character_style,
          telekinesis_level: data?.telekinesis_level,
        });

        if (!data) {
          console.log("[Home] No player_stats row found → НАЧАТЬ");
          setHasCharacter(false);
          return;
        }

        // game_status='reset' or 'creating'/'new' → treat as new user
        const blockedStatuses = ["reset", "creating", "new"];
        const isBlocked = blockedStatuses.includes(data.game_status ?? "");
        const hasName = !!(data.character_name && data.character_name.trim().length > 0);
        // Only show CONTINUE if status is explicitly 'playing' AND name exists
        const exists = !isBlocked && hasName && data.game_status === "playing";

        console.log("[Home] hasCharacter →", exists, `(blocked=${isBlocked}, hasName=${hasName}, status=${data.game_status})`);
        setHasCharacter(exists);
      } catch (err) {
        console.error("[Home] Unexpected error:", err);
        if (!cancelled) {
          if (attempt < 2) {
            setTimeout(() => { if (!cancelled) checkDB(2); }, 1500);
          } else {
            setHasCharacter(false);
          }
        }
      }
    };

    checkDB();
    return () => { cancelled = true; };
  }, [profile?.telegram_id, tgLoading]);

  const handlePlay = () => {
    if (hasCharacter) {
      navigate("/hub");
    } else {
      navigate("/create");
    }
  };

  const isChecking = tgLoading || hasCharacter === null;

  if (isChecking) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-transparent">
        <div className="fog-container">
          <div className="fog-layer"></div>
          <div className="fog-layer-2"></div>
        </div>
        <img
          src="https://i.ibb.co/BVgY7XrT/babai.png"
          alt="Бабай"
          className="w-40 drop-shadow-[0_0_25px_rgba(220,38,38,0.5)] animate-pulse mb-6"
        />
        <div className="flex items-center gap-2 text-neutral-500 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Пробуждение духа...
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden bg-transparent"
    >
      <div className="fog-container">
        <div className="fog-layer"></div>
        <div className="fog-layer-2"></div>
      </div>

      <div className="relative z-10 text-center mb-12 flex flex-col items-center">
        <motion.img 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          src="https://i.ibb.co/BVgY7XrT/babai.png"
          alt="Бабай Bab-AI"
          className="w-72 md:w-80 drop-shadow-[0_0_25px_rgba(220,38,38,0.5)]"
        />
      </div>

      <div className="w-full max-w-xs space-y-4 relative z-10">
        <button
          onClick={handlePlay}
          className="w-full py-4 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(220,38,38,0.4)] lightning-btn"
        >
          <Play fill="currentColor" size={20} />
          {hasCharacter ? "ПРОДОЛЖИТЬ" : "НАЧАТЬ"}
        </button>

        {hasCharacter && character && (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/profile")}
              className="py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2 border border-neutral-700"
            >
              <img src={character.avatarUrl} alt="Avatar" className="w-5 h-5 rounded-full object-cover border border-neutral-500" />
              Профиль
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2 border border-neutral-700"
            >
              <SettingsIcon size={18} />
              Настройки
            </button>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 text-center w-full text-neutral-600 text-xs">
        v1.0.0 &copy; 2026 Bab-AI.ru
      </div>
    </motion.div>
  );
}
