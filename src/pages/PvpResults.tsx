import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";
import { motion } from "motion/react";
import { Skull, Loader2, Trophy, Crown, Timer } from "lucide-react";

interface RoomMember {
  telegram_id: number;
  character_name: string | null;
  avatar_url: string | null;
  status: string;
  score: number;
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
  const { addFear } = usePlayerStore();
  const { profile } = useTelegram();
  const tgId = profile?.telegram_id;

  const [room, setRoom] = useState<PvpRoom | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const rewardAppliedRef = useRef(false);

  const timerLeft = useCountdown(room?.timer_ends_at ?? null);

  // Load data + subscribe to realtime updates (members finishing)
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

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  // When timer hits 0 → finalize room + distribute rewards
  useEffect(() => {
    if (timerLeft !== 0 || !room || !tgId || rewardAppliedRef.current) return;
    if (members.length === 0) return;

    rewardAppliedRef.current = true;

    const finishedMembers = members.filter(m => m.status === "finished");
    if (finishedMembers.length === 0) return;

    const maxScore = Math.max(...finishedMembers.map(m => m.score));
    if (maxScore === 0) return;

    const winners = finishedMembers.filter(m => m.score === maxScore);
    const totalFear = finishedMembers.reduce((sum, m) => sum + (m.score || 0), 0);
    const isWinner = winners.some(w => w.telegram_id === tgId);

    if (isWinner) {
      const myReward = Math.ceil(totalFear / winners.length);
      console.log(`[DB WRITE] 📝 PVP reward: tgId=${tgId}, reward=${myReward} fear`);
      addFear(myReward);
    }

    // Mark room as fully finished
    supabase.from("pvp_rooms").update({ status: "finished" }).eq("id", room.id);
  }, [timerLeft, room, members, tgId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-red-500" />
      </div>
    );
  }

  const allFinished = members.filter(m => m.status === "finished");
  const finishedMembers = [...allFinished].sort((a, b) => (b.score || 0) - (a.score || 0));
  const maxScore = finishedMembers.length > 0 ? Math.max(...finishedMembers.map(m => m.score)) : 0;
  const winners = maxScore > 0 ? finishedMembers.filter(m => m.score === maxScore) : [];
  const totalFear = finishedMembers.reduce((sum, m) => sum + (m.score || 0), 0);
  const isWinner = winners.some(w => w.telegram_id === tgId);
  const myReward = isWinner ? Math.ceil(totalFear / winners.length) : 0;

  // Timer still running — waiting for others to finish
  const timerRunning = timerLeft !== null && timerLeft > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col bg-transparent text-white relative z-10 overflow-hidden"
    >
      {/* Hero */}
      <div className={`relative p-6 text-center border-b border-white/10 shrink-0 ${isWinner ? "bg-yellow-900/20" : "bg-red-950/30"}`}>
        {timerRunning ? (
          <>
            <Timer size={48} className="text-orange-400 mx-auto mb-3 drop-shadow-[0_0_20px_rgba(251,146,60,0.5)]" />
            <h1 className="text-2xl font-black text-orange-300 uppercase tracking-tighter">ЖДЁМ ОСТАЛЬНЫХ</h1>
            <p className="text-orange-200/70 text-sm mt-1">
              До начисления наград: <span className="font-black text-orange-300">{fmtTime(timerLeft)}</span>
            </p>
            <p className="text-xs text-neutral-500 mt-1">Комната #{roomId} · {room?.difficulty}</p>
          </>
        ) : isWinner ? (
          <>
            <Trophy size={48} className="text-yellow-400 mx-auto mb-3 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]" />
            <h1 className="text-3xl font-black text-yellow-300 uppercase tracking-tighter">ПОБЕДА!</h1>
            <p className="text-yellow-200/70 text-sm mt-1">
              Вы получили <span className="text-yellow-300 font-black">{myReward}</span> 💀 Страха
              {winners.length > 1 && ` (делите с ${winners.length - 1} союзником)`}
            </p>
            <p className="text-xs text-neutral-500 mt-2">Комната #{roomId} · {room?.difficulty}</p>
          </>
        ) : (
          <>
            <Skull size={48} className="text-red-400 mx-auto mb-3" />
            <h1 className="text-3xl font-black text-red-400 uppercase tracking-tighter">ПОРАЖЕНИЕ</h1>
            <p className="text-neutral-400 text-sm mt-1">В следующий раз повезёт...</p>
            <p className="text-xs text-neutral-500 mt-2">Комната #{roomId} · {room?.difficulty}</p>
          </>
        )}
      </div>

      {/* Leaderboard */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500 font-bold mb-2">Итоговая таблица</h2>

        {/* Bank */}
        <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl flex justify-between items-center mb-2">
          <span className="text-neutral-400 text-sm">Общий банк</span>
          <span className="font-black text-red-400 flex items-center gap-1.5">
            <Skull size={14} />{totalFear} Страха
          </span>
        </div>

        {finishedMembers.map((m, idx) => {
          const isMe = m.telegram_id === tgId;
          const isWin = maxScore > 0 && m.score === maxScore;
          return (
            <motion.div
              key={m.telegram_id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex items-center gap-3 p-3 rounded-xl border ${
                isMe
                  ? isWin ? "bg-yellow-900/30 border-yellow-700" : "bg-red-900/20 border-red-900"
                  : "bg-neutral-900/60 border-neutral-800"
              }`}
            >
              <div className="w-7 h-7 flex items-center justify-center font-black text-lg">
                {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`}
              </div>
              <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-800 shrink-0">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-base">👻</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {isWin && !timerRunning && <Crown size={12} className="text-yellow-400" />}
                  <span className={`font-bold text-sm truncate ${isMe ? "text-white" : "text-neutral-200"}`}>
                    {m.character_name || `Бабай #${m.telegram_id}`}
                    {isMe && <span className="text-neutral-500 text-xs ml-1">(вы)</span>}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-red-400 flex items-center gap-1 justify-end">
                  <Skull size={12} />{m.score}
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

        {/* Timeout / not finished members */}
        {members.filter(m => m.status === "timeout" || m.status === "invited" || m.status === "playing").map(m => (
          <div
            key={m.telegram_id}
            className="flex items-center gap-3 p-3 rounded-xl border bg-neutral-900/30 border-neutral-800 opacity-50"
          >
            <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-800 shrink-0">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-base">👻</div>
              )}
            </div>
            <span className="flex-1 text-neutral-500 text-sm font-bold">
              {m.character_name || `Бабай #${m.telegram_id}`}
            </span>
            <span className="text-xs text-neutral-600">
              {m.status === "playing" ? "⏳ Ещё играет" : "⏱ Не успел"}
            </span>
          </div>
        ))}
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
