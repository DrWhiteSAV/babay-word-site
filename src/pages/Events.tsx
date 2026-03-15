import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { motion } from "motion/react";
import { Target, Star, CheckCircle2, Clock, Loader2, Trophy } from "lucide-react";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";
import { pushNotification } from "../components/NotificationPopup";

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  icon: string | null;
  reward_fear: number | null;
  reward_energy: number | null;
  reward_watermelons: number | null;
  is_active: boolean;
  end_at: string | null;
  target: number;
}

interface PlayerEvent {
  id: string;
  event_id: string;
  status: string;
  progress: number;
  target: number;
}

function useCountdown(endAt: string | null) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!endAt) {
      const update = () => {
        const now = new Date();
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        const diff = midnight.getTime() - now.getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${h}ч ${m}м ${s}с`);
      };
      update();
      const t = setInterval(update, 1000);
      return () => clearInterval(t);
    } else {
      const update = () => {
        const diff = new Date(endAt).getTime() - Date.now();
        if (diff <= 0) { setTimeLeft("Завершён"); return; }
        const days = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        setTimeLeft(`${days}д ${h}ч ${m}м`);
      };
      update();
      const t = setInterval(update, 60000);
      return () => clearInterval(t);
    }
  }, [endAt]);
  return timeLeft;
}

function EventCard({
  event, playerEvent, globalProgress, onComplete,
}: {
  event: EventRow;
  playerEvent?: PlayerEvent;
  globalProgress?: number;
  onComplete: (eventId: string) => void;
}) {
  const countdown = useCountdown(event.event_type === 'global' ? event.end_at : null);
  const isGlobal = event.event_type === 'global';
  
  // For global events: use sum of all users' progress
  // For daily events: use player's own progress
  const progress = isGlobal ? (globalProgress ?? 0) : (playerEvent?.progress ?? 0);
  const target = event.target || 1;
  const completed = playerEvent?.status === 'completed';
  const isReady = !completed && progress >= target;

  const rewardText = [
    event.reward_fear ? `+${event.reward_fear} 👻` : '',
    event.reward_energy ? `+${event.reward_energy} ⚡` : '',
    event.reward_watermelons ? `+${event.reward_watermelons} 🍉` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={`bg-neutral-900 border rounded-2xl p-4 transition-all ${completed ? 'border-green-900/50 opacity-60' : isReady ? 'border-red-500' : 'border-neutral-800'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{event.icon || '🎯'}</span>
          <div>
            <h3 className="font-bold text-white text-sm">{event.title}</h3>
            <p className="text-xs text-neutral-400 mt-0.5">{event.description}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs font-bold text-yellow-400">{rewardText}</span>
          <div className="flex items-center gap-1 mt-1 text-neutral-500 text-[10px]">
            <Clock size={10} />
            <span>{countdown}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 bg-neutral-950 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${completed ? 'bg-green-500' : 'bg-red-600'}`}
            style={{ width: `${Math.min(100, (progress / target) * 100)}%` }}
          />
        </div>
        <span className="text-xs font-mono text-neutral-500 shrink-0">{progress}/{target}</span>
      </div>

      {isGlobal && !completed && (
        <p className="text-[10px] text-neutral-600 mt-1">Общий прогресс всех игроков</p>
      )}

      {completed && (
        <div className="mt-3 flex items-center gap-2 text-green-400 text-xs font-bold">
          <CheckCircle2 size={14} /> Выполнено!
        </div>
      )}

      {isReady && (
        <button
          onClick={() => onComplete(event.id)}
          className="mt-3 w-full py-2 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-colors"
        >
          Забрать награду
        </button>
      )}
    </div>
  );
}

export default function Events() {
  const navigate = useNavigate();
  const { addFear, addEnergy, addWatermelons } = usePlayerStore();
  const { profile } = useTelegram();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [playerEvents, setPlayerEvents] = useState<PlayerEvent[]>([]);
  const [globalProgresses, setGlobalProgresses] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
    // Poll global progress every 10s
    const interval = setInterval(loadGlobalProgress, 10000);
    return () => clearInterval(interval);
  }, [profile?.telegram_id]);

  const loadGlobalProgress = async () => {
    // For global events, sum all players' progress
    const { data } = await supabase
      .from("player_events")
      .select("event_id, progress");
    if (!data) return;
    const sums: Record<string, number> = {};
    data.forEach(row => {
      sums[row.event_id] = (sums[row.event_id] || 0) + (row.progress || 0);
    });
    setGlobalProgresses(sums);
  };

  const loadEvents = async () => {
    setLoading(true);
    const { data: evts } = await supabase.from("events").select("*").eq("is_active", true).order("created_at");
    setEvents((evts || []) as EventRow[]);

    if (profile?.telegram_id && evts) {
      const dailyEvts = evts.filter(e => e.event_type === 'daily');
      for (const evt of dailyEvts) {
        await supabase.from("player_events").upsert({
          telegram_id: profile.telegram_id,
          event_id: evt.id,
          status: 'assigned',
          target: evt.target || 1,
        }, { onConflict: "telegram_id,event_id", ignoreDuplicates: true }).then(() => {});
      }
      // Also ensure global events have player_events records so they can be claimed
      const globalEvts = evts.filter(e => e.event_type === 'global');
      for (const evt of globalEvts) {
        await supabase.from("player_events").upsert({
          telegram_id: profile.telegram_id,
          event_id: evt.id,
          status: 'assigned',
          target: evt.target || 1,
        }, { onConflict: "telegram_id,event_id", ignoreDuplicates: true }).then(() => {});
      }

      const { data: pe } = await supabase
        .from("player_events")
        .select("*")
        .eq("telegram_id", profile.telegram_id);
      setPlayerEvents((pe || []) as any);
    }
    await loadGlobalProgress();
    setLoading(false);
  };

  const handleComplete = async (eventId: string) => {
    if (!profile?.telegram_id) return;
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    if (event.reward_fear) addFear(event.reward_fear);
    if (event.reward_energy) addEnergy(event.reward_energy);
    if (event.reward_watermelons) addWatermelons(event.reward_watermelons);

    await supabase.from("player_events")
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq("telegram_id", profile.telegram_id)
      .eq("event_id", eventId);

    pushNotification({
      type: 'event',
      title: '🎯 Эвент выполнен!',
      message: event.title,
      icon: event.icon || '🎯',
      reward: [
        event.reward_fear ? `+${event.reward_fear} страха` : '',
        event.reward_energy ? `+${event.reward_energy} энергии` : '',
        event.reward_watermelons ? `+${event.reward_watermelons} арбузов` : '',
      ].filter(Boolean).join(', ') || undefined,
    });

    loadEvents();
  };

  const dailyEvents = events.filter(e => e.event_type === 'daily');
  const globalEvents = events.filter(e => e.event_type === 'global');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <Header
        title={<><Target size={20} className="text-red-500" /> Ивенты и Задания</>}
        backUrl="/leaderboard"
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-8 relative z-10">

        <section className="bg-neutral-900/80 backdrop-blur-md p-4 rounded-2xl border border-neutral-800">
          <h2 className="text-sm font-bold mb-2 text-white">О заданиях</h2>
          <p className="text-xs text-neutral-400">
            Выполняйте ежедневные и глобальные задания, чтобы получать бонусы:
            <br />• <span className="text-red-400">Страх</span> — для прокачки телекинеза и покупки инвентаря.
            <br />• <span className="text-yellow-400">Энергия</span> — для выполнения действий в игре.
            <br />• <span className="text-green-400">Арбузы</span> — для повышения уровня босса.
          </p>
        </section>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-red-500" /></div>
        ) : (
          <>
            <section>
              <h2 className="text-base font-bold text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                <Target size={18} className="text-red-500" /> Ежедневные эвенты
                <span className="text-xs text-neutral-500 font-normal normal-case">— сбрасываются в полночь</span>
              </h2>
              <div className="space-y-3">
                {dailyEvents.map(evt => (
                  <EventCard
                    key={evt.id}
                    event={evt}
                    playerEvent={playerEvents.find(pe => pe.event_id === evt.id)}
                    onComplete={handleComplete}
                  />
                ))}
                {dailyEvents.length === 0 && <p className="text-neutral-500 text-center py-4">Нет активных ежедневных эвентов</p>}
              </div>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                <Star size={18} className="text-blue-400" /> Глобальные эвенты
              </h2>
              <div className="space-y-3">
                {globalEvents.map(evt => (
                  <EventCard
                    key={evt.id}
                    event={evt}
                    playerEvent={playerEvents.find(pe => pe.event_id === evt.id)}
                    globalProgress={globalProgresses[evt.id]}
                    onComplete={handleComplete}
                  />
                ))}
                {globalEvents.length === 0 && <p className="text-neutral-500 text-center py-4">Нет активных глобальных эвентов</p>}
              </div>
            </section>
          </>
        )}
      </div>
    </motion.div>
  );
}
