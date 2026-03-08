import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { motion, AnimatePresence } from "motion/react";
import { Users, UserPlus, Zap, MessageSquare, Link, Copy, Plus, X, Trash2, Edit2, CheckCircle, AlertCircle, Loader2, Send } from "lucide-react";
import Header from "../components/Header";
import ProfilePopup from "../components/ProfilePopup";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";

interface FriendWithMeta {
  name: string; // character_name
  isAiEnabled: boolean;
  telegram_id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  telekinesis_level?: number;
  avatar_url?: string;
}

export default function Friends() {
  const navigate = useNavigate();
  const { character, friends, groupChats, addFriend, toggleFriendAi, addEnergy, addFear, createGroupChat, deleteFriend, deleteGroupChat, updateGroupName } = usePlayerStore();
  const { profile } = useTelegram();
  const [newFriendInput, setNewFriendInput] = useState("");
  const [searchStatus, setSearchStatus] = useState<"idle" | "searching" | "found" | "notfound">("idle");
  const [foundUser, setFoundUser] = useState<{ first_name: string; last_name?: string; username: string | null; character_name: string | null; telegram_id: number; telekinesis_level?: number; avatar_url?: string } | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [showProfilePopup, setShowProfilePopup] = useState<{ name: string; telegramId?: number } | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [referralCount, setReferralCount] = useState(0);
  const [referralFriends, setReferralFriends] = useState<Array<{first_name: string; username: string | null; character_name?: string | null}>>([]);
  const [showReferralList, setShowReferralList] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [friendsMeta, setFriendsMeta] = useState<Record<string, { first_name?: string; last_name?: string; username?: string; telegram_id?: number; telekinesis_level?: number; avatar_url?: string }>>({});

  useEffect(() => {
    if (!profile?.telegram_id) return;
    supabase
      .from("profiles")
      .select("first_name, username, telegram_id")
      .eq("referral_code", String(profile.telegram_id))
      .then(async ({ data }) => {
        if (data && data.length > 0) {
          setReferralCount(data.length);
          const telegramIds = data.map(d => d.telegram_id);
          const { data: statsData } = await supabase
            .from("player_stats")
            .select("telegram_id, character_name")
            .in("telegram_id", telegramIds);
          const statsMap = Object.fromEntries((statsData || []).map(s => [s.telegram_id, s.character_name]));
          setReferralFriends(data.map(d => ({
            first_name: d.first_name,
            username: d.username,
            character_name: statsMap[d.telegram_id] || null,
          })));
        }
      });
  }, [profile?.telegram_id]);

  // Load metadata for existing friends from DB
  useEffect(() => {
    if (!profile?.telegram_id || friends.length === 0) return;
    const loadFriendsMeta = async () => {
      const { data: dbFriends } = await supabase
        .from("friends")
        .select("friend_name, friend_telegram_id")
        .eq("telegram_id", profile.telegram_id);

      if (!dbFriends || dbFriends.length === 0) return;
      const tgIds = dbFriends.map(f => f.friend_telegram_id).filter(Boolean) as number[];
      if (tgIds.length === 0) return;

      const [profilesRes, statsRes] = await Promise.all([
        supabase.from("profiles").select("telegram_id, first_name, last_name, username").in("telegram_id", tgIds),
        supabase.from("player_stats").select("telegram_id, telekinesis_level, avatar_url, character_name").in("telegram_id", tgIds),
      ]);

      const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.telegram_id, p]));
      const statsMap = Object.fromEntries((statsRes.data || []).map(s => [s.telegram_id, s]));

      const meta: Record<string, any> = {};
      for (const f of dbFriends) {
        if (!f.friend_telegram_id) continue;
        const prof = profileMap[f.friend_telegram_id];
        const stats = statsMap[f.friend_telegram_id];
        meta[f.friend_name] = {
          first_name: prof?.first_name,
          last_name: prof?.last_name,
          username: prof?.username,
          telegram_id: f.friend_telegram_id,
          telekinesis_level: stats?.telekinesis_level ?? 1,
          avatar_url: stats?.avatar_url,
        };
      }
      setFriendsMeta(meta);
    };
    loadFriendsMeta();
  }, [profile?.telegram_id, friends]);

  const { dbLoaded } = usePlayerStore();

  useEffect(() => {
    if (dbLoaded && !character) navigate("/");
  }, [dbLoaded, character]);

  if (!dbLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-500">
        <Loader2 size={28} className="animate-spin text-red-700" />
        <span className="text-sm">Загрузка друзей...</span>
      </div>
    );
  }

  if (!character) return null;

  const referralLink = `https://t.me/Bab_AIbot/app?startapp=${profile?.telegram_id || ""}`;
  const tkBonus = Math.max(1, character.telekinesisLevel);
  const fearBonus = 100 * tkBonus;
  const energyBonus = 100 * tkBonus;

  const inviteText = `👻 Привет! Я — ${character.name}, бессмертный кибер-дух Бабай!\n\n🔥 Приглашаю тебя в игру «Бабай» — стань своим Бабаем, пугай жильцов и собирай арбузы!\n\n⚡ Если зайдёшь по моей ссылке — получишь бонус ${energyBonus} энергии и ${fearBonus} страха!\n\n👇 Жми сюда:\n${referralLink}`;

  const handleSearchFriend = async () => {
    if (!newFriendInput.trim()) return;
    setSearchStatus("searching");
    setFoundUser(null);

    const query = newFriendInput.trim();
    const queryLower = query.toLowerCase().replace(/^@/, "");
    const isNumericId = /^\d+$/.test(query);

    const [statsByName, profileByUsername] = await Promise.all([
      supabase.from("player_stats").select("character_name, telegram_id, telekinesis_level, avatar_url").ilike("character_name", queryLower).limit(1).then(r => r),
      supabase.from("profiles").select("first_name, last_name, username, telegram_id").ilike("username", queryLower).limit(1).then(r => r),
    ]);

    let profileById: any = null;
    if (isNumericId) {
      const res = await supabase.from("profiles").select("first_name, last_name, username, telegram_id").eq("telegram_id", Number(query)).limit(1);
      profileById = res;
    }

    const results = [statsByName, profileByUsername, profileById];
    const byName = results[0].data?.[0];
    const byUsername = results[1].data?.[0];
    const byId = isNumericId ? results[2]?.data?.[0] : null;

    if (byName || byUsername || byId) {
      const match = byName || byUsername || byId;
      const telegramId = match.telegram_id;
      const [profRes, statsRes] = await Promise.all([
        supabase.from("profiles").select("first_name, last_name, username, telegram_id").eq("telegram_id", telegramId).single(),
        supabase.from("player_stats").select("character_name, telekinesis_level, avatar_url").eq("telegram_id", telegramId).single(),
      ]);
      setFoundUser({
        first_name: profRes.data?.first_name || "",
        last_name: profRes.data?.last_name || undefined,
        username: profRes.data?.username || null,
        character_name: statsRes.data?.character_name || null,
        telegram_id: telegramId,
        telekinesis_level: statsRes.data?.telekinesis_level ?? 1,
        avatar_url: statsRes.data?.avatar_url ?? undefined,
      });
      setSearchStatus("found");
    } else {
      setSearchStatus("notfound");
    }
  };

  const handleAddFoundFriend = async () => {
    if (!foundUser) return;
    const nameToAdd = foundUser.character_name || foundUser.first_name;
    addFriend(nameToAdd);
    if (profile?.telegram_id) {
      const { error } = await supabase.from("friends").upsert({
        telegram_id: profile.telegram_id,
        friend_name: nameToAdd,
        friend_telegram_id: foundUser.telegram_id,
      }, { onConflict: "telegram_id,friend_name" });
      if (error) console.error("Friend save error:", error);
    }
    setNewFriendInput("");
    setSearchStatus("idle");
    setFoundUser(null);
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteText);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const shareEnergy = (friendName: string) => {
    const { energy, useEnergy } = usePlayerStore.getState();
    if (energy >= 10) {
      useEnergy(10);
      alert(`Вы поделились 10 энергии с ${friendName}!`);
    } else {
      alert("Недостаточно энергии для отправки.");
    }
  };

  const handleCreateGroup = () => {
    if (newGroupName.trim() && selectedFriends.length > 0) {
      createGroupChat(newGroupName.trim(), selectedFriends);
      setNewGroupName("");
      setSelectedFriends([]);
      setShowGroupModal(false);
    }
  };

  const handleEditGroup = (id: string, currentName: string) => {
    setEditingGroupId(id);
    setEditGroupName(currentName);
  };

  const saveGroupName = () => {
    if (editingGroupId && editGroupName.trim()) {
      updateGroupName(editingGroupId, editGroupName.trim());
      setEditingGroupId(null);
      setEditGroupName("");
    }
  };

  const toggleFriendSelection = (name: string) => {
    setSelectedFriends(prev =>
      prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name]
    );
  };

  const getAvatarUrl = (friend: { name: string; avatar_url?: string }) => {
    if (friend.name === "ДанИИл") return "https://i.ibb.co/rKGSq544/image.png";
    if (friend.avatar_url) return friend.avatar_url;
    return `https://picsum.photos/seed/${friend.name}/100/100`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container">
        <div className="fog-layer"></div>
        <div className="fog-layer-2"></div>
      </div>

      <Header title={<><Users size={20} /> Друзья</>} backUrl="/hub" />

      <div className="flex-1 overflow-y-auto p-6 space-y-8 relative z-10">

        {/* Referral Section */}
        <section className="bg-neutral-900/80 backdrop-blur-md p-6 rounded-2xl border border-neutral-800 space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2 text-white">
            <Link size={18} className="text-red-500" /> Реферальная программа
          </h2>
          <p className="text-sm text-neutral-400">Приглашайте друзей и получайте бонусы за каждого нового игрока:</p>
          <div className="grid grid-cols-2 gap-2 text-center text-sm">
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3">
              <div className="text-2xl font-black text-yellow-400">+{energyBonus}</div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">⚡ Энергии обоим</div>
            </div>
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3">
              <div className="text-2xl font-black text-red-400">+{fearBonus}</div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">👻 Страха обоим</div>
            </div>
          </div>
          {tkBonus > 1 && (
            <p className="text-[11px] text-purple-400 text-center">✨ ×{tkBonus} бонус телекинеза уровня {character.telekinesisLevel}!</p>
          )}

          <button
            onClick={() => setShowReferralList(!showReferralList)}
            className="w-full flex items-center justify-between bg-neutral-950 border border-neutral-800 hover:border-red-900/50 rounded-xl px-4 py-3 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm text-neutral-300">
              <Users size={16} className="text-red-500" /> Пришло по ссылке
            </span>
            <span className="font-black text-white text-lg">{referralCount}</span>
          </button>
          {showReferralList && referralFriends.length > 0 && (
            <div className="space-y-2">
              {referralFriends.map((f, i) => (
                <div key={i} className="flex items-center gap-3 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-red-400">
                    {(f.character_name || f.first_name)[0]}
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold">{f.character_name || f.first_name}</p>
                    {f.username && <p className="text-neutral-500 text-xs">@{f.username}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-neutral-950 border border-neutral-700 rounded-xl p-4 text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap font-mono">
            {inviteText}
          </div>
          <button
            onClick={handleCopyInvite}
            className={`w-full py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${copiedInvite ? "bg-green-800 text-green-200 border border-green-700" : "bg-red-700 hover:bg-red-600 text-white border border-red-600"}`}
          >
            {copiedInvite ? <><CheckCircle size={16} /> Скопировано!</> : <><Copy size={16} /> Скопировать приглашение</>}
          </button>
        </section>

        {/* Add Friend Section */}
        <section className="bg-neutral-900/80 backdrop-blur-md p-6 rounded-2xl border border-neutral-800 space-y-3">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2 text-white">
            <UserPlus size={18} className="text-red-500" /> Добавить друга
          </h2>
          <p className="text-xs text-neutral-500">Введите имя Бабая, @username или ID Telegram</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newFriendInput}
              onChange={(e) => { setNewFriendInput(e.target.value); setSearchStatus("idle"); setFoundUser(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleSearchFriend()}
              placeholder="Имя Бабая, @username или ID..."
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-900 transition-colors text-white"
            />
            <button
              onClick={handleSearchFriend}
              disabled={!newFriendInput.trim() || searchStatus === "searching"}
              className="px-4 bg-red-700 hover:bg-red-600 rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center"
            >
              {searchStatus === "searching" ? <Loader2 size={20} className="text-white animate-spin" /> : <UserPlus size={20} className="text-white" />}
            </button>
          </div>

          <AnimatePresence>
            {searchStatus === "found" && foundUser && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-green-900/20 border border-green-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {foundUser.avatar_url ? (
                    <img src={foundUser.avatar_url} alt="av" className="w-10 h-10 rounded-full object-cover border border-neutral-700 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-lg shrink-0">👻</div>
                  )}
                  <div>
                    <p className="text-white font-bold text-sm">
                      {foundUser.first_name}{foundUser.last_name ? ` ${foundUser.last_name}` : ""}
                      {foundUser.username && (
                        <a href={`https://t.me/${foundUser.username}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline ml-1">@{foundUser.username}</a>
                      )}
                    </p>
                    {foundUser.character_name && (
                      <p className="text-neutral-400 text-xs">{foundUser.character_name} · тк. {foundUser.telekinesis_level ?? 1}</p>
                    )}
                  </div>
                </div>
                <button onClick={handleAddFoundFriend} className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded-xl text-white text-xs font-bold transition-colors flex items-center gap-1">
                  <UserPlus size={14} /> Добавить
                </button>
              </motion.div>
            )}
            {searchStatus === "notfound" && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-red-900/20 border border-red-900/50 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-300 text-sm font-bold">Бабай не найден</p>
                    <p className="text-neutral-400 text-xs mt-1">«{newFriendInput}» ещё не зарегистрирован. Отправьте ему приглашение!</p>
                  </div>
                </div>
                <button onClick={handleCopyInvite} className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-200 text-xs font-bold transition-colors flex items-center justify-center gap-2">
                  <Send size={14} /> Скопировать приглашение
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Group Chats */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Групповые чаты ({groupChats.length})</h2>
            <button
              onClick={() => setShowGroupModal(true)}
              className="p-2 bg-red-900/30 text-red-500 hover:bg-red-900/50 rounded-xl transition-colors flex items-center gap-1 text-sm font-bold"
            >
              <Plus size={16} /> Создать
            </button>
          </div>
          {groupChats.length === 0 ? (
            <p className="text-center text-neutral-500 py-4">Нет групповых чатов.</p>
          ) : (
            <div className="space-y-3">
              {groupChats.map((chat) => (
                <div key={chat.id} className="bg-neutral-900/80 backdrop-blur-md p-4 rounded-xl border border-neutral-800 flex items-center justify-between">
                  {editingGroupId === chat.id ? (
                    <div className="flex-1 flex gap-2 mr-2">
                      <input type="text" value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-red-900 text-white" autoFocus />
                      <button onClick={saveGroupName} className="text-green-500 text-sm font-bold">OK</button>
                      <button onClick={() => setEditingGroupId(null)} className="text-neutral-500 text-sm">Отмена</button>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white block">{chat.name}</span>
                        <button onClick={() => handleEditGroup(chat.id, chat.name)} className="text-neutral-500 hover:text-white"><Edit2 size={12} /></button>
                      </div>
                      <span className="text-xs text-neutral-500">{chat.members.length} участников</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => navigate("/chat", { state: { groupId: chat.id } })} className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-blue-400 transition-colors"><MessageSquare size={16} /></button>
                    <button onClick={() => { if (confirm('Удалить группу?')) deleteGroupChat(chat.id); }} className="p-2 bg-neutral-800 hover:bg-red-900/50 rounded-lg text-red-500 transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Friends List */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-white">Список друзей ({friends.length})</h2>
          {friends.length === 0 ? (
            <p className="text-center text-neutral-500 py-8">У вас пока нет друзей. Пригласите кого-нибудь!</p>
          ) : (
            <div className="space-y-3">
              {friends.map((friend) => {
                const meta = friendsMeta[friend.name] || {};
                const isDanil = friend.name === "ДанИИл";
                const avatarSrc = isDanil ? "https://i.ibb.co/rKGSq544/image.png" : (meta.avatar_url || `https://picsum.photos/seed/${friend.name}/100/100`);
                const tgLink = meta.username ? `https://t.me/${meta.username}` : (meta.telegram_id ? `https://t.me/user?id=${meta.telegram_id}` : null);

                return (
                  <div key={friend.name} className="bg-neutral-900/80 backdrop-blur-md p-4 rounded-xl border border-neutral-800 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowProfilePopup({ name: friend.name, telegramId: meta.telegram_id })}>
                        <img src={avatarSrc} alt="avatar" className="w-10 h-10 rounded-full object-cover border border-neutral-700 shrink-0" />
                        <div className="min-w-0">
                          {/* Line 1: Имя Фамилия @username */}
                          {!isDanil && (meta.first_name || meta.username) ? (
                            <div className="text-sm text-neutral-300 truncate">
                              {meta.first_name}{meta.last_name ? ` ${meta.last_name}` : ""}
                              {meta.username && tgLink && (
                                <a
                                  href={tgLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="text-blue-400 hover:underline ml-1"
                                >@{meta.username}</a>
                              )}
                            </div>
                          ) : null}
                          {/* Line 2: [Имя Бабая] тк. N */}
                          <div className="font-bold text-white text-sm flex items-center gap-1">
                            {friend.name}
                            {!isDanil && (
                              <span className="text-neutral-500 font-normal text-xs">· тк. {meta.telekinesis_level ?? 1}</span>
                            )}
                            {isDanil && <span className="text-xs text-green-400 font-normal ml-1">ИИ-куратор</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => shareEnergy(friend.name)} className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-yellow-500 transition-colors" title="Поделиться энергией"><Zap size={16} /></button>
                        <button onClick={() => navigate("/chat", { state: { friendName: friend.name } })} className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-blue-400 transition-colors" title="Чат"><MessageSquare size={16} /></button>
                        {!isDanil && (
                          <button onClick={() => { if (confirm(`Удалить ${friend.name}?`)) deleteFriend(friend.name); }} className="p-2 bg-neutral-800 hover:bg-red-900/50 rounded-lg text-red-500 transition-colors"><Trash2 size={16} /></button>
                        )}
                      </div>
                    </div>
                    {!isDanil && (
                      <div className="flex items-center justify-between text-sm border-t border-neutral-800 pt-2">
                        <span className="text-neutral-400">ИИ-заместитель:</span>
                        <button onClick={() => toggleFriendAi(friend.name)} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${friend.isAiEnabled ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-neutral-800 text-neutral-500 border border-neutral-700'}`}>
                          {friend.isAiEnabled ? "ВКЛ" : "ВЫКЛ"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Create Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-sm w-full"
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider">Новая группа</h2>
              <button onClick={() => setShowGroupModal(false)} className="text-neutral-500 hover:text-white"><X size={24} /></button>
            </div>
            <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Название группы..." className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-900 transition-colors mb-4 text-white" />
            <h3 className="text-sm font-bold text-neutral-400 mb-2">Выберите участников:</h3>
            <div className="max-h-48 overflow-y-auto space-y-2 mb-4 pr-2">
              {friends.filter(f => f.name !== "ДанИИл").map(friend => (
                <label key={friend.name} className="flex items-center gap-3 p-2 bg-neutral-800/50 rounded-xl cursor-pointer hover:bg-neutral-800">
                  <input type="checkbox" checked={selectedFriends.includes(friend.name)} onChange={() => toggleFriendSelection(friend.name)} className="accent-red-600 w-4 h-4" />
                  <span className="text-white">{friend.name}</span>
                </label>
              ))}
            </div>
            <button onClick={handleCreateGroup} disabled={!newGroupName.trim() || selectedFriends.length === 0} className="w-full py-3 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold transition-colors disabled:opacity-50">
              Создать
            </button>
          </motion.div>
        </div>
      )}

      {showProfilePopup && (
        <ProfilePopup
          name={showProfilePopup.name}
          telegramId={showProfilePopup.telegramId}
          onClose={() => setShowProfilePopup(null)}
        />
      )}
    </motion.div>
  );
}
