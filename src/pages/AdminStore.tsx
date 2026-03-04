import { useState, useEffect } from "react";
import { usePlayerStore } from "../store/playerStore";
import { motion } from "motion/react";
import { Save, ArrowLeft, ShoppingCart, Settings2, Package, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { DEFAULT_SHOP_ITEMS, DEFAULT_BOSS_ITEMS, DEFAULT_STORE_CONFIG } from "../config/defaultSettings";

export default function AdminStore() {
  const navigate = useNavigate();
  const { storeConfig, updateStoreConfig, updateShopItem, updateBossItem } = usePlayerStore();

  const [config, setConfig] = useState({ ...storeConfig });
  const [localShopItems, setLocalShopItems] = useState([...DEFAULT_SHOP_ITEMS]);
  const [localBossItems, setLocalBossItems] = useState([...DEFAULT_BOSS_ITEMS]);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [itemsRes, configRes] = await Promise.all([
        supabase.from("shop_items").select("*").order("sort_order"),
        supabase.from("store_config").select("key, value"),
      ]);
      if (itemsRes.data && itemsRes.data.length > 0) {
        const normalize = (items: typeof itemsRes.data) =>
          items.map(i => ({ ...i, description: i.description ?? "" }));
        const shopItems = normalize(itemsRes.data.filter(i => i.currency === "fear"));
        const bossItems = normalize(itemsRes.data.filter(i => i.currency === "watermelons"));
        if (shopItems.length > 0) setLocalShopItems(shopItems as typeof DEFAULT_SHOP_ITEMS);
        if (bossItems.length > 0) setLocalBossItems(bossItems as typeof DEFAULT_BOSS_ITEMS);
      }
      if (configRes.data && configRes.data.length > 0) {
        const merged = { ...DEFAULT_STORE_CONFIG } as Record<string, number>;
        configRes.data.forEach(r => { merged[r.key] = Number(r.value); });
        setConfig(merged as unknown as typeof storeConfig);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleChange = (key: keyof typeof config, value: string) => {
    const numValue = parseFloat(value);
    setConfig(prev => ({ ...prev, [key]: isNaN(numValue) ? 0 : numValue }));
  };

  const handleSave = async () => {
    setSaving(true);
    const allItems = [...localShopItems.map((item, i) => ({ ...item, sort_order: i })),
                      ...localBossItems.map((item, i) => ({ ...item, sort_order: i }))];
    const configRows = Object.entries(config).map(([key, value]) => ({ key, value: Number(value) }));

    const [itemsErr, configErr] = await Promise.all([
      supabase.from("shop_items").upsert(allItems, { onConflict: "id" }).then(r => r.error),
      supabase.from("store_config").upsert(configRows, { onConflict: "key" }).then(r => r.error),
    ]);
    setSaving(false);
    if (itemsErr || configErr) { alert("Ошибка: " + (itemsErr?.message || configErr?.message)); return; }

    updateStoreConfig(config);
    localShopItems.forEach(item => updateShopItem(item.id, item));
    localBossItems.forEach(item => updateBossItem(item.id, item));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleShopItemChange = (index: number, field: string, value: string | number) => {
    setLocalShopItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleBossItemChange = (index: number, field: string, value: string | number) => {
    setLocalBossItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const ItemRow = ({ item, index, onChange }: {
    item: typeof localShopItems[0]; index: number;
    onChange: (index: number, field: string, value: string | number) => void;
  }) => {
    const isExpanded = expandedItem === item.id;
    return (
      <div className="bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center p-2 cursor-pointer hover:bg-neutral-900/50 transition-colors"
          onClick={() => setExpandedItem(isExpanded ? null : item.id)}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg shrink-0">{item.icon}</span>
            <span className="text-xs text-white font-medium truncate">{item.name}</span>
          </div>
          <input type="text" value={item.icon} onClick={e => e.stopPropagation()}
            onChange={(e) => onChange(index, 'icon', e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-red-500 w-full" placeholder="Иконка" />
          <input type="number" value={item.cost} onClick={e => e.stopPropagation()}
            onChange={(e) => onChange(index, 'cost', parseInt(e.target.value) || 0)}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-red-500 w-full" />
          <button className="text-neutral-600 hover:text-white text-xs px-1 shrink-0">{isExpanded ? "▲" : "▼"}</button>
        </div>
        {isExpanded && (
          <div className="p-3 border-t border-neutral-800 space-y-2 bg-neutral-950">
            {[
              { field: 'name', label: 'Название', type: 'text' },
              { field: 'type', label: 'Тип / категория', type: 'text' },
              { field: 'icon', label: 'Ссылка на иконку (URL или эмодзи)', type: 'text' },
            ].map(({ field, label, type }) => (
              <div key={field}>
                <label className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">{label}</label>
                <input type={type} value={(item as unknown as Record<string, string>)[field]}
                  onChange={(e) => onChange(index, field, e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500" />
              </div>
            ))}
            <div>
              <label className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Описание</label>
              <textarea value={item.description} onChange={(e) => onChange(index, 'description', e.target.value)}
                rows={2} className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500 resize-none" />
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-neutral-950">
        <Loader2 size={32} className="animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex-1 flex flex-col bg-neutral-950 text-neutral-200 relative overflow-y-auto h-screen">
      <div className="p-4 max-w-4xl mx-auto w-full pb-24">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate("/admin")} className="p-2 bg-neutral-900 rounded-xl hover:bg-neutral-800 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-red-500" /> Настройки магазина
          </h1>
        </div>
        <div className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-800 mb-4 text-xs text-neutral-400">
          Настройки магазина синхронизируются с Supabase при сохранении.
        </div>

        <div className="space-y-4">
          {/* Telekinesis Config */}
          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-3">
            <h2 className="text-sm font-bold text-red-400 flex items-center gap-2 border-b border-neutral-800 pb-2">
              <Settings2 size={14} /> Прокачка Телекинеза
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { key: 'telekinesisBaseCost', label: 'Баз. стоимость (Страх)' },
                { key: 'telekinesisCostMultiplier', label: 'Множитель стоимости' },
                { key: 'telekinesisRewardBonus', label: 'Бонус страха за уровень' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">{label}</label>
                  <input type="number" step="0.1" value={config[key as keyof typeof config]}
                    onChange={e => handleChange(key as keyof typeof config, e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500 text-sm" />
                </div>
              ))}
            </div>
          </div>

          {/* Boss Config */}
          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-3">
            <h2 className="text-sm font-bold text-red-400 flex items-center gap-2 border-b border-neutral-800 pb-2">
              <Settings2 size={14} /> Усиление Босса
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'bossBaseCost', label: 'Баз. стоимость (Арбузы)' },
                { key: 'bossCostMultiplier', label: 'Множитель стоимости' },
                { key: 'bossRewardBase', label: 'Баз. награда (Арбузы)' },
                { key: 'bossRewardMultiplier', label: 'Множитель награды' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">{label}</label>
                  <input type="number" step="0.1" value={config[key as keyof typeof config]}
                    onChange={e => handleChange(key as keyof typeof config, e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500 text-sm" />
                </div>
              ))}
            </div>
          </div>

          {/* Energy Config */}
          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-3">
            <h2 className="text-sm font-bold text-red-400 flex items-center gap-2 border-b border-neutral-800 pb-2">
              <Settings2 size={14} /> Энергия
            </h2>
            <div>
              <label className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Время восстановления (минуты)</label>
              <input type="number" value={config.energyRegenMinutes} onChange={e => handleChange('energyRegenMinutes', e.target.value)}
                className="w-full max-w-xs bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500 text-sm" />
            </div>
          </div>

          {/* Shop Items */}
          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-3">
            <h2 className="text-sm font-bold text-red-400 flex items-center gap-2 border-b border-neutral-800 pb-2">
              <Package size={14} /> Товары за Страх
              <span className="text-xs text-neutral-500 font-normal ml-auto">Клик — развернуть</span>
            </h2>
            <div className="space-y-1">
              {localShopItems.map((item, index) => (
                <ItemRow key={item.id} item={item} index={index} onChange={handleShopItemChange} />
              ))}
            </div>
          </div>

          {/* Boss Items */}
          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-3">
            <h2 className="text-sm font-bold text-red-400 flex items-center gap-2 border-b border-neutral-800 pb-2">
              <Package size={14} /> Экипировка для Боссов
              <span className="text-xs text-neutral-500 font-normal ml-auto">Клик — развернуть</span>
            </h2>
            <div className="space-y-1">
              {localBossItems.map((item, index) => (
                <ItemRow key={item.id} item={item} index={index} onChange={handleBossItemChange} />
              ))}
            </div>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className={`mt-6 w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors border ${saved ? "bg-green-900/50 border-green-700 text-green-400" : "bg-red-600 hover:bg-red-700 text-white border-red-500"}`}>
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          {saved ? "Сохранено!" : saving ? "Сохранение..." : "Сохранить настройки"}
        </button>
      </div>
    </motion.div>
  );
}
