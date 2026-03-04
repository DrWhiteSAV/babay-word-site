import { useState } from "react";
import { usePlayerStore } from "../store/playerStore";
import { motion } from "motion/react";
import { Save, ArrowLeft, ShoppingCart, Settings2, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AdminStore() {
  const navigate = useNavigate();
  const { storeConfig, updateStoreConfig, shopItems, bossItems, updateShopItem, updateBossItem } = usePlayerStore();
  
  const [config, setConfig] = useState({ ...storeConfig });
  const [localShopItems, setLocalShopItems] = useState([...shopItems]);
  const [localBossItems, setLocalBossItems] = useState([...bossItems]);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const handleChange = (key: keyof typeof config, value: string) => {
    const numValue = parseFloat(value);
    setConfig(prev => ({
      ...prev,
      [key]: isNaN(numValue) ? 0 : numValue
    }));
  };

  const handleSave = () => {
    updateStoreConfig(config);
    localShopItems.forEach(item => updateShopItem(item.id, item));
    localBossItems.forEach(item => updateBossItem(item.id, item));
    alert("Настройки магазина и калькуляции сохранены!");
  };

  const handleShopItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...localShopItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setLocalShopItems(newItems);
  };

  const handleBossItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...localBossItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setLocalBossItems(newItems);
  };

  const ItemRow = ({
    item,
    index,
    onChange,
  }: {
    item: typeof localShopItems[0];
    index: number;
    onChange: (index: number, field: string, value: string | number) => void;
  }) => {
    const isExpanded = expandedItem === item.id;
    return (
      <div className="bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden">
        {/* Compact row */}
        <div
          className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center p-2 cursor-pointer hover:bg-neutral-900/50 transition-colors"
          onClick={() => setExpandedItem(isExpanded ? null : item.id)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg shrink-0">{item.icon}</span>
            <span className="text-xs text-white font-medium truncate">{item.name}</span>
          </div>
          <input
            type="text"
            value={item.icon}
            onClick={e => e.stopPropagation()}
            onChange={(e) => onChange(index, 'icon', e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-red-500 w-full"
            placeholder="Иконка"
          />
          <input
            type="number"
            value={item.cost}
            onClick={e => e.stopPropagation()}
            onChange={(e) => onChange(index, 'cost', parseInt(e.target.value) || 0)}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-red-500 w-full"
          />
          <button className="text-neutral-600 hover:text-white text-xs px-1 shrink-0">
            {isExpanded ? "▲" : "▼"}
          </button>
        </div>
        {/* Expanded details */}
        {isExpanded && (
          <div className="p-3 border-t border-neutral-800 space-y-2 bg-neutral-950">
            <div>
              <label className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Название</label>
              <input
                type="text"
                value={item.name}
                onChange={(e) => onChange(index, 'name', e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Тип / категория</label>
              <input
                type="text"
                value={item.type}
                onChange={(e) => onChange(index, 'type', e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Ссылка на иконку (URL или эмодзи)</label>
              <input
                type="text"
                value={item.icon}
                onChange={(e) => onChange(index, 'icon', e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                placeholder="🎭 или https://..."
              />
            </div>
            <div>
              <label className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Описание</label>
              <textarea
                value={item.description}
                onChange={(e) => onChange(index, 'description', e.target.value)}
                rows={2}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500 resize-none"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col bg-neutral-950 text-neutral-200 relative overflow-y-auto h-screen"
    >
      <div className="p-4 md:p-6 max-w-4xl mx-auto w-full pb-24">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => navigate("/admin")}
            className="p-2 bg-neutral-900 rounded-xl hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-red-500" />
            Настройки магазина
          </h1>
        </div>

        <div className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-800 mb-6 text-xs text-neutral-400">
          Настройте стоимости, множители и товары магазина. Кликните на товар для редактирования описания и иконки.
        </div>

        <div className="space-y-6">
          {/* Telekinesis Config */}
          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-4">
            <h2 className="text-base font-bold text-red-400 flex items-center gap-2 border-b border-neutral-800 pb-2">
              <Settings2 size={16} /> Прокачка Телекинеза
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { key: 'telekinesisBaseCost', label: 'Базовая стоимость (Страх)' },
                { key: 'telekinesisCostMultiplier', label: 'Множитель стоимости' },
                { key: 'telekinesisRewardBonus', label: 'Бонус страха за уровень' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">{label}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={config[key as keyof typeof config]}
                    onChange={(e) => handleChange(key as keyof typeof config, e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Boss Config */}
          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-4">
            <h2 className="text-base font-bold text-red-400 flex items-center gap-2 border-b border-neutral-800 pb-2">
              <Settings2 size={16} /> Усиление Босса
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { key: 'bossBaseCost', label: 'Базовая стоимость (Арбузы)' },
                { key: 'bossCostMultiplier', label: 'Множитель стоимости' },
                { key: 'bossRewardBase', label: 'Базовая награда (Арбузы)' },
                { key: 'bossRewardMultiplier', label: 'Множитель награды' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">{label}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={config[key as keyof typeof config]}
                    onChange={(e) => handleChange(key as keyof typeof config, e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Energy Config */}
          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-3">
            <h2 className="text-base font-bold text-red-400 flex items-center gap-2 border-b border-neutral-800 pb-2">
              <Settings2 size={16} /> Энергия
            </h2>
            <div>
              <label className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Время восстановления (минуты)</label>
              <input
                type="number"
                value={config.energyRegenMinutes}
                onChange={(e) => handleChange('energyRegenMinutes', e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500 text-sm max-w-xs"
              />
            </div>
          </div>

          {/* Shop Items */}
          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-3">
            <h2 className="text-base font-bold text-red-400 flex items-center gap-2 border-b border-neutral-800 pb-2">
              <Package size={16} /> Товары за Страх
              <span className="text-xs text-neutral-500 font-normal ml-auto">Клик — развернуть</span>
            </h2>
            <div className="text-[10px] text-neutral-600 grid grid-cols-[2fr_1fr_1fr_auto] gap-2 px-2">
              <span>Название</span><span>Иконка</span><span>Стоимость</span><span></span>
            </div>
            <div className="space-y-1">
              {localShopItems.map((item, index) => (
                <ItemRow key={item.id} item={item} index={index} onChange={handleShopItemChange} />
              ))}
            </div>
          </div>

          {/* Boss Items */}
          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-3">
            <h2 className="text-base font-bold text-red-400 flex items-center gap-2 border-b border-neutral-800 pb-2">
              <Package size={16} /> Экипировка для Боссов
              <span className="text-xs text-neutral-500 font-normal ml-auto">Клик — развернуть</span>
            </h2>
            <div className="text-[10px] text-neutral-600 grid grid-cols-[2fr_1fr_1fr_auto] gap-2 px-2">
              <span>Название</span><span>Иконка</span><span>Стоимость (🍉)</span><span></span>
            </div>
            <div className="space-y-1">
              {localBossItems.map((item, index) => (
                <ItemRow key={item.id} item={item} index={index} onChange={handleBossItemChange} />
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="mt-6 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <Save className="w-5 h-5" />
          Сохранить настройки
        </button>
      </div>
    </motion.div>
  );
}
