import { useState } from "react";
import { motion } from "motion/react";
import { Type, Save, RotateCcw } from "lucide-react";
import Header from "../components/Header";
import { DEFAULT_TEXTS } from "../config/defaultSettings";

const PAGE_LABELS: Record<string, string> = {
  home: "Главная",
  hub: "Хаб",
  shop: "Магазин",
  profile: "Профиль",
  settings: "Настройки",
  char: "Создание персонажа",
  friends: "Друзья",
  chat: "Чат",
  game: "Игра",
  leaderboard: "Рейтинг",
  events: "События",
  gallery: "Галерея",
  admin: "Админ",
  roles: "Роли",
};

function getPage(id: string): string {
  const prefix = id.split("_")[0];
  return PAGE_LABELS[prefix] || prefix;
}

export default function AdminText() {
  const [texts, setTexts] = useState<Record<string, string>>({ ...DEFAULT_TEXTS });
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(false);

  const pages = ["all", ...Array.from(new Set(Object.keys(DEFAULT_TEXTS).map(k => k.split("_")[0])))];

  const filtered = Object.entries(texts).filter(([key]) => {
    const pageMatch = filter === "all" || key.startsWith(filter + "_");
    const searchMatch = !search || key.includes(search.toLowerCase()) || texts[key].toLowerCase().includes(search.toLowerCase());
    return pageMatch && searchMatch;
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    alert("Тексты сохранены!");
  };

  const handleReset = () => {
    if (confirm("Сбросить все тексты к значениям по умолчанию?")) {
      setTexts({ ...DEFAULT_TEXTS });
    }
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

      <Header
        title={<><Type size={20} /> Управление текстами</>}
        backUrl="/admin"
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-800 text-xs text-neutral-400">
          Все тексты приложения. Редактируйте прямо в таблице.
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Поиск..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[140px] bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
          />
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
          >
            {pages.map(p => (
              <option key={p} value={p}>
                {p === "all" ? "Все страницы" : (PAGE_LABELS[p] || p)}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-neutral-500 uppercase bg-neutral-900/80 border-b border-neutral-800">
                <tr>
                  <th className="px-3 py-2 text-left w-24">Страница</th>
                  <th className="px-3 py-2 text-left w-40">Ключ</th>
                  <th className="px-3 py-2 text-left">Текст</th>
                  <th className="px-3 py-2 text-left w-20">Сброс</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(([key, value]) => (
                  <tr key={key} className="border-b border-neutral-800/50 hover:bg-neutral-800/20 transition-colors">
                    <td className="px-3 py-1.5">
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
                        {getPage(key)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="text-[10px] text-neutral-500 font-mono break-all">{key}</span>
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-white text-xs focus:border-red-500 outline-none transition-colors"
                        value={value}
                        onChange={(e) => setTexts(prev => ({ ...prev, [key]: e.target.value }))}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() => setTexts(prev => ({ ...prev, [key]: DEFAULT_TEXTS[key] }))}
                        className="p-1.5 text-neutral-600 hover:text-red-400 transition-colors"
                        title="Сбросить к исходнику"
                      >
                        <RotateCcw size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 text-xs text-neutral-600 border-t border-neutral-800">
            Показано {filtered.length} из {Object.keys(texts).length} строк
          </div>
        </div>

        <div className="flex gap-3 pb-6">
          <button
            onClick={handleReset}
            className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 border border-neutral-700"
          >
            <RotateCcw size={16} />
            Сбросить всё
          </button>
          <button
            onClick={handleSave}
            className={`flex-1 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 border ${saved ? "bg-green-900/50 border-green-700 text-green-400" : "bg-red-900/80 hover:bg-red-800 text-white border-red-700"}`}
          >
            <Save size={16} />
            {saved ? "Сохранено!" : "Сохранить"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
