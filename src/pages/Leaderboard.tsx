import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { motion } from "motion/react";
import { Trophy, Medal, Star, Target, CheckCircle2, ChevronRight, UserPlus, Loader2, Zap, Shield, Flame, Leaf, Check } from "lucide-react";
import Header from "../components/Header";
import ProfilePopup from "../components/ProfilePopup";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";
import { notifyFriendAdded } from "../services/friendNotify";

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
  is_active: boolean;
}

type SortKey = "fear" | "watermelons" | "boss_level" | "energy" | "telekinesis_level";

const SORT_OPTIONS: { key: SortKey; label: string; icon: any; color: string }[] = [
  { key: "fear", label: "Страх", icon: Flame, color: "text-red-400" },
  { key: "watermelons", label: "Арбузы", icon: Leaf, color: "text-green-400" },
  { key: "boss_level", label: "Боссы", icon: Shield, color: "text-purple-400" },
  { key: "energy", label: "Энергия", icon: Zap, color: "text-yellow-400" },
  { key: "telekinesis_level", label: "Телекинез", icon: Star, color: "text-blue-400" },
];

interface LeaderboardEntry {
  telegram_id: number;
  character_name: string | null;
  avatar_url: string | null;
  fear: number;
  watermelons: number;
  boss_level: number;
  energy: number;
  telekinesis_level: number;
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const { character, achievements, friends, addFriend } = usePlayerStore();
  const { profile } = useTelegram();
  const [showProfilePopup, setShowProfilePopup] = useState<{ name: string; telegramId?: number } | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("fear");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingFriend, setAddingFriend] = useState<number | null>(null);
  const [addedFriends, setAddedFriends] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadLeaderboard();
  }, [sortBy]);

  // Pre-populate addedFriends from existing friends (by telegram_id via DB)
  useEffect(() => {
    if (!profile?.telegram_id) return;
    supabase
      .from("friends")
      .select("friend_telegram_id")
      .eq("telegram_id", profile.telegram_id)
      .then(({ data }) => {
        if (data) {
          setAddedFriends(new Set(data.map(f => f.friend_telegram_id).filter(Boolean) as number[]));
        }
      });
  }, [profile?.telegram_id]);

  const loadLeaderboard = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("player_stats")
      .select("telegram_id, character_name, avatar_url, fear, watermelons, boss_level, energy, telekinesis_level")
      .order(sortBy, { ascending: false })
      .limit(50);

    if (!error && data) setLeaderboard(data);
    setLoading(false);
  };

  const handleAddFriend = async (entry: LeaderboardEntry) => {
    if (!profile?.telegram_id || addingFriend === entry.telegram_id) return;
    setAddingFriend(entry.telegram_id);
    const displayName = entry.character_name || `Бабай #${entry.telegram_id}`;
    addFriend(displayName);
    await supabase.from("friends").upsert({
      telegram_id: profile.telegram_id,
      friend_name: displayName,
      friend_telegram_id: entry.telegram_id,
    }, { onConflict: "telegram_id,friend_name" });
    // Notify the added person in Telegram (fire-and-forget)
    notifyFriendAdded(profile.telegram_id, entry.telegram_id);
    setAddedFriends(prev => new Set([...prev, entry.telegram_id]));
    setAddingFriend(null);
  };

  const sortOption = SORT_OPTIONS.find(s => s.key === sortBy)!;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <Header
        title={<><Trophy size={20} className="text-yellow-500" /> Рейтинг</>}
        backUrl="/hub"
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-6 relative z-10">

        {/* Sort Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {SORT_OPTIONS.map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all shrink-0 ${
                sortBy === key
                  ? "bg-neutral-800 border-neutral-600 text-white"
                  : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-600"
              }`}
            >
              <Icon size={12} className={sortBy === key ? color : ""} />
              {label}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
            <Medal size={20} className="text-yellow-500" /> Топ Бабаев — {sortOption.label}
          </h2>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-red-500" /></div>
          ) : leaderboard.length === 0 ? (
            <p className="text-neutral-500 text-center py-8">Нет данных</p>
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
              {leaderboard.map((user, idx) => {
                const rank = idx + 1;
                const isUser = user.telegram_id === profile?.telegram_id;
                const displayName = user.character_name || `Бабай #${user.telegram_id}`;
                const alreadyFriend = isUser || addedFriends.has(user.telegram_id);
                const isAdding = addingFriend === user.telegram_id;
                const SortIcon = sortOption.icon;
                return (
                  <div
                    key={user.telegram_id}
                    className={`flex items-center gap-3 p-3 border-b border-neutral-800 last:border-0 ${isUser ? 'bg-red-900/20' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                      rank === 1 ? 'bg-yellow-500 text-black' :
                      rank === 2 ? 'bg-neutral-300 text-black' :
                      rank === 3 ? 'bg-amber-700 text-white' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      {rank}
                    </div>
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={displayName} className="w-10 h-10 rounded-full border border-neutral-700 object-cover shrink-0 cursor-pointer" onClick={() => setShowProfilePopup({ name: displayName, telegramId: user.telegram_id })} />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-lg shrink-0 cursor-pointer" onClick={() => setShowProfilePopup({ name: displayName, telegramId: user.telegram_id })}>
                        👻
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold text-sm truncate cursor-pointer hover:underline ${isUser ? 'text-red-400' : 'text-white'}`} onClick={() => setShowProfilePopup({ name: displayName, telegramId: user.telegram_id })}>
                        {displayName}{isUser ? " (Вы)" : ""}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-neutral-500">
                        <SortIcon size={10} className={sortOption.color} />
                        <span className={sortOption.color + " font-bold"}>{user[sortBy]}</span>
                        <span className="text-neutral-600">/ тк {user.telekinesis_level}</span>
                      </div>
                    </div>
                    {!isUser && (
                      <button
                        onClick={() => !alreadyFriend && handleAddFriend(user)}
                        disabled={alreadyFriend || isAdding}
                        className={`p-2 rounded-full transition-colors shrink-0 ${alreadyFriend ? 'bg-neutral-800 text-green-500 cursor-default' : 'bg-neutral-800 hover:bg-neutral-700 text-blue-400'}`}
                        title={alreadyFriend ? "Уже в друзьях" : "Добавить в друзья"}
                      >
                        {isAdding ? <Loader2 size={16} className="animate-spin" /> : alreadyFriend ? <Check size={16} /> : <UserPlus size={16} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Events Link */}
        <section>
          <button
            onClick={() => navigate('/events')}
            className="w-full bg-neutral-900 border border-neutral-800 hover:border-red-900/50 rounded-2xl p-4 flex items-center justify-between transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-900/20 text-red-500 flex items-center justify-center">
                <Target size={20} />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">Ивенты и Задания</h2>
                <p className="text-sm text-neutral-400">Ежедневные и глобальные квесты</p>
              </div>
            </div>
            <ChevronRight size={24} className="text-neutral-500 group-hover:text-white transition-colors" />
          </button>
        </section>

        {/* Achievements */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 size={20} className="text-green-500" /> Достижения
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {achievements.length === 0 ? (
              <p className="text-neutral-500 col-span-2 text-center py-4">Пока нет достижений</p>
            ) : (
              achievements.map(ach => (
                <div key={ach} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-900/30 text-green-500 flex items-center justify-center">
                    <Trophy size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">Ачивка {ach.replace('quest_', '')}</p>
                    <p className="text-xs text-neutral-500 truncate">Выполнено</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

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
