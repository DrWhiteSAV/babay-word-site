import { useNavigate, useLocation } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { Home, ShoppingCart, Settings, Users, MessageSquare } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";

function useUnreadCount() {
  const { profile } = useTelegram();
  const { friends, groupChats } = usePlayerStore();
  const [count, setCount] = useState(0);
  const [friendTidMap, setFriendTidMap] = useState<Record<string, number>>({});

  // Load friend telegram_ids for correct canonical chat key construction
  useEffect(() => {
    if (!profile?.telegram_id) return;
    const realFriends = friends.filter(f => f.name !== "ДанИИл");
    if (realFriends.length === 0) return;
    supabase
      .from("player_stats")
      .select("telegram_id, character_name")
      .in("character_name", realFriends.map(f => f.name))
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, number> = {};
        for (const row of data) {
          if (row.character_name && row.telegram_id) map[row.character_name] = row.telegram_id;
        }
        setFriendTidMap(map);
      });
  }, [profile?.telegram_id, friends.length]);

  useEffect(() => {
    if (!profile?.telegram_id) return;

    const fetchUnread = async () => {
      // Personal chat keys: canonical sorted tid_tid
      const personalKeys = friends
        .filter(f => f.name !== "ДанИИл" && friendTidMap[f.name])
        .map(f => [String(profile.telegram_id), String(friendTidMap[f.name])].sort().join("_"));

      // Group chat keys
      const groupKeys = groupChats.map(g => `group_${g.id}`);

      const allKeys = [...personalKeys, ...groupKeys];
      if (allKeys.length === 0) { setCount(0); return; }

      const { count: unread } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .in("chat_key", allKeys)
        .neq("sender_telegram_id", profile.telegram_id)
        .is("read_at", null);

      setCount(unread || 0);
    };

    fetchUnread();

    // Re-check every 30s and on realtime inserts
    const channel = supabase
      .channel("unread_badge")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, fetchUnread)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages" }, fetchUnread)
      .subscribe();

    const interval = setInterval(fetchUnread, 30_000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [profile?.telegram_id, friends.length, groupChats.length, friendTidMap]);

  return count;
}

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { character } = usePlayerStore();
  const unreadCount = useUnreadCount();

  const navItems = [
    { path: "/hub", icon: <Home size={24} />, label: "Главная" },
    { path: "/shop", icon: <ShoppingCart size={24} />, label: "Магазин" },
    {
      path: "/profile",
      icon: character?.avatarUrl ? (
        <img src={character.avatarUrl} alt="profile" className="w-6 h-6 rounded-full object-cover border border-neutral-500" />
      ) : (
        <div className="w-6 h-6 rounded-full bg-neutral-700 border border-neutral-500" />
      ),
      label: "Профиль",
    },
    { path: "/settings", icon: <Settings size={24} />, label: "Настройки" },
    {
      path: "/friends",
      icon: (
        <div className="relative">
          <Users size={24} />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center leading-none shadow-[0_0_6px_rgba(220,38,38,0.7)]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      ),
      label: "Друзья",
    },
  ];

  // Don't show on initial setup screens or game
  if (["/" , "/create", "/game"].includes(location.pathname)) return null;

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="md:hidden fixed bottom-0 left-0 right-0 bg-black/20 backdrop-blur-2xl border-t border-white/10 z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.3)]"
      style={{ fontSize: "16px" }}
    >
      <div className="flex justify-around items-center p-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <div
              role="button"
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`cursor-pointer relative flex flex-col items-center justify-center w-16 h-14 transition-colors ${
                isActive ? "text-white" : "text-neutral-500 hover:text-neutral-300"
              }`}
              style={{ clipPath: "none", padding: 0, borderRadius: "0.5rem" }}
            >
              <motion.div
                animate={{ scale: isActive ? 1.2 : 1, y: isActive ? -4 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {item.icon}
              </motion.div>
              <span className={`text-[10px] mt-1 transition-opacity ${isActive ? "opacity-100 font-bold" : "opacity-70"}`}>
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute -bottom-2 w-8 h-1 bg-white rounded-t-full"
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
