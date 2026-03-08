import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Save, ArrowLeft, Image as ImageIcon, Loader2, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";

// ─── Ключ глобального фона во время игры ───────────────────────────────────
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
  { path: "/chat", name: "Чат (Chat)" },
  { path: "/gallery", name: "Галерея (Gallery)" },
  { path: "/leaderboard", name: "Рейтинг (Leaderboard)" },
  { path: "/events", name: "События (Events)" },
  { path: "/achievements", name: "Достижения (Achievements)" },
];

type BgEntry = { url: string; dimming: number };
type BgMap = Record<string, BgEntry>;

export default function AdminPic() {
  const navigate = useNavigate();
  const [bgData, setBgData] = useState<BgMap>(() => {
    const initial: BgMap = {};
    PAGES.forEach(p => { initial[p.path] = { url: "", dimming: 80 }; });
    initial[GAME_DIMMING_KEY] = { url: "", dimming: 15 };
    return initial;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("page_backgrounds").select("page_path, url, dimming");
      const map: BgMap = {};
      PAGES.forEach(p => { map[p.path] = { url: "", dimming: 80 }; });
      // default 15% for generated backgrounds
      map[GAME_DIMMING_KEY] = { url: "", dimming: 15 };
      if (data && data.length > 0) {
        data.forEach(d => {
          map[d.page_path] = { url: d.url || "", dimming: d.dimming ?? 80 };
        });
      }
      setBgData(map);
      setLoading(false);
    };
    load();
  }, []);

  const handleUrlChange = (path: string, url: string) =>
    setBgData(prev => ({ ...prev, [path]: { ...prev[path], url } }));
  const handleDimmingChange = (path: string, dimming: number) =>
    setBgData(prev => ({ ...prev, [path]: { ...prev[path], dimming } }));

  const handleSave = async () => {
    setSaving(true);
    const rows = Object.entries(bgData).map(([page_path, d]) => ({
      page_path,
      url: d.url.trim(),
      dimming: d.dimming,
    }));
    const { error } = await supabase
      .from("page_backgrounds")
      .upsert(rows, { onConflict: "page_path" });
    setSaving(false);
    if (error) { alert("Ошибка: " + error.message); return; }
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
      <div className="p-4 md:p-6 max-w-4xl mx-auto w-full pb-24">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/admin")} className="p-2 bg-neutral-900 rounded-xl hover:bg-neutral-800 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-red-500" /> Управление фонами
          </h1>
        </div>

        {/* ─── ИНСТРУКЦИЯ ──────────────────────────────── */}
        <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800 mb-6 text-sm text-neutral-400 space-y-1">
          <p className="flex items-center gap-2 text-neutral-300 font-semibold"><Info size={14} className="text-red-400" /> Как это работает</p>
          <p>• <strong className="text-neutral-300">URL фона</strong> — прямая ссылка на изображение (jpg/png). Если пустой — глобальный фон не применяется.</p>
          <p>• <strong className="text-neutral-300">Затемнение (0–100%)</strong>: 0 = фон виден без затемнения, 100 = полностью чёрный.</p>
          <p>• <strong className="text-neutral-300">Настройки глобальные</strong> — изменения сразу влияют на всех игроков.</p>
          <p>• При перезагрузке приложения фоны подтягиваются из базы данных автоматически.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-red-500" /></div>
        ) : (
          <div className="space-y-6">

            {/* ─── БЛОК: Фоны, генерируемые во время игры ─── */}
            <div className="bg-red-950/30 border-2 border-red-800 p-5 rounded-xl">
              <h2 className="text-lg font-bold mb-1 text-red-300 flex items-center gap-2">
                🎮 Уровень затемнения для ИИ-фонов (игровые сцены)
              </h2>
              <p className="text-xs text-neutral-400 mb-4">
                Применяется к фонам, генерируемым ИИ во время игры (боссы, аватары).
                По умолчанию <strong className="text-neutral-300">15%</strong> — почти без затемнения, фон хорошо виден.
              </p>
              <label className="block text-sm text-neutral-400 mb-1">
                Затемнение: <span className="text-white font-bold">{bgData[GAME_DIMMING_KEY]?.dimming ?? 15}%</span>
                <span className="ml-2 text-xs text-neutral-500">({dimmingLabel(bgData[GAME_DIMMING_KEY]?.dimming ?? 15)})</span>
              </label>
              <input
                type="range" min="0" max="100"
                value={bgData[GAME_DIMMING_KEY]?.dimming ?? 15}
                onChange={(e) => handleDimmingChange(GAME_DIMMING_KEY, parseInt(e.target.value))}
                className="w-full accent-red-500"
              />
              <div className="mt-3 h-10 rounded-lg border border-neutral-700 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-neutral-500 to-neutral-700" />
                <div
                  className="absolute inset-0 bg-neutral-950 transition-opacity"
                  style={{ opacity: (bgData[GAME_DIMMING_KEY]?.dimming ?? 15) / 100 }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs text-white z-10">
                  Предпросмотр затемнения
                </span>
              </div>
            </div>

            {/* ─── БЛОК: Страничные фоны ─── */}
            <h2 className="text-base font-bold text-neutral-300 border-b border-neutral-800 pb-2 pt-2">
              Фоны отдельных страниц
            </h2>

            {PAGES.map((page) => (
              <div key={page.path} className="bg-neutral-900 p-4 rounded-xl border border-neutral-800">
                <h2 className="text-base font-bold mb-3 text-red-400">{page.name}
                  <span className="ml-2 text-xs text-neutral-600 font-mono">{page.path}</span>
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">URL картинки</label>
                    <input
                      type="text"
                      value={bgData[page.path]?.url || ""}
                      onChange={(e) => handleUrlChange(page.path, e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">
                      Затемнение: <span className="text-white font-bold">{bgData[page.path]?.dimming ?? 80}%</span>
                      <span className="ml-2 text-neutral-600">({dimmingLabel(bgData[page.path]?.dimming ?? 80)})</span>
                    </label>
                    <input
                      type="range" min="0" max="100"
                      value={bgData[page.path]?.dimming ?? 80}
                      onChange={(e) => handleDimmingChange(page.path, parseInt(e.target.value))}
                      className="w-full accent-red-500"
                    />
                  </div>
                  {bgData[page.path]?.url && (
                    <div className="mt-2 h-12 rounded-lg border border-neutral-700 overflow-hidden relative">
                      <img src={bgData[page.path].url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      <div
                        className="absolute inset-0 bg-neutral-950 transition-opacity"
                        style={{ opacity: (bgData[page.path]?.dimming ?? 80) / 100 }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs text-white z-10 font-semibold">
                        Предпросмотр
                      </span>
                    </div>
                  )}
                </div>
              </div>
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
