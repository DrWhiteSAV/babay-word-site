import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";
import { protalkGenerateText } from "../services/protalk";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Loader2, Swords, Users, Clock, Crown, Timer, Send, Wifi, WifiOff, RefreshCw, Check, AlertTriangle } from "lucide-react";

interface RoomMember {
  telegram_id: number;
  character_name: string | null;
  avatar_url: string | null;
  status: string;
  score: number;
  finished_at: string | null;
  joined_at: string;
}

interface PvpRoom {
  id: string;
  organizer_telegram_id: number;
  difficulty: string;
  status: string;
  started_at: string | null;
  timer_ends_at: string | null;
}

interface ChatMsg {
  id: string;
  telegram_id: number;
  sender_name: string;
  text: string;
  created_at: string;
}

export default function PvpRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const autoJoin = searchParams.get("join") === "1";
  const navigate = useNavigate();
  const { character, useEnergy } = usePlayerStore();
  const { profile } = useTelegram();
  const tgId = profile?.telegram_id;

  const [room, setRoom] = useState<PvpRoom | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [timerLeft, setTimerLeft] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Connection test
  const [connStatus, setConnStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [connMessage, setConnMessage] = useState("");

  // Live chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isOrganizer = !!(tgId && room?.organizer_telegram_id === tgId);
  const myMember = members.find(m => m.telegram_id === tgId);
  const isJoined = myMember?.status === "joined" || myMember?.status === "playing" || myMember?.status === "finished";
  const isInvited = myMember?.status === "invited";

  const loadRoom = async () => {
    if (!roomId) return;
    const [{ data: roomData }, { data: membersData }] = await Promise.all([
      supabase.from("pvp_rooms").select("*").eq("id", roomId).single(),
      supabase.from("pvp_room_members").select("*").eq("room_id", roomId),
    ]);
    if (roomData) setRoom(roomData as PvpRoom);
    if (membersData) setMembers(membersData as RoomMember[]);
    setLoading(false);
  };

  const loadChat = async () => {
    if (!roomId) return;
    const chatKey = `pvp_room_${roomId}`;
    const { data } = await supabase
      .from("chat_messages")
      .select("id, telegram_id, friend_name, content, created_at")
      .eq("chat_key", chatKey)
      .order("created_at", { ascending: true })
      .limit(100);
    if (data) {
      setChatMessages(data.map(m => ({
        id: m.id,
        telegram_id: m.telegram_id,
        sender_name: m.friend_name,
        text: m.content,
        created_at: m.created_at,
      })));
    }
  };

  const autoJoinDoneRef = useRef(false);

  useEffect(() => {
    loadRoom();
    loadChat();

    // Realtime subscription for room + members + chat
    const channel = supabase
      .channel(`pvp-room-${roomId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "pvp_rooms",
        filter: `id=eq.${roomId}`,
      }, () => {
        loadRoom();
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "pvp_room_members",
        filter: `room_id=eq.${roomId}`,
      }, () => {
        loadRoom();
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.chat_key === `pvp_room_${roomId}`) {
          setChatMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, {
              id: msg.id,
              telegram_id: msg.telegram_id,
              sender_name: msg.friend_name,
              text: msg.content,
              created_at: msg.created_at,
            }];
          });
        }
      })
      .subscribe();

    // Polling fallback every 3s for room/members, every 5s for chat
    const pollInterval = setInterval(loadRoom, 3000);
    const chatPollInterval = setInterval(loadChat, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      clearInterval(chatPollInterval);
    };
  }, [roomId]);

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Auto-join when arriving via ?join=1 (from chat button) once room + profile loaded
  useEffect(() => {
    if (!autoJoin || autoJoinDoneRef.current || !tgId || !character || !roomId) return;
    const myM = members.find(m => m.telegram_id === tgId);
    if (!myM) return;
    if (myM.status === "invited") {
      autoJoinDoneRef.current = true;
      handleJoin();
    } else {
      autoJoinDoneRef.current = true;
    }
  }, [autoJoin, tgId, character, roomId, members]);

  // Timer countdown when someone finishes
  useEffect(() => {
    if (!room?.timer_ends_at) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((new Date(room.timer_ends_at!).getTime() - Date.now()) / 1000));
      setTimerLeft(left);
      if (left === 0 && timerRef.current) clearInterval(timerRef.current);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [room?.timer_ends_at]);

  // Redirect when game starts (for non-organizer too)
  useEffect(() => {
    if (room?.status === "playing" && isJoined && tgId) {
      const diff = room.difficulty as "Сложная" | "Невозможная";
      navigate(`/game?pvp=${roomId}&diff=${encodeURIComponent(diff)}`);
    }
  }, [room?.status]);

  // Redirect to results when room finished
  useEffect(() => {
    if (room?.status === "finished") {
      navigate(`/pvp/results/${roomId}`);
    }
  }, [room?.status]);

  const handleJoin = async () => {
    if (!tgId || !character || !roomId) return;
    setJoining(true);
    await supabase
      .from("pvp_room_members")
      .update({ status: "joined", character_name: character.name, avatar_url: character.avatarUrl })
      .eq("room_id", roomId)
      .eq("telegram_id", tgId);
    await loadRoom();
    setJoining(false);
  };

  const handleStart = async () => {
    if (!roomId || !room) return;
    const diff = room.difficulty as "Сложная" | "Невозможная";
    const cost = diff === "Невозможная" ? 15 : 3;
    if (!useEnergy(cost)) { alert("Недостаточно энергии!"); return; }
    setStarting(true);
    await supabase
      .from("pvp_rooms")
      .update({ status: "playing", started_at: new Date().toISOString() })
      .eq("id", roomId);
    await supabase
      .from("pvp_room_members")
      .update({ status: "playing" })
      .eq("room_id", roomId)
      .eq("status", "joined");
    setStarting(false);
    navigate(`/game?pvp=${roomId}&diff=${encodeURIComponent(diff)}`);
  };

  const handleSendChat = async () => {
    if (!tgId || !roomId || !chatInput.trim()) return;
    setSendingMsg(true);
    const senderName = character?.name || profile?.first_name || "Бабай";
    const chatKey = `pvp_room_${roomId}`;
    const text = chatInput.trim();
    setChatInput("");
    await supabase.from("chat_messages").insert({
      chat_key: chatKey,
      telegram_id: tgId,
      sender_telegram_id: tgId,
      role: "user",
      friend_name: senderName,
      content: text,
      is_ai_reply: false,
    } as any);
    setSendingMsg(false);
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const fmtChatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-red-500" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-neutral-400 mb-4">Комната не найдена</p>
        <button onClick={() => navigate("/hub")} className="px-6 py-3 bg-red-700 rounded-xl font-bold">В Хаб</button>
      </div>
    );
  }

  const joinedMembers = members.filter(m => m.status !== "invited");
  const invitedMembers = members.filter(m => m.status === "invited");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col bg-transparent text-white relative z-10 overflow-hidden"
    >
      {/* Header */}
      <header className="flex items-center gap-3 p-4 bg-black/30 backdrop-blur-xl border-b border-white/10 shrink-0">
        <button onClick={() => navigate("/hub")} className="p-2 bg-neutral-900/80 rounded-full hover:bg-neutral-800 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
            <Swords size={18} className="text-red-500" /> PVP Комната
          </h1>
          <p className="text-xs text-neutral-400">
            #{room.id} · {room.difficulty}
            {isOrganizer && <span className="ml-2 text-yellow-400">👑 Вы организатор</span>}
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${
          room.status === "waiting" ? "bg-yellow-900/60 text-yellow-400" :
          room.status === "playing" ? "bg-green-900/60 text-green-400" :
          "bg-neutral-900 text-neutral-400"
        }`}>
          {room.status === "waiting" ? "Ожидание" : room.status === "playing" ? "Игра" : "Завершено"}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">

        {/* Timer banner when someone finished */}
        <AnimatePresence>
          {room.timer_ends_at && timerLeft !== null && timerLeft > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-orange-900/40 border border-orange-600 rounded-xl flex items-center gap-3"
            >
              <Timer size={20} className="text-orange-400 shrink-0" />
              <div>
                <p className="font-bold text-orange-300 text-sm">Первый финишировал!</p>
                <p className="text-xs text-orange-200/70">Оставшееся время: <span className="font-black text-orange-300">{fmtTime(timerLeft)}</span></p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Invited (pending) notice for this user */}
        {isInvited && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-red-900/30 border border-red-700 rounded-xl text-center"
          >
            <Swords size={28} className="text-red-400 mx-auto mb-2" />
            <p className="font-bold text-white mb-1">Вас пригласили в PVP!</p>
            <p className="text-xs text-neutral-400 mb-4">
              {room.difficulty === "Невозможная" ? "Невозможная (45 этапов, -15⚡)" : "Сложная (15 этапов, -3⚡)"}
            </p>
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-3 bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded-xl font-black uppercase tracking-wider flex items-center justify-center gap-2"
            >
              {joining ? <Loader2 size={18} className="animate-spin" /> : <Swords size={18} />}
              Принять вызов!
            </button>
          </motion.div>
        )}

        {/* Members in room */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-neutral-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
              В комнате ({joinedMembers.length})
            </h2>
          </div>
          <div className="space-y-2">
            {joinedMembers.map(m => (
              <div key={m.telegram_id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                m.telegram_id === tgId ? "bg-red-900/20 border-red-800" : "bg-neutral-900/60 border-neutral-800"
              }`}>
                <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-800 shrink-0">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-base">👻</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {m.telegram_id === room.organizer_telegram_id && <Crown size={12} className="text-yellow-400" />}
                    <span className="font-bold text-sm truncate">
                      {m.character_name || `Бабай #${m.telegram_id}`}
                      {m.telegram_id === tgId && <span className="text-neutral-500 text-xs ml-1">(вы)</span>}
                    </span>
                  </div>
                </div>
                <div className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  m.status === "finished" ? "bg-green-900/50 text-green-400" :
                  m.status === "playing" ? "bg-blue-900/50 text-blue-400" :
                  m.status === "timeout" ? "bg-red-900/50 text-red-400" :
                  "bg-neutral-800 text-neutral-400"
                }`}>
                  {m.status === "finished" ? "✓ Финиш" :
                   m.status === "playing" ? "🎮 Играет" :
                   m.status === "timeout" ? "💀 Проиграл" :
                   "⏳ Ждёт"}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Invited (waiting) */}
        {invitedMembers.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-neutral-500" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
                Приглашены ({invitedMembers.length})
              </h2>
            </div>
            <div className="space-y-2">
              {invitedMembers.map(m => (
                <div key={m.telegram_id} className="flex items-center gap-3 p-3 rounded-xl border bg-neutral-900/30 border-neutral-800 opacity-60">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-800 shrink-0">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-base">👻</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-sm text-neutral-400">
                      {m.character_name || `Бабай #${m.telegram_id}`}
                    </span>
                  </div>
                  <span className="text-xs text-neutral-500">Не принял</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Rules */}
        <section className="p-4 bg-neutral-900/40 border border-neutral-800 rounded-xl text-xs text-neutral-400 space-y-1.5">
          <p className="font-bold text-neutral-300 mb-2">📋 Правила PVP:</p>
          <p>• Все участники проходят одинаковые этапы одновременно</p>
          <p>• Победитель(и) забирают все заработанные очки страха всех участников</p>
          <p>• После первого финиша запускается таймер: <span className="text-white font-bold">{room.difficulty === "Невозможная" ? "10 минут" : "3 минуты"}</span></p>
          <p>• Кто не успел — проигрывает</p>
          <p>• Несколько победителей делят банк поровну (с округлением вверх)</p>
        </section>

        {/* ── LIVE CHAT ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">💬</span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">Чат комнаты</h2>
          </div>
          <div className="bg-black/30 border border-neutral-800 rounded-xl overflow-hidden">
            {/* Messages */}
            <div className="h-48 overflow-y-auto p-3 space-y-2">
              {chatMessages.length === 0 ? (
                <p className="text-center text-neutral-600 text-xs mt-6">Пока тихо... Напиши первым! 👻</p>
              ) : (
                chatMessages.map(msg => {
                  const isMe = msg.telegram_id === tgId;
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs ${
                        isMe
                          ? "bg-red-700/80 text-white rounded-tr-sm"
                          : "bg-neutral-800/80 text-neutral-200 rounded-tl-sm"
                      }`}>
                        {!isMe && (
                          <p className="font-bold text-red-400 text-[10px] mb-0.5">{msg.sender_name}</p>
                        )}
                        <p className="break-words">{msg.text}</p>
                        <p className={`text-[9px] mt-0.5 ${isMe ? "text-red-200/60 text-right" : "text-neutral-500"}`}>
                          {fmtChatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>
            {/* Input */}
            <div className="flex items-center gap-2 p-2 border-t border-neutral-800">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                placeholder="Написать в чат..."
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-600 outline-none focus:border-red-800 transition-colors"
              />
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim() || sendingMsg}
                className="p-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 rounded-xl transition-colors shrink-0"
              >
                {sendingMsg ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </section>

      </div>

      {/* Bottom action */}
      <div className="p-4 bg-black/20 backdrop-blur-lg border-t border-white/10 shrink-0">
        {isOrganizer && room.status === "waiting" && (
          <button
            onClick={handleStart}
            disabled={starting || joinedMembers.length < 2}
            className="w-full py-4 bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded-xl font-black text-lg uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(220,38,38,0.35)] transition-all"
          >
            {starting ? (
              <><Loader2 size={20} className="animate-spin" /> Запуск...</>
            ) : (
              <><Swords size={20} /> НАЧАТЬ ИГРУ ({joinedMembers.length} участника)</>
            )}
          </button>
        )}
        {!isOrganizer && isJoined && room.status === "waiting" && (
          <div className="w-full py-4 bg-neutral-900 rounded-xl text-center text-neutral-400 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            Ждём когда организатор начнёт...
          </div>
        )}
        {!isJoined && !isInvited && room.status === "waiting" && (
          <div className="w-full py-4 bg-neutral-900 rounded-xl text-center text-neutral-500 text-sm">
            Вас нет в этой комнате
          </div>
        )}
      </div>
    </motion.div>
  );
}
