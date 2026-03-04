import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { motion } from "motion/react";
import { Trophy, CheckCircle2, Loader2, Star } from "lucide-react";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";

interface AchievementRow {
  id: string;
  key: string;
  title: string;
  description: string | null;
  icon: string | null;
  condition_type: string;
  condition_value: number | null;
  reward_fear: number | null;
  reward_watermelons: number | null;
  is_active: boolean;
}

export default function Achievements() {
  const { profile } = useTelegram();
  const store = usePlayerStore();
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [profile?.telegram_id]);

  const load = async () => {
    setLoading(true);
    const { data: achs } = await supabase.from("achievements").select("*").eq("is_active", true);
    setAchievements(achs || []);

    if (profile?.telegram_id) {
      const { data: pa } = await supabase
        .from("player_achievements")
        .select("achievement_id")
        .eq("telegram_id", profile.telegram_id);
      setUnlockedIds(new Set((pa || []).map(p => p.achievement_id)));
    }
    setLoading(false);
  };

  const getProgress = (ach: AchievementRow): { current: number; target: number } => {
    const target = ach.condition_value || 1;
    let current = 0;
    switch (ach.condition_type) {
      case 'fear': current = store.fear; break;
      case 'watermelons': current = store.watermelons; break;
      case 'telekinesis': current = store.character?.telekinesisLevel || 0; break;
      case 'boss_level': current = store.bossLevel; break;
      case 'friends': current = store.friends.length; break;
    }
    return { current: Math.min(current, target), target };
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <Header
        title={<><Trophy size={20} className="text-yellow-500" /> Достижения</>}
        backUrl="/leaderboard"
      />

      <div className="flex-1 overflow-y-auto p-4 relative z-10">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-red-500" /></div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-neutral-400 mb-2">
              <CheckCircle2 size={14} className="text-green-400" />
              <span>{unlockedIds.size}/{achievements.length} разблокировано</span>
            </div>
            {achievements.map(ach => {
              const unlocked = unlockedIds.has(ach.id);
              const { current, target } = getProgress(ach);
              const percent = Math.min(100, (current / target) * 100);
              return (
                <div
                  key={ach.id}
                  className={`bg-neutral-900 border rounded-2xl p-4 transition-all ${unlocked ? 'border-yellow-500/50' : 'border-neutral-800'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 ${unlocked ? 'bg-yellow-900/40 border border-yellow-500/30' : 'bg-neutral-800 grayscale opacity-60'}`}>
                      {ach.icon || '🏆'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-bold text-sm ${unlocked ? 'text-yellow-300' : 'text-neutral-300'}`}>{ach.title}</h3>
                        {unlocked && <CheckCircle2 size={14} className="text-green-400 shrink-0" />}
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">{ach.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 bg-neutral-950 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${unlocked ? 'bg-yellow-500' : 'bg-neutral-600'}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-neutral-500 font-mono shrink-0">{current}/{target}</span>
                      </div>
                      {(ach.reward_fear || ach.reward_watermelons) && (
                        <p className="text-[10px] text-yellow-500 mt-1">
                          Награда: {ach.reward_fear ? `+${ach.reward_fear}👻` : ''} {ach.reward_watermelons ? `+${ach.reward_watermelons}🍉` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
