import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { BarChart3, Users, Zap, TrendingUp, Activity, MessageSquare, Image, Trophy, RefreshCw, Loader2 } from "lucide-react";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";

interface Stats {
  total_players: number;
  active_players: number;
  total_fear: number;
  total_watermelons: number;
  total_clicks: number;
  messages_24h: number;
  gallery_images: number;
  achievements_unlocked: number;
}

interface DailyActivity {
  day: string;
  messages: number;
}

export default function AdminStat() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [daily, setDaily] = useState<DailyActivity[]>([]);
  const [topPlayers, setTopPlayers] = useState<{ character_name: string | null; fear: number; telegram_id: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [msgs] = await Promise.all([
      supabase.from("chat_messages")
        .select("created_at")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at"),
      supabase.from("player_stats")
        .select("character_name, fear, telegram_id")
        .order("fear", { ascending: false })
        .limit(5),
    ]);

    // Aggregate stats via separate queries
    const [pCount, sData, chatCount, galCount, achCount] = await Promise.all([
      supabase.from("profiles").select("telegram_id", { count: "exact", head: true }),
      supabase.from("player_stats").select("fear, watermelons, total_clicks, game_status"),
      supabase.from("chat_messages")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      supabase.from("gallery").select("id", { count: "exact", head: true }),
      supabase.from("player_achievements").select("id", { count: "exact", head: true }),
    ]);

    const sd = sData.data || [];
    setStats({
      total_players: pCount.count ?? 0,
      active_players: sd.filter(s => s.game_status === "playing").length,
      total_fear: sd.reduce((s, r) => s + (r.fear || 0), 0),
      total_watermelons: sd.reduce((s, r) => s + (r.watermelons || 0), 0),
      total_clicks: sd.reduce((s, r) => s + (r.total_clicks || 0), 0),
      messages_24h: chatCount.count ?? 0,
      gallery_images: galCount.count ?? 0,
      achievements_unlocked: achCount.count ?? 0,
    });

    // Build daily chart (last 7 days)
    const allMsgs = msgs.data || [];
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toLocaleDateString("ru-RU", { weekday: "short" });
      days[key] = 0;
    }
    allMsgs.forEach(m => {
      const d = new Date(m.created_at);
      const key = d.toLocaleDateString("ru-RU", { weekday: "short" });
      if (key in days) days[key]++;
    });
    setDaily(Object.entries(days).map(([day, messages]) => ({ day, messages })));

    if (top.data) setTopPlayers(top.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
  const maxDaily = Math.max(...daily.map(d => d.messages), 1);

  const statCards = stats ? [
    { label: "Всего игроков", value: fmt(stats.total_players), icon: <Users size={22} className="text-blue-400" />, color: "text-blue-400" },
    { label: "Активных", value: fmt(stats.active_players), icon: <Activity size={22} className="text-green-400" />, color: "text-green-400" },
    { label: "Суммарный Страх", value: fmt(stats.total_fear), icon: <Zap size={22} className="text-red-400" />, color: "text-red-400" },
    { label: "Суммарные Арбузы", value: fmt(stats.total_watermelons), icon: <TrendingUp size={22} className="text-green-400" />, color: "text-green-400" },
    { label: "Сообщений за 24ч", value: fmt(stats.messages_24h), icon: <MessageSquare size={22} className="text-purple-400" />, color: "text-purple-400" },
    { label: "Фото в галерее", value: fmt(stats.gallery_images), icon: <Image size={22} className="text-yellow-400" />, color: "text-yellow-400" },
    { label: "Ачивок выдано", value: fmt(stats.achievements_unlocked), icon: <Trophy size={22} className="text-yellow-500" />, color: "text-yellow-500" },
    { label: "Всего кликов", value: fmt(stats.total_clicks), icon: <BarChart3 size={22} className="text-neutral-400" />, color: "text-neutral-400" },
  ] : [];

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container"><div className="fog-layer"></div><div className="fog-layer-2"></div></div>

      <Header title={<><BarChart3 size={20} /> Статистика</>} backUrl="/admin" />

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-500">Данные из Supabase в реальном времени</p>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Обновить
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-red-500" /></div>
        ) : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {statCards.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center shrink-0">
                    {s.icon}
                  </div>
                  <div>
                    <p className={`text-2xl font-black font-mono ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider mt-0.5">{s.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Activity chart */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <MessageSquare size={16} className="text-purple-400" /> Сообщений за 7 дней
              </h3>
              <div className="flex items-end gap-1.5 h-28 justify-between">
                {daily.map((d, i) => {
                  const pct = maxDaily > 0 ? (d.messages / maxDaily) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-neutral-600 font-mono">{d.messages || ""}</span>
                      <div className="w-full bg-neutral-800 rounded-t-sm relative" style={{ height: "72px" }}>
                        <motion.div
                          className="absolute bottom-0 w-full bg-purple-700/60 border-t border-purple-500 rounded-t-sm"
                          initial={{ height: 0 }}
                          animate={{ height: `${pct}%` }}
                          transition={{ duration: 0.5, delay: i * 0.05 }}
                        />
                      </div>
                      <span className="text-[9px] text-neutral-500">{d.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top players */}
            {topPlayers.length > 0 && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                <h3 className="text-sm font-bold text-white p-4 border-b border-neutral-800 flex items-center gap-2">
                  <Zap size={16} className="text-red-500" /> Топ по Страху
                </h3>
                {topPlayers.map((p, i) => (
                  <div key={p.telegram_id} className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-800/50 last:border-0">
                    <span className={`text-xs font-black w-5 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-neutral-300" : "text-neutral-500"}`}>#{i + 1}</span>
                    <span className="flex-1 text-sm text-white truncate">{p.character_name || `#${p.telegram_id}`}</span>
                    <span className="text-red-400 font-bold text-sm">{fmt(p.fear)} 😱</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
