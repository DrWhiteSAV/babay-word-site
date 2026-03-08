import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";
import { motion, AnimatePresence } from "motion/react";
import { Skull, Loader2, Trophy, Crown, Timer } from "lucide-react";

interface RoomMember {
  telegram_id: number;
  character_name: string | null;
  avatar_url: string | null;
  status: string;
  score: number;
  watermelons: number;
  finished_at: string | null;
}

interface PvpRoom {
  id: string;
  organizer_telegram_id: number;
  difficulty: string;
  status: string;
  timer_ends_at: string | null;
}

function useCountdown(endsAt: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) { setLeft(null); return; }
    const tick = () => {
      const ms = new Date(endsAt).getTime() - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return left;
}

const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

export default function PvpResults() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { addFear, addWatermelons } = usePlayerStore();
  const { profile } = useTelegram();
  const tgId = profile?.telegram_id;

  const [room, setRoom] = useState<PvpRoom | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const rewardAppliedRef = useRef(false);

  const timerLeft = useCountdown(room?.timer_ends_at ?? null);

  // Load data + subscribe to realtime updates
  useEffect(() => {
    if (!roomId) return;
    const fetchData = async () => {
      const [{ data: roomData }, { data: membersData }] = await Promise.all([
        supabase.from("pvp_rooms").select("*").eq("id", roomId).single(),
        supabase.from("pvp_room_members").select("*").eq("room_id", roomId).order("score", { ascending: false }),
      ]);
      if (roomData) setRoom(roomData as PvpRoom);
      if (membersData) setMembers(membersData as RoomMember[]);
      setLoading(false);
    };
    fetchData();

    const channel = supabase
      .channel(`pvp-results-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pvp_room_members", filter: `room_id=eq.${roomId}` }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "pvp_rooms", filter: `id=eq.${roomId}` }, fetchData)
      .subscribe();

    // Poll every 5s as fallback
    const poll = setInterval(fetchData, 5000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [roomId]);

  // Determine if all active players have finished (timer ran out OR everyone done)
  const activePlayers = members.filter(m => m.status !== "invited");
  const stillPlaying = members.filter(m => m.status === "playing");
  const timerRunning = timerLeft !== null && timerLeft > 0;
  // Results are final when timer hit 0 OR no one is still playing
  const resultsFinalized = !timerRunning && (timerLeft === 0 || stillPlaying.length === 0);

  // Compute leaderboard from ALL active players (finished + timeout), sorted by score desc
  const rankedMembers = [...activePlayers]
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  const finishedMembers = rankedMembers.filter(m => m.status === "finished");
  const maxScore = finishedMembers.length > 0 ? Math.max(...finishedMembers.map(m => m.score)) : 0;
  const winners = resultsFinalized && maxScore > 0 ? finishedMembers.filter(m => m.score === maxScore) : [];
  const totalFear = finishedMembers.reduce((sum, m) => sum + (m.score || 0), 0);
  const totalWatermelons = finishedMembers.reduce((sum, m) => sum + (m.watermelons || 0), 0);
  const isWinner = winners.some(w => w.telegram_id === tgId);
  const myFearReward = isWinner ? Math.ceil(totalFear / winners.length) : 0;
  const myWatermelonReward = isWinner ? Math.ceil(totalWatermelons / winners.length) : 0;

  // When results finalized → distribute rewards (fear + watermelons)
  useEffect(() => {
    if (!resultsFinalized || !room || !tgId || rewardAppliedRef.current) return;
    if (members.length === 0) return;

    rewardAppliedRef.current = true;

    const finished = members.filter(m => m.status === "finished");
    if (finished.length === 0) return;

    const mxScore = Math.max(...finished.map(m => m.score));
    if (mxScore === 0) return;

    const ws = finished.filter(m => m.score === mxScore);
    const totalF = finished.reduce((sum, m) => sum + (m.score || 0), 0);
    const totalW = finished.reduce((sum, m) => sum + (m.watermelons || 0), 0);
    const iWin = ws.some(w => w.telegram_id === tgId);

    if (iWin) {
      const fearReward = Math.ceil(totalF / ws.length);
      const watermelonReward = Math.ceil(totalW / ws.length);
      console.log(`[DB WRITE] 📝 PVP reward: tgId=${tgId}, fear=${fearReward}, watermelons=${watermelonReward}`);
      addFear(fearReward);
      if (watermelonReward > 0) addWatermelons(watermelonReward);
    }

    supabase.from("pvp_rooms").update({ status: "finished" }).eq("id", room.id);
  }, [resultsFinalized, room, members, tgId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col bg-transparent text-white relative z-10 overflow-hidden"
    >
      {/* Hero banner */}
      <AnimatePresence mode="wait">
        {timerRunning ? (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative p-6 text-center border-b border-white/10 shrink-0 bg-orange-950/30"
          >
            <Timer size={44} className="text-orange-400 mx-auto mb-2 drop-shadow-[0_0_20px_rgba(251,146,60,0.5)]" />
            <h1 className="text-2xl font-black text-orange-300 uppercase tracking-tighter">ЖДЁМ ОСТАЛЬНЫХ</h1>
            <p className="text-orange-200/70 text-sm mt-1">
              До финала: <span className="font-black text-orange-300 text-lg">{fmtTime(timerLeft)}</span>
            </p>
            <p className="text-xs text-neutral-500 mt-1">Комната #{roomId} · {room?.difficulty}</p>
          </motion.div>
        ) : isWinner ? (
          <motion.div
            key="win"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative p-6 text-center border-b border-white/10 shrink-0 bg-yellow-900/20"
          >
            <Trophy size={48} className="text-yellow-400 mx-auto mb-3 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]" />
            <h1 className="text-3xl font-black text-yellow-300 uppercase tracking-tighter">ПОБЕДА!</h1>
            <p className="text-yellow-200/70 text-sm mt-1">
              Вы получили <span className="text-yellow-300 font-black">{myFearReward}</span> 💀 Страха
              {myWatermelonReward > 0 && <> и <span className="text-green-300 font-black">{myWatermelonReward}</span> 🍉 Арбузов</>}
              {winners.length > 1 && ` (делите с ${winners.length - 1} союзником)`}
            </p>
            <p className="text-xs text-neutral-500 mt-2">Комната #{roomId} · {room?.difficulty}</p>
          </motion.div>
        ) : (
          <motion.div
            key="lose"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative p-6 text-center border-b border-white/10 shrink-0 bg-red-950/30"
          >
            <Skull size={48} className="text-red-400 mx-auto mb-3" />
            <h1 className="text-3xl font-black text-red-400 uppercase tracking-tighter">ПОРАЖЕНИЕ</h1>
            <p className="text-neutral-400 text-sm mt-1">В следующий раз повезёт...</p>
            <p className="text-xs text-neutral-500 mt-2">Комната #{roomId} · {room?.difficulty}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs uppercase tracking-widest text-neutral-500 font-bold">
            {timerRunning ? "Промежуточные результаты" : "Итоговая таблица"}
          </h2>
          {timerRunning && (
            <span className="text-xs text-neutral-600">
              {stillPlaying.length > 0 ? `${stillPlaying.length} ещё играют` : "Все завершили"}
            </span>
          )}
        </div>

        {/* Bank */}
        <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl flex justify-between items-center">
          <span className="text-neutral-400 text-sm">Общий банк</span>
          <div className="flex items-center gap-3">
            <span className="font-black text-red-400 flex items-center gap-1">
              <Skull size={14} />{totalFear}
            </span>
            {totalWatermelons > 0 && (
              <span className="font-black text-green-400 flex items-center gap-1">
                🍉{totalWatermelons}
              </span>
            )}
          </div>
        </div>

        {/* All ranked members */}
        {rankedMembers.map((m, idx) => {
          const isMe = m.telegram_id === tgId;
          const isWin = resultsFinalized && maxScore > 0 && m.score === maxScore && m.status === "finished";
          const isStillPlaying = m.status === "playing";
          const didTimeout = m.status === "timeout";

          return (
            <motion.div
              key={m.telegram_id}
              layout
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={`flex items-center gap-3 p-3 rounded-xl border ${
                isWin
                  ? "bg-yellow-900/30 border-yellow-700"
                  : isMe
                  ? "bg-red-900/20 border-red-900"
                  : isStillPlaying
                  ? "bg-blue-950/20 border-blue-900/40"
                  : didTimeout
                  ? "bg-neutral-900/30 border-neutral-800 opacity-60"
                  : "bg-neutral-900/60 border-neutral-800"
              }`}
            >
              {/* Rank */}
              <div className="w-7 h-7 flex items-center justify-center font-black text-lg shrink-0">
                {isStillPlaying
                  ? <Loader2 size={16} className="animate-spin text-blue-400" />
                  : idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`}
              </div>

              {/* Avatar */}
              <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-800 shrink-0">
                {m.avatar_url
                  ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-base">👻</div>
                }
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {isWin && <Crown size={12} className="text-yellow-400 shrink-0" />}
                  <span className={`font-bold text-sm truncate ${isMe ? "text-white" : "text-neutral-200"}`}>
                    {m.character_name || `Бабай #${m.telegram_id}`}
                    {isMe && <span className="text-neutral-500 text-xs ml-1">(вы)</span>}
                  </span>
                </div>
                <div className="text-[10px] mt-0.5">
                  {isStillPlaying && <span className="text-blue-400">⏳ Ещё играет</span>}
                  {didTimeout && <span className="text-neutral-500">⏱ Не успел</span>}
                  {m.status === "finished" && !timerRunning && isWin && (
                    <span className="text-yellow-400 font-bold">+{Math.ceil(totalFear / winners.length)} 💀 к счёту</span>
                  )}
                </div>
              </div>

              {/* Score — always visible */}
              <div className="text-right shrink-0">
                <div className={`font-black flex items-center gap-1 justify-end ${
                  isStillPlaying ? "text-neutral-500" : "text-red-400"
                }`}>
                  <Skull size={12} />
                  {isStillPlaying ? "—" : m.score}
                </div>
                {isWin && !timerRunning && (
                  <div className="text-xs text-yellow-400 font-bold">
                    +{Math.ceil(totalFear / winners.length)} 💀
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="p-4 bg-black/20 backdrop-blur-lg border-t border-white/10 shrink-0">
        <button
          onClick={() => navigate("/hub")}
          className="w-full py-4 bg-red-700 hover:bg-red-600 rounded-xl font-black text-lg uppercase tracking-wider transition-colors"
        >
          В Главное Меню
        </button>
      </div>
    </motion.div>
  );
}
