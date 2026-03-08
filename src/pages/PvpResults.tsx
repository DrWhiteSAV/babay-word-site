import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";
import { motion } from "motion/react";
import { Skull, Loader2, Trophy, Crown } from "lucide-react";

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
}

export default function PvpResults() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { addFear, addWatermelons } = usePlayerStore();
  const { profile } = useTelegram();
  const tgId = profile?.telegram_id;

  const [room, setRoom] = useState<PvpRoom | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [rewardApplied, setRewardApplied] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    (async () => {
      const [{ data: roomData }, { data: membersData }] = await Promise.all([
        supabase.from("pvp_rooms").select("*").eq("id", roomId).single(),
        supabase.from("pvp_room_members").select("*").eq("room_id", roomId).order("score", { ascending: false }),
      ]);
      if (roomData) setRoom(roomData as PvpRoom);
      if (membersData) setMembers(membersData as RoomMember[]);
      setLoading(false);
    })();
  }, [roomId]);

  // Distribute rewards once
  useEffect(() => {
    if (rewardApplied || !tgId || members.length === 0) return;
    const finishedMembers = members.filter(m => m.status === "finished" || m.status === "playing");
    if (finishedMembers.length === 0) return;

    const maxScore = Math.max(...finishedMembers.map(m => m.score));
    const winners = finishedMembers.filter(m => m.score === maxScore);
    const isWinner = winners.some(w => w.telegram_id === tgId);

    if (isWinner) {
      const totalFear = finishedMembers.reduce((sum, m) => sum + (m.score || 0), 0);
      const myReward = Math.ceil(totalFear / winners.length);
      addFear(myReward);
    }

    setRewardApplied(true);
  }, [members, tgId, rewardApplied]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-red-500" />
      </div>
    );
  }

  const finishedMembers = members.filter(m => m.status === "finished" || m.status === "playing")
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  const maxScore = finishedMembers.length > 0 ? Math.max(...finishedMembers.map(m => m.score)) : 0;
  const winners = finishedMembers.filter(m => m.score === maxScore);
  const totalFear = finishedMembers.reduce((sum, m) => sum + (m.score || 0), 0);
  const isWinner = winners.some(w => w.telegram_id === tgId);
  const myReward = isWinner ? Math.ceil(totalFear / winners.length) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col bg-transparent text-white relative z-10 overflow-hidden"
    >
      {/* Hero */}
      <div className={`relative p-6 text-center border-b border-white/10 shrink-0 ${isWinner ? "bg-yellow-900/20" : "bg-red-950/30"}`}>
        {isWinner ? (
          <>
            <Trophy size={48} className="text-yellow-400 mx-auto mb-3 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]" />
            <h1 className="text-3xl font-black text-yellow-300 uppercase tracking-tighter">ПОБЕДА!</h1>
            <p className="text-yellow-200/70 text-sm mt-1">
              Вы получаете <span className="text-yellow-300 font-black">{myReward}</span> 💀 Страха
              {winners.length > 1 && ` (делите с ${winners.length - 1} союзником)`}
            </p>
          </>
        ) : (
          <>
            <Skull size={48} className="text-red-400 mx-auto mb-3" />
            <h1 className="text-3xl font-black text-red-400 uppercase tracking-tighter">ПОРАЖЕНИЕ</h1>
            <p className="text-neutral-400 text-sm mt-1">В следующий раз повезёт...</p>
          </>
        )}
        <p className="text-xs text-neutral-500 mt-2">Комната #{roomId} · {room?.difficulty}</p>
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
          const isWin = m.score === maxScore;
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
                  {isWin && <Crown size={12} className="text-yellow-400" />}
                  <span className={`font-bold text-sm truncate ${isMe ? "text-white" : "text-neutral-200"}`}>
                    {m.character_name || `Бабай #${m.telegram_id}`}
                    {isMe && <span className="text-neutral-500 text-xs ml-1">(вы)</span>}
                  </span>
                </div>
                {m.status === "timeout" && (
                  <span className="text-xs text-red-400">⏱ Не успел</span>
                )}
              </div>
              <div className="text-right">
                <div className="font-black text-red-400 flex items-center gap-1 justify-end">
                  <Skull size={12} />{m.score}
                </div>
                {isWin && (
                  <div className="text-xs text-yellow-400 font-bold">
                    +{Math.ceil(totalFear / winners.length)} 💀
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Timeout members */}
        {members.filter(m => m.status === "timeout" || m.status === "invited").map(m => (
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
            <span className="text-xs text-neutral-600">Не участвовал</span>
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
