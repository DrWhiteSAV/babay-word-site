import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Swords, Crown, Timer, Users, ChevronRight, Clock, XCircle } from "lucide-react";
import { PvpLobbyData } from "../hooks/usePvpLobby";
import { useTelegram } from "../context/TelegramContext";
import { useState, useEffect } from "react";
import { supabase } from "../integrations/supabase/client";

interface Props {
  lobby: PvpLobbyData;
  onDeclined?: () => void;
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

const statusLabel = (s: string) => {
  if (s === "finished") return { text: "✓ Финиш", cls: "text-green-400" };
  if (s === "playing") return { text: "🎮 Играет", cls: "text-blue-400" };
  if (s === "timeout") return { text: "⏱ Время вышло", cls: "text-neutral-500" };
  if (s === "invited") return { text: "📨 Приглашён", cls: "text-yellow-400" };
  if (s === "declined") return { text: "❌ Отклонён", cls: "text-red-400" };
  return { text: "⏳ Ждёт", cls: "text-neutral-400" };
};

export default function PvpLobbyBanner({ lobby, onDeclined }: Props) {
  const navigate = useNavigate();
  const { profile } = useTelegram();
  const tgId = profile?.telegram_id;
  const { room, members, myStatus } = lobby;
  const countdown = useCountdown(room.timer_ends_at);
  const [declining, setDeclining] = useState(false);
  const [declined, setDeclined] = useState(false);

  const isOrganizer = !!(tgId && room.organizer_telegram_id === tgId);
  const joinedMembers = members.filter(m => m.status !== "invited" && m.status !== "declined");
  const finishedCount = members.filter(m => m.status === "finished" || m.status === "timeout").length;

  const roomStatus =
    room.status === "waiting" ? { text: "Ожидание", cls: "bg-yellow-900/60 text-yellow-400" } :
    room.status === "playing" ? { text: "Идёт игра", cls: "bg-green-900/60 text-green-400" } :
    { text: "Завершено", cls: "bg-neutral-800 text-neutral-400" };

  const handleDecline = async () => {
    if (!tgId || declining) return;
    setDeclining(true);
    // Remove self from room members (or update status to declined)
    await supabase.from("pvp_room_members")
      .update({ status: "declined" })
      .eq("room_id", room.id)
      .eq("telegram_id", tgId);
    setDeclined(true);
    setDeclining(false);
    onDeclined?.();
  };

  if (declined) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="w-full rounded-2xl border border-red-900/50 bg-red-950/30 backdrop-blur-sm overflow-hidden"
      >
        {/* Header row */}
        <button
          onClick={() => navigate(`/pvp/room/${room.id}`)}
          className="w-full flex items-center gap-3 px-4 pt-3 pb-2 hover:bg-red-900/20 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-red-900/50 flex items-center justify-center shrink-0">
            <Swords size={18} className="text-red-400" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2">
              <p className="font-black text-white text-sm">
                PVP Бабаев
                {isOrganizer && <Crown size={11} className="inline ml-1 text-yellow-400" />}
              </p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${roomStatus.cls}`}>
                {roomStatus.text}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              {room.difficulty} · {joinedMembers.length} участника · #{room.id}
            </p>
          </div>
          <ChevronRight size={16} className="text-neutral-500 shrink-0" />
        </button>

        {/* Timer banner */}
        {countdown !== null && countdown > 0 && (
          <div className="mx-3 mb-2 px-3 py-1.5 bg-orange-900/30 border border-orange-700/50 rounded-xl flex items-center gap-2">
            <Timer size={14} className="text-orange-400 shrink-0" />
            <span className="text-xs text-orange-300">
              Таймер: <span className="font-black">{fmtTime(countdown)}</span>
            </span>
          </div>
        )}

        {/* Members strip */}
        <div className="px-4 pb-3 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Users size={12} className="text-neutral-500" />
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">
              Участники ({joinedMembers.length})
            </span>
            {room.status === "playing" && (
              <span className="text-[10px] text-neutral-600 ml-auto">
                {finishedCount}/{joinedMembers.length} финишировали
              </span>
            )}
          </div>
          {joinedMembers.map(m => {
            const lbl = statusLabel(m.status);
            const isMe = m.telegram_id === tgId;
            return (
              <div key={m.telegram_id} className={`flex items-center gap-2 p-2 rounded-xl ${isMe ? "bg-red-900/20 border border-red-900/40" : "bg-neutral-900/40"}`}>
                <div className="w-7 h-7 rounded-full overflow-hidden bg-neutral-800 shrink-0">
                  {m.avatar_url
                    ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-sm">👻</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {m.character_name || `Бабай #${m.telegram_id}`}
                    {isMe && <span className="text-neutral-500 text-[10px] ml-1">(вы)</span>}
                    {m.telegram_id === room.organizer_telegram_id && (
                      <Crown size={9} className="inline ml-1 text-yellow-400" />
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.score > 0 && (
                    <span className="text-[10px] text-red-400 font-bold">💀 {m.score}</span>
                  )}
                  <span className={`text-[10px] font-bold ${lbl.cls}`}>{lbl.text}</span>
                </div>
              </div>
            );
          })}

          {/* CTA */}
          {myStatus === "invited" && room.status === "waiting" && (
            <div className="space-y-2 mt-1">
              <button
                onClick={() => navigate(`/pvp/room/${room.id}?join=1`)}
                className="w-full py-2.5 bg-red-700 hover:bg-red-600 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(220,38,38,0.3)]"
              >
                <Swords size={14} /> Принять вызов
              </button>
              <button
                onClick={handleDecline}
                disabled={declining}
                className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-bold text-sm text-neutral-400 flex items-center justify-center gap-2"
              >
                <XCircle size={14} /> {declining ? "Отклоняю..." : "Отклонить"}
              </button>
            </div>
          )}
          {myStatus === "playing" && room.status === "playing" && (
            <div className="space-y-2 mt-1">
              <button
                onClick={() => navigate(`/pvp/room/${room.id}`)}
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2"
              >
                🎮 Перейти в лобби
              </button>
              <button
                onClick={handleDecline}
                disabled={declining}
                className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-bold text-sm text-neutral-400 flex items-center justify-center gap-2"
              >
                <XCircle size={14} /> {isOrganizer ? (declining ? "Отмена..." : "Отменить игру") : (declining ? "Выхожу..." : "Выйти из игры")}
              </button>
            </div>
          )}
          {room.status === "finished" && (
            <button
              onClick={() => navigate(`/pvp/results/${room.id}`)}
              className="w-full mt-1 py-2.5 bg-yellow-700/80 hover:bg-yellow-600/80 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2"
            >
              🏆 Смотреть результаты
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
