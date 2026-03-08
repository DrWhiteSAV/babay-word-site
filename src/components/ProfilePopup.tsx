import { motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePlayerStore } from "../store/playerStore";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";

interface ProfilePopupProps {
  name: string;
  telegramId?: number;
  onClose: () => void;
}

interface RemoteProfile {
  avatarUrl: string;
  gender?: string;
  style?: string;
  fear: number;
  energy: number;
  watermelons: number;
  telekinesisLevel: number;
  bossLevel: number;
  lore: string;
  inventory: string[];
  first_name?: string;
  last_name?: string;
  username?: string;
}

export default function ProfilePopup({ name, telegramId, onClose }: ProfilePopupProps) {
  const { character, fear, energy, watermelons, bossLevel, shopItems, bossItems } = usePlayerStore();
  const { profile } = useTelegram();
  const isUser = name === character?.name || name === "user";

  const [remoteData, setRemoteData] = useState<RemoteProfile | null>(null);
  const [userInventory, setUserInventory] = useState<string[]>([]);
  const [loading, setLoading] = useState((!isUser && !!telegramId) || isUser);

  // Load current user's inventory from DB
  useEffect(() => {
    if (!isUser || !profile?.telegram_id) {
      if (isUser) setLoading(false);
      return;
    }
    supabase
      .from("player_inventory")
      .select("item_id")
      .eq("telegram_id", profile.telegram_id)
      .then(({ data }) => {
        setUserInventory((data || []).map(i => i.item_id));
        setLoading(false);
      });
  }, [isUser, profile?.telegram_id]);

  // Load remote user data
  useEffect(() => {
    if (isUser || !telegramId) return;
    const load = async () => {
      setLoading(true);
      const [statsRes, profRes, invRes] = await Promise.all([
        supabase.from("player_stats").select("avatar_url, character_gender, character_style, fear, energy, watermelons, telekinesis_level, boss_level, lore").eq("telegram_id", telegramId).single(),
        supabase.from("profiles").select("first_name, last_name, username").eq("telegram_id", telegramId).single(),
        supabase.from("player_inventory").select("item_id").eq("telegram_id", telegramId),
      ]);
      const s = statsRes.data;
      const p = profRes.data;
      setRemoteData({
        avatarUrl: s?.avatar_url || `https://picsum.photos/seed/${name}/200/200`,
        gender: s?.character_gender || undefined,
        style: s?.character_style || undefined,
        fear: s?.fear ?? 0,
        energy: s?.energy ?? 0,
        watermelons: s?.watermelons ?? 0,
        telekinesisLevel: s?.telekinesis_level ?? 1,
        bossLevel: s?.boss_level ?? 1,
        lore: s?.lore || "История умалчивает...",
        inventory: (invRes.data || []).map(i => i.item_id),
        first_name: p?.first_name,
        last_name: p?.last_name ?? undefined,
        username: p?.username ?? undefined,
      });
      setLoading(false);
    };
    load();
  }, [telegramId, isUser, name]);

  const isDanil = name === "ДанИИл";

  const getMockData = (seedName: string): RemoteProfile => {
    let hash = 0;
    for (let i = 0; i < seedName.length; i++) hash = seedName.charCodeAt(i) + ((hash << 5) - hash);
    const absHash = Math.abs(hash);
    return {
      avatarUrl: isDanil ? "https://i.ibb.co/rKGSq544/image.png" : `https://picsum.photos/seed/${seedName}/200/200`,
      gender: isDanil ? "Бабай" : (absHash % 2 === 0 ? "Бабай" : "Бабайка"),
      style: isDanil ? "Киберпанк" : ["Фотореализм","Хоррор","Стимпанк","Киберпанк","Аниме","Постсоветский"][absHash % 6],
      fear: isDanil ? 999999 : (absHash % 10000) + 1000,
      energy: isDanil ? 9999 : (absHash % 500) + 50,
      watermelons: isDanil ? 999 : (absHash % 100) + 10,
      telekinesisLevel: isDanil ? 99 : (absHash % 10) + 1,
      bossLevel: isDanil ? 99 : (absHash % 5) + 1,
      lore: isDanil
        ? "ДанИИл — Главный ИИ-начальник. Строг, но справедлив. Требует регулярных отчётов о выселении. Создан из чистого кода и первобытного страха."
        : "Один из бабаев, работающих в соседнем районе. Известен своими нестандартными методами запугивания.",
      inventory: isDanil ? ["boss_1","boss_2"] : [],
    };
  };

  const allItems = [...shopItems, ...bossItems];

  const data: RemoteProfile = isUser
    ? {
        avatarUrl: character?.avatarUrl || "https://picsum.photos/seed/user/200/200",
        gender: character?.gender,
        style: character?.style,
        fear, energy, watermelons,
        telekinesisLevel: character?.telekinesisLevel || 1,
        bossLevel,
        lore: character?.lore || "История умалчивает...",
        inventory: userInventory,
      }
    : (remoteData || getMockData(name));

  // Resolve ONLY purchased items — filter strictly by what's in inventory list
  // For mock data (no telegramId, not real user), show empty inventory
  const rawInventory = (!isUser && !telegramId && !isDanil) ? [] : data.inventory;
  const inventoryItems = rawInventory
    .map(id => allItems.find(i => i.id === id))
    .filter(Boolean) as typeof allItems;

  const displayName = isUser ? character?.name : name;
  const tgLink = data.username ? `https://t.me/${data.username}` : null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-sm w-full max-h-[85vh] overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4 sticky top-0 bg-neutral-900 z-10 pb-2 border-b border-neutral-800">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider">Профиль</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white"><X size={24} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-500">
            <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Загрузка...
          </div>
        ) : (
          <div className="space-y-4">
            <img
              src={data.avatarUrl}
              alt="avatar"
              className={`w-full aspect-square object-cover rounded-xl border-2 ${isUser ? 'border-red-900/50' : 'border-neutral-700'}`}
            />

            <div>
              {/* Telegram name + username link */}
              {!isUser && !isDanil && (data.first_name || data.username) && (
                <p className="text-sm text-neutral-400 mb-0.5">
                  {data.first_name}{data.last_name ? ` ${data.last_name}` : ""}
                  {tgLink && (
                    <a href={tgLink} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline ml-1">
                      @{data.username}
                    </a>
                  )}
                </p>
              )}
              <h3 className={`text-2xl font-black uppercase ${isUser ? 'text-red-500' : 'text-white'}`}>{displayName}</h3>
              <p className="text-neutral-400 text-sm">
                {data.gender} • {data.style}
                {!isUser && !isDanil && <span className="text-blue-400"> · тк. {data.telekinesisLevel}</span>}
              </p>
            </div>

            <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800">
              <h4 className="text-xs font-bold text-neutral-500 uppercase mb-1">История духа</h4>
              <p className="text-sm text-neutral-300">{data.lore}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <span className="text-xs text-neutral-500 block">Энергия</span>
                <span className="text-yellow-500 font-bold">{data.energy}</span>
              </div>
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <span className="text-xs text-neutral-500 block">Страх</span>
                <span className="text-red-500 font-bold">{data.fear}</span>
              </div>
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <span className="text-xs text-neutral-500 block">Арбузы</span>
                <span className="text-green-500 font-bold">{data.watermelons}</span>
              </div>
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <span className="text-xs text-neutral-500 block">Телекинез</span>
                <span className="text-blue-400 font-bold">{data.telekinesisLevel} ур.</span>
              </div>
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 col-span-2">
                <span className="text-xs text-neutral-500 block">Уровень босса</span>
                <span className="text-purple-400 font-bold">{data.bossLevel} ур.</span>
              </div>
            </div>

            {/* Inventory */}
            <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800">
              <h4 className="text-xs font-bold text-neutral-500 uppercase mb-3">
                Инвентарь {inventoryItems.length > 0 ? `(${inventoryItems.length})` : ""}
              </h4>
              {inventoryItems.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {inventoryItems.map((item, i) => (
                    <div
                      key={i}
                      className="bg-neutral-900 border border-neutral-800 rounded-xl p-2 flex flex-col items-center text-center gap-1.5 hover:border-neutral-600 transition-colors"
                    >
                      {/* Big emoji icon like in the shop */}
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-3xl bg-neutral-800 border border-neutral-700">
                        {item.icon}
                      </div>
                      <span className="text-[10px] font-bold text-white leading-tight line-clamp-2">{item.name}</span>
                      <span className="text-[9px] text-neutral-500 line-clamp-1">{item.type}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500">Пусто</p>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
