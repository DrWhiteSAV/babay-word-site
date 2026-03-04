import { useEffect, useRef } from "react";
import { usePlayerStore } from "../store/playerStore";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";
import { pushNotification } from "../components/NotificationPopup";

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
}

export function useAchievements() {
  const store = usePlayerStore();
  const { profile } = useTelegram();
  const checkedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!profile?.telegram_id) return;

    const checkAchievements = async () => {
      const { data: allAchs } = await supabase.from("achievements").select("*").eq("is_active", true);
      const { data: unlocked } = await supabase
        .from("player_achievements")
        .select("achievement_id")
        .eq("telegram_id", profile.telegram_id);

      if (!allAchs) return;
      const unlockedIds = new Set((unlocked || []).map(u => u.achievement_id));

      for (const ach of allAchs as AchievementRow[]) {
        if (unlockedIds.has(ach.id) || checkedRef.current.has(ach.key)) continue;

        let met = false;
        const val = ach.condition_value || 0;
        switch (ach.condition_type) {
          case 'fear': met = store.fear >= val; break;
          case 'watermelons': met = store.watermelons >= val; break;
          case 'telekinesis': met = (store.character?.telekinesisLevel || 0) >= val; break;
          case 'boss_level': met = store.bossLevel >= val; break;
          case 'friends': met = store.friends.length >= val; break;
          default: break;
        }

        if (met) {
          checkedRef.current.add(ach.key);
          // Save to DB
          await supabase.from("player_achievements").insert({
            telegram_id: profile.telegram_id,
            achievement_id: ach.id,
          }).then(() => {});

          // Give rewards
          if (ach.reward_fear) store.addFear(ach.reward_fear);
          if (ach.reward_watermelons) store.addWatermelons(ach.reward_watermelons);
          store.addAchievement(ach.key);

          // Show popup
          pushNotification({
            type: 'achievement',
            title: `🏆 Достижение разблокировано!`,
            message: `${ach.title}: ${ach.description || ''}`,
            icon: ach.icon || '🏆',
            reward: [
              ach.reward_fear ? `+${ach.reward_fear} страха` : '',
              ach.reward_watermelons ? `+${ach.reward_watermelons} арбузов` : '',
            ].filter(Boolean).join(', ') || undefined,
          });
        }
      }
    };

    const interval = setInterval(checkAchievements, 10000);
    checkAchievements();
    return () => clearInterval(interval);
  }, [
    profile?.telegram_id,
    store.fear,
    store.watermelons,
    store.bossLevel,
    store.friends.length,
    store.character?.telekinesisLevel,
  ]);
}
