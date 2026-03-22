import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { motion, AnimatePresence } from "motion/react";
import { Users, UserPlus, Zap, MessageSquare, Link, Copy, Plus, X, Trash2, Edit2, CheckCircle, AlertCircle, Loader2, Bot, Search } from "lucide-react";
import Header from "../components/Header";
import ProfilePopup from "../components/ProfilePopup";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";
import { notifyFriendAdded } from "../services/friendNotify";
import { useFriendOnlineStatus } from "../hooks/useOnlinePresence";
import SocialLinksBlock from "../components/SocialLinksBlock";

const SUPABASE_URL = "https://psuvnvqvspqibsezcrny.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzdXZudnF2c3BxaWJzZXpjcm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDI5NTIsImV4cCI6MjA4NzU3ODk1Mn0.VHI6Kefzbz6Hc8TpLI5_JRXAyPJ-y4oeE3Bkh16jFRU";



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
  const [energyModal, setEnergyModal] = useState<{ friendName: string; telegramId?: number } | null>(null);
  const [energyAmount, setEnergyAmount] = useState(10);
  const [energySending, setEnergySending] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [showSocialPopup, setShowSocialPopup] = useState(false);

  // Friend requests state
  const [incomingRequests, setIncomingRequests] = useState<Array<{id: string; from_telegram_id: number; from_character_name: string | null; created_at: string; avatar_url?: string; username?: string; first_name?: string}>>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<Array<{id: string; to_telegram_id: number; status: string; created_at: string}>>([]);
  const [requestSending, setRequestSending] = useState(false);
  const [showRequestsSection, setShowRequestsSection] = useState(true);

  // Collect all friend telegram IDs for online status polling
  const friendTelegramIds = useMemo(
    () => Object.values(friendsMeta).map(m => m.telegram_id).filter(Boolean) as number[],
    [friendsMeta]
  );
  const onlineMap = useFriendOnlineStatus(friendTelegramIds);


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

  // Load friend requests
  const loadRequests = async () => {
    if (!profile?.telegram_id) return;
    const { data: incoming } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("to_telegram_id", profile.telegram_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (incoming && incoming.length > 0) {
      const fromIds = incoming.map(r => r.from_telegram_id);
      const [profRes, statsRes] = await Promise.all([
        supabase.from("profiles").select("telegram_id, first_name, username").in("telegram_id", fromIds),
        supabase.from("player_stats").select("telegram_id, character_name, avatar_url").in("telegram_id", fromIds),
      ]);
      const profMap = Object.fromEntries((profRes.data || []).map(p => [p.telegram_id, p]));
      const statsMap = Object.fromEntries((statsRes.data || []).map(s => [s.telegram_id, s]));
      setIncomingRequests(incoming.map(r => ({
        ...r,
        avatar_url: statsMap[r.from_telegram_id]?.avatar_url || undefined,
        username: profMap[r.from_telegram_id]?.username || undefined,
        first_name: profMap[r.from_telegram_id]?.first_name || undefined,
      })));
    } else {
      setIncomingRequests([]);
    }

    const { data: outgoing } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("from_telegram_id", profile.telegram_id)
      .eq("status", "pending");
    setOutgoingRequests(outgoing || []);
  };

  useEffect(() => {
    if (!profile?.telegram_id) return;
    loadRequests();
    const interval = setInterval(loadRequests, 10000);

    // Realtime subscription for instant updates
    const channel = supabase
      .channel(`friend_requests_${profile.telegram_id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "friend_requests",
        filter: `to_telegram_id=eq.${profile.telegram_id}`,
      }, () => { loadRequests(); })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [profile?.telegram_id]);

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
    if (!foundUser || !profile?.telegram_id) return;
    setRequestSending(true);
    try {
      // Check if already friends
      const existingFriend = friends.find(f => f.name === (foundUser.character_name || foundUser.first_name));
      if (existingFriend) {
        alert("Этот пользователь уже в вашем списке друзей!");
        setRequestSending(false);
        return;
      }
      // Check if request already sent
      const existing = outgoingRequests.find(r => r.to_telegram_id === foundUser.telegram_id);
      if (existing) {
        alert("Заявка уже отправлена!");
        setRequestSending(false);
        return;
      }
      // Send friend request
      const { error } = await supabase.from("friend_requests").upsert({
        from_telegram_id: profile.telegram_id,
        to_telegram_id: foundUser.telegram_id,
        from_character_name: character?.name || null,
        status: "pending",
      }, { onConflict: "from_telegram_id,to_telegram_id" });
      if (error) {
        console.error("Friend request error:", error);
      } else {
        setOutgoingRequests(prev => [...prev, { id: "temp", to_telegram_id: foundUser.telegram_id, status: "pending", created_at: new Date().toISOString() }]);
        // Send telegram notification
        try {
          const caption = `👋 *Заявка в друзья!*\n\n*${character?.name || "Бабай"}* хочет добавить тебя в друзья в игре Бабай.\n\nОткрой раздел Друзья, чтобы принять или отклонить заявку!`;
          await fetch(`${SUPABASE_URL}/functions/v1/send-telegram-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
            body: JSON.stringify({ telegram_id: foundUser.telegram_id, caption }),
          });
        } catch (e) { console.error("Notify error:", e); }
      }
    } catch (e) {
      console.error("Send request error:", e);
    }
    setRequestSending(false);
    setNewFriendInput("");
    setSearchStatus("idle");
    setFoundUser(null);
  };

  const handleAcceptRequest = async (req: typeof incomingRequests[0]) => {
    if (!profile?.telegram_id || !character) return;
    // Get the requester's character name
    const { data: reqStats } = await supabase.from("player_stats").select("character_name").eq("telegram_id", req.from_telegram_id).single();
    const theirName = reqStats?.character_name || req.from_character_name || req.first_name || "Бабай";
    const myName = character.name;

    // Create mutual friend entries
    await Promise.all([
      supabase.from("friends").upsert({ telegram_id: profile.telegram_id, friend_name: theirName, friend_telegram_id: req.from_telegram_id }, { onConflict: "telegram_id,friend_name" }),
      supabase.from("friends").upsert({ telegram_id: req.from_telegram_id, friend_name: myName, friend_telegram_id: profile.telegram_id }, { onConflict: "telegram_id,friend_name" }),
    ]);

    // Update request status
    await supabase.from("friend_requests").update({ status: "accepted" }).eq("id", req.id);

    // Update local store
    addFriend(theirName);
    setIncomingRequests(prev => prev.filter(r => r.id !== req.id));

    // Notify the requester
    try {
      const caption = `✅ *Заявка принята!*\n\n*${myName}* принял(а) вашу заявку в друзья!`;
      await fetch(`${SUPABASE_URL}/functions/v1/send-telegram-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ telegram_id: req.from_telegram_id, caption }),
      });
    } catch (e) { console.error("Notify error:", e); }

    notifyFriendAdded(profile.telegram_id, req.from_telegram_id);
  };

  const handleDeclineRequest = async (req: typeof incomingRequests[0]) => {
    await supabase.from("friend_requests").update({ status: "declined" }).eq("id", req.id);
    setIncomingRequests(prev => prev.filter(r => r.id !== req.id));
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteText);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteText);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleSendEnergy = async () => {
    if (!energyModal) return;
    const { energy, useEnergy } = usePlayerStore.getState();
    const amount = Math.max(1, Math.min(energyAmount, energy));
    if (energy < amount) return;
    setEnergySending(true);
    useEnergy(amount);

    if (energyModal.telegramId) {
      try {
        const senderName = character?.name || "Бабай";
        const caption =
          `⚡ *Тебе подарили энергию!*\n\n` +
          `*${senderName}* поделился с тобой *${amount} ⚡ энергии* в игре Бабай.`;
        await fetch(`${SUPABASE_URL}/functions/v1/send-telegram-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ telegram_id: energyModal.telegramId, caption }),
        });
      } catch (e) {
        console.error("Energy notify error:", e);
      }
    }

    setEnergySending(false);
    setEnergyModal(null);
    setEnergyAmount(10);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || selectedFriends.length === 0) return;
    if (!profile?.telegram_id || !character) return;

    const groupId = Date.now().toString();
    const finalMembers = selectedFriends.includes("ДанИИл")
      ? selectedFriends
      : [...selectedFriends, "ДанИИл"];

    // 1. Save group to DB
    await supabase.from("group_chats").insert({
      id: groupId,
      name: newGroupName.trim(),
      created_by: profile.telegram_id,
    });

    // 2. Add creator as member
    await supabase.from("group_chat_members").upsert({
      group_id: groupId,
      telegram_id: profile.telegram_id,
      character_name: character.name,
    }, { onConflict: "group_id,telegram_id" });

    // 3. Resolve telegram_ids for selected real friends and insert them
    const realFriends = finalMembers.filter(n => n !== "ДанИИл" && n !== character.name);
    if (realFriends.length > 0) {
      const { data: statsRows } = await supabase
        .from("player_stats")
        .select("telegram_id, character_name")
        .in("character_name", realFriends);

      for (const row of statsRows || []) {
        if (!row.telegram_id || !row.character_name) continue;
        await supabase.from("group_chat_members").upsert({
          group_id: groupId,
          telegram_id: row.telegram_id,
          character_name: row.character_name,
        }, { onConflict: "group_id,telegram_id" });
      }
    }

    // 4. Update local store
    createGroupChat(newGroupName.trim(), finalMembers);
    // Override the auto-generated id with the canonical one
    usePlayerStore.setState(s => ({
      groupChats: s.groupChats.map(g =>
        g.members.join(",") === finalMembers.join(",") && g.name === newGroupName.trim()
          ? { ...g, id: groupId }
          : g
      ),
    }));

    setNewGroupName("");
    setSelectedFriends([]);
    setShowGroupModal(false);
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

      {/* Big Chats button */}
      <div className="px-6 pt-3 pb-0 relative z-10">
        <button
          onClick={() => navigate("/chats")}
          className="friends-chats-btn w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-900/80 to-blue-800/60 hover:from-blue-800/90 hover:to-blue-700/70 border border-blue-700/50 hover:border-blue-500/70 rounded-2xl px-5 py-4 transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_28px_rgba(59,130,246,0.35)] active:scale-[0.98]"
        >
          <MessageSquare size={22} className="friends-chats-icon text-blue-300" />
          <span className="friends-chats-label text-base font-black text-white tracking-wide">Чаты</span>
          <span className="friends-chats-arrow ml-auto text-xs text-blue-400 font-semibold">Открыть →</span>
        </button>
      </div>

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
                <div className="flex items-center gap-3 min-w-0">
                  {foundUser.avatar_url ? (
                    <img src={foundUser.avatar_url} alt="av" className="w-10 h-10 rounded-full object-cover border border-neutral-700 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-lg shrink-0">👻</div>
                  )}
                  <div className="min-w-0">
                    <p className="text-white font-bold text-sm truncate">
                      {foundUser.first_name}{foundUser.last_name ? ` ${foundUser.last_name}` : ""}
                      {foundUser.username && (
                        <a href={`https://t.me/${foundUser.username}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline ml-1">@{foundUser.username}</a>
                      )}
                    </p>
                    {foundUser.character_name && (
                      <p className="text-neutral-400 text-xs truncate">{foundUser.character_name} · тк. {foundUser.telekinesis_level ?? 1}</p>
                    )}
                  </div>
                </div>
                <button onClick={handleAddFoundFriend} disabled={requestSending} className="ml-3 shrink-0 px-4 py-2 bg-green-700 hover:bg-green-600 rounded-xl text-white text-xs font-bold transition-colors flex items-center gap-1 disabled:opacity-50">
                  {requestSending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} {requestSending ? "..." : outgoingRequests.some(r => r.to_telegram_id === foundUser?.telegram_id) ? "Заявка отправлена" : "Отправить заявку"}
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
                    <p className="text-neutral-400 text-xs mt-1">Попробуйте другое имя, @username или Telegram ID</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Incoming Friend Requests — always visible */}
        <section className="bg-neutral-900/80 backdrop-blur-md p-4 rounded-2xl border border-yellow-900/40 space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2 text-yellow-400">
            <UserPlus size={18} /> Заявки в друзья
            {incomingRequests.length > 0 && (
              <span className="bg-yellow-900/50 text-yellow-300 text-xs px-2 py-0.5 rounded-full font-black">{incomingRequests.length}</span>
            )}
          </h2>
          {incomingRequests.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-2">Нет входящих заявок</p>
          ) : (
            <div className="space-y-2">
              {incomingRequests.map(req => (
                <div key={req.id} className="flex items-center gap-3 bg-neutral-950/80 border border-neutral-800 rounded-xl p-3">
                  {req.avatar_url ? (
                    <img src={req.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-neutral-700 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-lg shrink-0">👻</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{req.from_character_name || req.first_name || "Бабай"}</p>
                    {req.username && <p className="text-neutral-500 text-xs">@{req.username}</p>}
                    <p className="text-neutral-600 text-[10px]">{new Date(req.created_at).toLocaleDateString("ru-RU")}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAcceptRequest(req)}
                      className="px-3 py-2 bg-green-800/60 hover:bg-green-700/80 border border-green-700/50 text-green-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <CheckCircle size={14} /> Принять
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(req)}
                      className="px-3 py-2 bg-red-900/40 hover:bg-red-800/60 border border-red-800/40 text-red-400 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <X size={14} /> Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-bold text-white">Список друзей ({friends.length})</h2>
          </div>
          {/* Search among existing friends */}
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
            <input
              value={friendSearch}
              onChange={e => setFriendSearch(e.target.value)}
              placeholder="Поиск по друзьям..."
              className="w-full bg-neutral-900/80 border border-neutral-800 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white focus:outline-none focus:border-red-900/50 transition-colors placeholder-neutral-600"
            />
            {friendSearch && (
              <button onClick={() => setFriendSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="space-y-3">
            {/* ДанИИл block */}
            {(!friendSearch || "ДанИИл".toLowerCase().includes(friendSearch.toLowerCase())) && (
            <div className="bg-neutral-900/80 backdrop-blur-md p-3 rounded-xl border border-green-900/30 flex flex-col gap-2">
              <div className="flex items-center gap-2 w-full min-w-0">
                <div className="relative shrink-0">
                  <img
                    src="https://i.ibb.co/rKGSq544/image.png"
                    alt="ДанИИл"
                    className="w-10 h-10 rounded-full object-cover border border-green-700/50 cursor-pointer"
                    onClick={() => setShowProfilePopup({ name: "ДанИИл" })}
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-neutral-900 bg-green-400 shadow-[0_0_5px_#4ade80]" />
                </div>
                <div
                  className="flex-1 min-w-0 cursor-pointer overflow-hidden"
                  onClick={() => setShowProfilePopup({ name: "ДанИИл" })}
                >
                  <p className="font-bold text-white text-sm truncate leading-tight">
                    ДанИИл <span className="text-xs text-green-400 font-normal ml-1">ИИ-куратор</span>
                  </p>
                  <p className="text-[11px] text-neutral-400 truncate leading-tight">Руководитель BABAI · Всегда онлайн</p>
                </div>
                <div className="flex gap-1 shrink-0 items-center">
                  <button
                    onClick={() => setEnergyModal({ friendName: "ДанИИл" })}
                    className="p-2 bg-neutral-800 hover:bg-yellow-900/40 rounded-lg text-yellow-500 transition-colors"
                    title="Поделиться энергией"
                  ><Zap size={15} /></button>
                </div>
              </div>
            </div>
            )}

            {/* Regular friends */}
            {friends.filter(f => f.name !== "ДанИИл").filter(f => {
              if (!friendSearch) return true;
              const sq = friendSearch.toLowerCase();
              const meta = friendsMeta[f.name] || {};
              return f.name.toLowerCase().includes(sq)
                || (meta.first_name || "").toLowerCase().includes(sq)
                || (meta.last_name || "").toLowerCase().includes(sq)
                || (meta.username || "").toLowerCase().includes(sq);
            }).map((friend) => {
              const meta = friendsMeta[friend.name] || {};
              const avatarSrc = meta.avatar_url || `https://picsum.photos/seed/${friend.name}/100/100`;
              const tgLink = meta.username ? `https://t.me/${meta.username}` : null;
              const isOnline = meta.telegram_id ? !!onlineMap[meta.telegram_id] : false;

              return (
                <div key={friend.name} className="bg-neutral-900/80 backdrop-blur-md p-3 rounded-xl border border-neutral-800 flex flex-col gap-2">
                  <div className="flex items-center gap-2 w-full min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={avatarSrc} alt="avatar"
                        className="w-10 h-10 rounded-full object-cover border border-neutral-700 cursor-pointer"
                        onClick={() => setShowProfilePopup({ name: friend.name, telegramId: meta.telegram_id })}
                      />
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-neutral-900 ${isOnline ? 'bg-green-400 shadow-[0_0_5px_#4ade80]' : 'bg-neutral-600'}`} />
                    </div>
                    <div
                      className="flex-1 min-w-0 cursor-pointer overflow-hidden"
                      onClick={() => setShowProfilePopup({ name: friend.name, telegramId: meta.telegram_id })}
                    >
                      {(meta.first_name || meta.username) && (
                        <p className="text-[11px] text-neutral-400 truncate leading-tight">
                          {meta.first_name}{meta.last_name ? ` ${meta.last_name}` : ""}
                          {meta.username && tgLink && (
                            <a href={tgLink} target="_blank" rel="noreferrer"
                              className="text-blue-400 hover:underline ml-1"
                              onClick={e => e.stopPropagation()}>@{meta.username}</a>
                          )}
                        </p>
                      )}
                      <p className="font-bold text-white text-sm truncate leading-tight">
                        {friend.name}
                        <span className="text-neutral-500 font-normal text-xs ml-1">· тк. {meta.telekinesis_level ?? 1}</span>
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0 items-center">
                      <button
                        onClick={() => setEnergyModal({ friendName: friend.name, telegramId: meta.telegram_id })}
                        className="p-2 bg-neutral-800 hover:bg-yellow-900/40 rounded-lg text-yellow-500 transition-colors"
                        title="Поделиться энергией"
                      ><Zap size={15} /></button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Удалить ${friend.name}?`)) return;
                          deleteFriend(friend.name);
                          if (profile?.telegram_id) {
                            // Delete A→B
                            await supabase.from("friends").delete()
                              .eq("telegram_id", profile.telegram_id).eq("friend_name", friend.name);
                            // Delete B→A (mutual)
                            if (meta.telegram_id) {
                              const myName = character?.name || "";
                              if (myName) {
                                await supabase.from("friends").delete()
                                  .eq("telegram_id", meta.telegram_id).eq("friend_telegram_id", profile.telegram_id);
                              }
                            }
                            setFriendsMeta(prev => { const n = { ...prev }; delete n[friend.name]; return n; });
                          }
                        }}
                        className="p-2 bg-neutral-800 hover:bg-red-900/50 rounded-lg text-red-500 transition-colors"
                      ><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>

      {/* Energy Gift Modal */}
      <AnimatePresence>
        {energyModal && (
          <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full max-w-sm rounded-2xl p-6 space-y-5"
              style={{
                background: "linear-gradient(180deg, rgba(30,30,40,0.97), rgba(20,20,30,0.99))",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
              }}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Zap size={18} className="text-yellow-500" /> Поделиться энергией
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">Для: <span className="text-white font-semibold">{energyModal.friendName}</span></p>
                </div>
                <button onClick={() => setEnergyModal(null)} className="text-neutral-500 hover:text-white"><X size={22} /></button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400">Количество энергии:</span>
                  <span className="text-yellow-400 font-bold text-lg">{energyAmount} ⚡</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, usePlayerStore.getState().energy)}
                  value={energyAmount}
                  onChange={e => setEnergyAmount(Number(e.target.value))}
                  className="w-full accent-yellow-500"
                />
                <div className="flex justify-between text-[10px] text-neutral-600">
                  <span>1</span>
                  <span>У тебя: {usePlayerStore.getState().energy} ⚡</span>
                </div>
              </div>

              <button
                onClick={handleSendEnergy}
                disabled={energySending || usePlayerStore.getState().energy < energyAmount}
                className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, rgba(161,130,0,0.8), rgba(200,160,0,0.7))",
                  border: "1px solid rgba(255,200,0,0.3)",
                  boxShadow: "0 3px 12px rgba(200,160,0,0.3)",
                }}
              >
                {energySending ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                {energySending ? "Отправка..." : `Подарить ${energyAmount} ⚡`}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Social links popup trigger */}
      <div className="relative z-10 px-4 pb-6">
        <button
          onClick={() => setShowSocialPopup(true)}
          className="w-full flex items-center gap-3 p-3 bg-neutral-900/70 backdrop-blur-sm border border-neutral-800 rounded-xl hover:border-neutral-600 transition-all"
        >
          <Link size={16} className="text-neutral-400" />
          <span className="font-bold text-white text-sm">Ссылки и сообщество</span>
        </button>
      </div>

      {/* Social links popup */}
      <AnimatePresence>
        {showSocialPopup && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSocialPopup(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-2xl p-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-center mb-3">
                <button onClick={() => setShowSocialPopup(false)} className="p-2 bg-neutral-800 rounded-full hover:bg-neutral-700 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <SocialLinksBlock />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
