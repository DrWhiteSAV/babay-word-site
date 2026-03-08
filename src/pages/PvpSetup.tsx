import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";
import { protalkGenerateText } from "../services/protalk";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Zap, Skull, Users, Swords, Check, Loader2, Wifi, WifiOff, RefreshCw } from "lucide-react";

type ConnectionStatus = "idle" | "checking" | "ok" | "error";

type Difficulty = "Сложная" | "Невозможная";

interface FriendMeta {
  name: string;
  telegram_id?: number;
  character_name?: string | null;
  avatar_url?: string | null;
}

function genRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function PvpSetup() {
  const navigate = useNavigate();
  const { friends, character, energy, fear, watermelons } = usePlayerStore();
  const { profile } = useTelegram();
  const tgId = profile?.telegram_id;

  const [friendsMeta, setFriendsMeta] = useState<FriendMeta[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [connStatus, setConnStatus] = useState<ConnectionStatus>("idle");
  const [connMessage, setConnMessage] = useState("");

  useEffect(() => {
    if (!tgId || friends.length === 0) return;
    (async () => {
      const { data: dbFriends } = await supabase
        .from("friends")
        .select("friend_name, friend_telegram_id")
        .eq("telegram_id", tgId);

      const telegramIds = (dbFriends || [])
        .map(f => f.friend_telegram_id)
        .filter(Boolean) as number[];

      const statsMap: Record<number, { character_name?: string | null; avatar_url?: string | null }> = {};
      if (telegramIds.length > 0) {
        const { data: stats } = await supabase
          .from("player_stats")
          .select("telegram_id, character_name, avatar_url")
          .in("telegram_id", telegramIds);
        (stats || []).forEach(s => { statsMap[s.telegram_id] = s; });
      }

      const meta: FriendMeta[] = (dbFriends || [])
        .filter(f => f.friend_telegram_id)
        .map(f => ({
          name: f.friend_name,
          telegram_id: f.friend_telegram_id!,
          character_name: statsMap[f.friend_telegram_id!]?.character_name,
          avatar_url: statsMap[f.friend_telegram_id!]?.avatar_url,
        }));
      setFriendsMeta(meta);
    })();
  }, [tgId, friends]);

  const toggleFriend = (tid: number) => {
    setSelected(prev =>
      prev.includes(tid) ? prev.filter(x => x !== tid) : [...prev, tid]
    );
  };

  const handleCreate = async () => {
    if (!tgId || !difficulty || selected.length === 0 || !character) return;
    setCreating(true);

    const roomId = genRoomId();

    // Create room
    await supabase.from("pvp_rooms").insert({
      id: roomId,
      organizer_telegram_id: tgId,
      difficulty,
      status: "waiting",
    });

    // Add organizer as first member
    await supabase.from("pvp_room_members").insert({
      room_id: roomId,
      telegram_id: tgId,
      character_name: character.name,
      avatar_url: character.avatarUrl,
      status: "joined",
    });

    // Add invited friends with status 'invited'
    const invites = selected.map(tid => ({
      room_id: roomId,
      telegram_id: tid,
      character_name: friendsMeta.find(f => f.telegram_id === tid)?.character_name || null,
      avatar_url: friendsMeta.find(f => f.telegram_id === tid)?.avatar_url || null,
      status: "invited",
    }));
    if (invites.length > 0) {
      await supabase.from("pvp_room_members").insert(invites);
    }

    // Send PVP invite via in-app chat message + Telegram notification
    const organizerName = character.name || profile?.first_name || "Бабай";
    const diffLabel = difficulty === "Сложная" ? "Сложная (15 этапов + Босс)" : "Невозможная (45 этапов + Босс ×2)";
    const appLink = "https://t.me/Bab_AIbot/app";

    for (const tid of selected) {
      const chatKey = [tgId, tid].map(String).sort().join('_');
      const pvpContent = `[pvp]:${roomId}\n⚔️ ${organizerName} приглашает тебя в PVP!\n🎮 Режим: ${diffLabel}`;
      try {
        await supabase.from("chat_messages").insert({
          chat_key: chatKey,
          telegram_id: tgId,
          sender_telegram_id: tgId,
          role: "user",
          friend_name: organizerName,
          content: pvpContent,
          is_ai_reply: false,
        } as any);
      } catch (e) {
        console.error("[PvpSetup] chat notify error", e);
      }

      // Send Telegram push notification with app link button
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.functions.invoke("send-telegram-notification", {
          body: {
            telegram_id: tid,
            caption: `⚔️ *${organizerName}* вызывает тебя на PVP-битву!\n\n🎮 Режим: ${diffLabel}\n🏠 Комната: \`${roomId}\`\n\nПрими вызов — покажи кто настоящий Бабай! 👻`,
            inline_keyboard: [[
              { text: "⚔️ Принять вызов!", url: appLink },
            ]],
          },
        });
      } catch (e) {
        console.error("[PvpSetup] telegram notify error", e);
      }
    }

    setCreating(false);
    navigate(`/pvp/room/${roomId}`);
  };

  const checkConnection = async () => {
    setConnStatus("checking");
    setConnMessage("");
    try {
      const reply = await protalkGenerateText("Ответь одним словом: готов", tgId);
      if (reply && reply.trim().length > 0) {
        setConnStatus("ok");
        setConnMessage(reply.trim());
      } else {
        setConnStatus("error");
        setConnMessage("Пустой ответ от сервера");
      }
    } catch (e: any) {
      setConnStatus("error");
      setConnMessage(e?.message || "Нет связи с ProTalk");
    }
  };

  const cost = difficulty === "Невозможная" ? 15 : 3;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col bg-transparent text-white relative z-10 overflow-hidden"
    >
      {/* Header */}
      <header className="flex items-center gap-3 p-4 bg-black/30 backdrop-blur-xl border-b border-white/10 shrink-0">
        <button
          onClick={() => navigate("/hub")}
          className="p-2 bg-neutral-900/80 rounded-full hover:bg-neutral-800 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black uppercase tracking-widest">PVP Бабаев</h1>
          <p className="text-xs text-neutral-400">Мультиплеер с друзьями</p>
        </div>
        <div className="flex gap-3 text-sm font-bold">
          <span className="text-yellow-500 flex items-center gap-1"><Zap size={13} />{energy}</span>
          <span className="text-red-500 flex items-center gap-1"><Skull size={13} />{fear}</span>
          <span className="text-green-500 flex items-center gap-1">🍉{watermelons}</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">

        {/* Step 1 — Select friends */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-red-700 flex items-center justify-center text-xs font-black">1</div>
            <h2 className="text-base font-bold uppercase tracking-wider">Выберите участников</h2>
            {selected.length > 0 && (
              <span className="ml-auto text-xs bg-red-700/80 text-white px-2 py-0.5 rounded-full font-bold">
                {selected.length} выбрано
              </span>
            )}
          </div>
          {friendsMeta.length === 0 ? (
            <div className="p-4 bg-neutral-900/60 rounded-xl border border-neutral-800 text-center text-neutral-500 text-sm">
              <Users size={24} className="mx-auto mb-2 opacity-40" />
              У вас ещё нет друзей. Добавьте их на странице Друзья.
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="relative mb-3">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск по имени или персонажу..."
                  className="w-full bg-neutral-900/80 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 outline-none focus:border-red-700 transition-colors"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {friendsMeta
                  .filter(f => {
                    if (!search.trim()) return true;
                    const q = search.toLowerCase();
                    return (
                      f.name.toLowerCase().includes(q) ||
                      (f.character_name || "").toLowerCase().includes(q)
                    );
                  })
                  .map(friend => {
                    const isSelected = selected.includes(friend.telegram_id!);
                    return (
                      <button
                        key={friend.telegram_id}
                        onClick={() => toggleFriend(friend.telegram_id!)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isSelected
                            ? "bg-red-900/40 border-red-600"
                            : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-600"
                        }`}
                      >
                        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-neutral-800 shrink-0">
                          {friend.avatar_url ? (
                            <img src={friend.avatar_url} alt={friend.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg">👻</div>
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-bold text-sm">{friend.name}</div>
                          {friend.character_name && (
                            <div className="text-xs text-red-400">{friend.character_name}</div>
                          )}
                        </div>
                        {isSelected && <Check size={18} className="text-red-400 shrink-0" />}
                      </button>
                    );
                  })}
                {friendsMeta.filter(f => {
                  if (!search.trim()) return true;
                  const q = search.toLowerCase();
                  return f.name.toLowerCase().includes(q) || (f.character_name || "").toLowerCase().includes(q);
                }).length === 0 && (
                  <p className="text-center text-neutral-600 text-sm py-4">Никого не найдено</p>
                )}
              </div>
            </>
          )}
        </section>

        {/* Step 2 — Select difficulty */}
        <AnimatePresence>
          {selected.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-red-700 flex items-center justify-center text-xs font-black">2</div>
                <h2 className="text-base font-bold uppercase tracking-wider">Сложность</h2>
              </div>
              <div className="space-y-3">
                {(["Сложная", "Невозможная"] as Difficulty[]).map(diff => (
                  <button
                    key={diff}
                    onClick={() => setDifficulty(diff)}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      difficulty === diff
                        ? "bg-red-900/40 border-red-600"
                        : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white">{diff}</h3>
                      {difficulty === diff && <Check size={16} className="text-red-400" />}
                    </div>
                    <p className="text-neutral-400 text-xs mt-1">
                      {diff === "Сложная"
                        ? `15 этапов + Босс · ожидание 3 мин · стоимость 3 ⚡`
                        : `45 этапов + Босс ×2 · ожидание 10 мин · стоимость 15 ⚡`}
                    </p>
                  </button>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Step 3 — Summary + Create */}
        <AnimatePresence>
          {selected.length > 0 && difficulty && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="pb-4"
            >
              <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl mb-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400">Участники</span>
                  <span className="font-bold text-white">{selected.length + 1} Бабая</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400">Сложность</span>
                  <span className="font-bold text-white">{difficulty}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400">Стоимость входа</span>
                  <span className="font-bold text-yellow-400 flex items-center gap-1"><Zap size={12} />{cost}</span>
                </div>
                {energy < cost && (
                  <p className="text-red-400 text-xs text-center mt-1">Недостаточно энергии!</p>
                )}
              </div>
              <button
                onClick={handleCreate}
                disabled={creating || energy < cost}
                className="w-full py-4 bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded-xl font-black text-lg uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(220,38,38,0.35)]"
              >
                {creating ? (
                  <><Loader2 size={20} className="animate-spin" /> Создание комнаты...</>
                ) : (
                  <><Swords size={20} /> Создать комнату и отправить приглашения</>
                )}
              </button>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
