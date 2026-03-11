import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Save, ArrowLeft, Image as ImageIcon, Loader2, Info, Plus, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";

const GAME_DIMMING_KEY = "__game_generated_bg";

const PAGES = [
  { path: "/", name: "Главная (Home)" },
  { path: "/create", name: "Создание персонажа" },
  { path: "/hub", name: "Хаб (GameHub)" },
  { path: "/game", name: "Игра (Game)" },
  { path: "/shop", name: "Магазин (Shop)" },
  { path: "/profile", name: "Профиль (Profile)" },
  { path: "/settings", name: "Настройки (Settings)" },
  { path: "/friends", name: "Друзья (Friends)" },
  { path: "/chats", name: "Чаты (Chats)" },
  { path: "/chat", name: "Чат (Chat)" },
  { path: "/gallery", name: "Галерея (Gallery)" },
  { path: "/leaderboard", name: "Рейтинг (Leaderboard)" },
  { path: "/events", name: "События (Events)" },
  { path: "/achievements", name: "Достижения (Achievements)" },
];

type BgEntry = { url: string; dimming: number };
type BgMap = Record<string, BgEntry[]>;

export default function AdminPic() {
  const navigate = useNavigate();
  const [bgData, setBgData] = useState<BgMap>(() => {
    const initial: BgMap = {};
    PAGES.forEach(p => { initial[p.path] = []; });
    initial[GAME_DIMMING_KEY] = [{ url: "", dimming: 15 }];
    return initial;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewPopup, setPreviewPopup] = useState<BgEntry | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("page_backgrounds").select("page_path, url, dimming, sort_order");
      const map: BgMap = {};
      PAGES.forEach(p => { map[p.path] = []; });
      map[GAME_DIMMING_KEY] = [{ url: "", dimming: 15 }];
      if (data && data.length > 0) {
        data.forEach(d => {
          if (!map[d.page_path]) map[d.page_path] = [];
          if (d.page_path === GAME_DIMMING_KEY) {
            map[GAME_DIMMING_KEY] = [{ url: "", dimming: d.dimming ?? 15 }];
          } else {
            map[d.page_path].push({ url: d.url || "", dimming: d.dimming ?? 80 });
          }
        });
      }
      setBgData(map);
      setLoading(false);
    };
    load();
  }, []);

  const addEntry = (path: string) => {
    setBgData(prev => ({
      ...prev,
      [path]: [...(prev[path] || []), { url: "", dimming: 80 }]
    }));
  };

  const removeEntry = (path: string, index: number) => {
    setBgData(prev => ({
      ...prev,
      [path]: (prev[path] || []).filter((_, i) => i !== index)
    }));
  };

  const updateEntry = (path: string, index: number, field: "url" | "dimming", value: string | number) => {
    setBgData(prev => ({
      ...prev,
      [path]: (prev[path] || []).map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry
      )
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from("page_backgrounds").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const rows: { page_path: string; url: string; dimming: number; sort_order: number }[] = [];
    Object.entries(bgData).forEach(([page_path, entries]) => {
      if (page_path === GAME_DIMMING_KEY) {
        rows.push({ page_path, url: "", dimming: entries[0]?.dimming ?? 15, sort_order: 0 });
      } else {
        entries.forEach((entry, i) => {
          if (entry.url.trim()) {
            rows.push({ page_path, url: entry.url.trim(), dimming: entry.dimming, sort_order: i });
          }
        });
      }
    });
    if (rows.length > 0) {
      const { error } = await supabase.from("page_backgrounds").insert(rows);
      if (error) { alert("Ошибка: " + error.message); setSaving(false); return; }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const dimmingLabel = (v: number) => {
    if (v <= 10) return "Почти нет";
    if (v <= 30) return "Лёгкое";
    if (v <= 50) return "Среднее";
    if (v <= 70) return "Сильное";
    if (v <= 90) return "Очень тёмное";
    return "Полная темнота";
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex-1 flex flex-col bg-neutral-950 text-neutral-200 relative overflow-y-auto h-screen">

      {/* Preview popup */}
      {previewPopup && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewPopup(null)}>
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewPopup(null)}
              className="absolute -top-3 -right-3 z-10 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full p-2 border border-neutral-600 transition-colors">
              <X size={20} />
            </button>
            <h3 className="text-center text-sm text-neutral-400 mb-4">Предпросмотр фона (затемнение {previewPopup.dimming}%)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Portrait */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-neutral-500">📱 Вертикальная (9:16)</span>
                <div className="relative w-48 h-[340px] rounded-2xl border-2 border-neutral-700 overflow-hidden mx-auto">
                  <img src={previewPopup.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-neutral-950 transition-opacity" style={{ opacity: previewPopup.dimming / 100 }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
                    <div className="w-10 h-10 rounded-full bg-neutral-800/60 border border-neutral-600" />
                    <div className="w-20 h-2 rounded bg-neutral-700/50" />
                    <div className="w-16 h-2 rounded bg-neutral-700/30" />
                  </div>
                </div>
              </div>
              {/* Landscape */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-neutral-500">📱 Горизонтальная (16:9)</span>
                <div className="relative w-full max-w-[380px] h-[214px] rounded-2xl border-2 border-neutral-700 overflow-hidden mx-auto">
                  <img src={previewPopup.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-neutral-950 transition-opacity" style={{ opacity: previewPopup.dimming / 100 }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
                    <div className="w-10 h-10 rounded-full bg-neutral-800/60 border border-neutral-600" />
                    <div className="w-20 h-2 rounded bg-neutral-700/50" />
                    <div className="w-16 h-2 rounded bg-neutral-700/30" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 md:p-6 max-w-4xl mx-auto w-full pb-24">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/admin")} className="p-2 bg-neutral-900 rounded-xl hover:bg-neutral-800 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-red-500" /> Управление фонами
          </h1>
        </div>

        <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800 mb-6 text-sm text-neutral-400 space-y-1">
          <p className="flex items-center gap-2 text-neutral-300 font-semibold"><Info size={14} className="text-red-400" /> Как это работает</p>
          <p>• Можно добавить <strong className="text-neutral-300">несколько фонов</strong> для каждой страницы — у игроков они будут показываться <strong className="text-neutral-300">в случайном порядке</strong>.</p>
          <p>• <strong className="text-neutral-300">Затемнение (0–100%)</strong> настраивается отдельно для каждого фона.</p>
          <p>• Нажмите на <strong className="text-neutral-300">предпросмотр</strong> чтобы увидеть как фон выглядит на мобильном экране.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-red-500" /></div>
        ) : (
          <div className="space-y-6">
            <GameDimmingBlock
              dimming={bgData[GAME_DIMMING_KEY]?.[0]?.dimming ?? 15}
              onChange={(v) => setBgData(prev => ({ ...prev, [GAME_DIMMING_KEY]: [{ url: "", dimming: v }] }))}
              dimmingLabel={dimmingLabel}
            />

            <h2 className="text-base font-bold text-neutral-300 border-b border-neutral-800 pb-2 pt-2">
              Фоны отдельных страниц
            </h2>

            {PAGES.map((page) => (
              <PageBgBlock
                key={page.path}
                page={page}
                entries={bgData[page.path] || []}
                onAdd={() => addEntry(page.path)}
                onRemove={(i) => removeEntry(page.path, i)}
                onUpdate={(i, field, value) => updateEntry(page.path, i, field, value)}
                dimmingLabel={dimmingLabel}
                onPreview={(entry) => setPreviewPopup(entry)}
              />
            ))}
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          className={`mt-8 w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors border ${saved ? "bg-green-900/50 border-green-700 text-green-400" : "bg-red-600 hover:bg-red-700 text-white border-red-700"}`}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saved ? "Сохранено!" : saving ? "Сохранение..." : "Сохранить настройки"}
        </button>
      </div>
    </motion.div>
  );
}

function GameDimmingBlock({ dimming, onChange, dimmingLabel }: { dimming: number; onChange: (v: number) => void; dimmingLabel: (v: number) => string }) {
  return (
    <div className="bg-red-950/30 border-2 border-red-800 p-5 rounded-xl">
      <h2 className="text-lg font-bold mb-1 text-red-300 flex items-center gap-2">
        🎮 Уровень затемнения для ИИ-фонов (игровые сцены)
      </h2>
      <p className="text-xs text-neutral-400 mb-4">
        Применяется к фонам, генерируемым ИИ во время игры.
        По умолчанию <strong className="text-neutral-300">15%</strong>.
      </p>
      <label className="block text-sm text-neutral-400 mb-1">
        Затемнение: <span className="text-white font-bold">{dimming}%</span>
        <span className="ml-2 text-xs text-neutral-500">({dimmingLabel(dimming)})</span>
      </label>
      <input type="range" min="0" max="100" value={dimming}
        onChange={(e) => onChange(parseInt(e.target.value))} className="w-full accent-red-500" />
      <div className="mt-3 h-10 rounded-lg border border-neutral-700 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-500 to-neutral-700" />
        <div className="absolute inset-0 bg-neutral-950 transition-opacity" style={{ opacity: dimming / 100 }} />
        <span className="absolute inset-0 flex items-center justify-center text-xs text-white z-10">Предпросмотр затемнения</span>
      </div>
    </div>
  );
}

function PageBgBlock({ page, entries, onAdd, onRemove, onUpdate, dimmingLabel, onPreview }: {
  page: { path: string; name: string };
  entries: BgEntry[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, field: "url" | "dimming", value: string | number) => void;
  dimmingLabel: (v: number) => string;
  onPreview: (entry: BgEntry) => void;
}) {
  return (
    <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-red-400">
          {page.name}
          <span className="ml-2 text-xs text-neutral-600 font-mono">{page.path}</span>
          {entries.length > 0 && (
            <span className="ml-2 text-xs text-neutral-500">({entries.length} фон{entries.length > 1 ? entries.length < 5 ? "а" : "ов" : ""})</span>
          )}
        </h2>
        <button onClick={onAdd}
          className="flex items-center gap-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-lg transition-colors">
          <Plus size={14} /> Добавить фон
        </button>
      </div>

      {entries.length === 0 && (
        <p className="text-xs text-neutral-600 italic">Нет фонов. Нажмите «Добавить фон».</p>
      )}

      <div className="space-y-3">
        {entries.map((entry, i) => (
          <div key={i} className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 font-mono w-5">#{i + 1}</span>
              <input
                type="text"
                value={entry.url}
                onChange={(e) => onUpdate(i, "url", e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
              />
              <button onClick={() => onRemove(i)}
                className="p-2 text-neutral-500 hover:text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                Затемнение: <span className="text-white font-bold">{entry.dimming}%</span>
                <span className="ml-2 text-neutral-600">({dimmingLabel(entry.dimming)})</span>
              </label>
              <input type="range" min="0" max="100" value={entry.dimming}
                onChange={(e) => onUpdate(i, "dimming", parseInt(e.target.value))}
                className="w-full accent-red-500" />
            </div>
            {entry.url && (
              <button
                onClick={() => onPreview(entry)}
                className="w-full h-12 rounded-lg border border-neutral-700 overflow-hidden relative cursor-pointer hover:border-red-500 transition-colors group"
              >
                <img src={entry.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-neutral-950 transition-opacity" style={{ opacity: entry.dimming / 100 }} />
                <span className="absolute inset-0 flex items-center justify-center text-xs text-white z-10 font-semibold group-hover:text-red-300 transition-colors">
                  Нажмите для предпросмотра 📱
                </span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
