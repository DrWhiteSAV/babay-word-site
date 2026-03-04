import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Bot, Save, Settings2, Key, MessageSquare, Loader2 } from "lucide-react";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";

const DEFAULT_AI_SETTINGS = [
  {
    section_id: "chat",
    name: "Чат с ИИ (ДанИИл)",
    service: "gemini-3.1-pro-preview",
    prompt: "Ты ДанИИл, друг пользователя. Отвечай коротко, с юмором, иногда используй сленг.",
  },
  {
    section_id: "avatar",
    name: "Генерация Аватаров",
    service: "gemini-3.1-flash-image-preview",
    prompt: "Создай аватар в стиле киберпанк/аниме/реализм для персонажа с именем {name}.",
  },
  {
    section_id: "names",
    name: "Генерация Имен",
    service: "gemini-3-flash-preview",
    prompt: "Сгенерируй 5 уникальных имен для персонажа в хоррор-игре.",
  },
];

type AISetting = { section_id: string; name: string; service: string; prompt: string };

export default function AdminAI() {
  const [settings, setSettings] = useState<AISetting[]>(DEFAULT_AI_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("ai_settings").select("section_id, name, service, prompt");
      if (data && data.length > 0) {
        const merged = DEFAULT_AI_SETTINGS.map(def => {
          const found = data.find(d => d.section_id === def.section_id);
          return found ? { ...def, ...found } : def;
        });
        setSettings(merged);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("ai_settings").upsert(settings, { onConflict: "section_id" });
    setSaving(false);
    if (error) { alert("Ошибка: " + error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = (idx: number, field: keyof AISetting, value: string) => {
    setSettings(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container"><div className="fog-layer"></div><div className="fog-layer-2"></div></div>
      <Header title={<><Bot size={20} /> Настройки ИИ</>} backUrl="/admin" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-800 text-xs text-neutral-400">
          Настройки ИИ синхронизируются с базой данных при сохранении.
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-red-500" /></div>
        ) : settings.map((s, idx) => (
          <div key={s.section_id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3 border-b border-neutral-800 pb-3">
              <Settings2 className="text-red-500" size={20} />
              <h3 className="text-sm font-bold text-white">{s.name}</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold flex items-center gap-1"><Bot size={10} /> Модель ИИ</label>
                <select className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:border-red-500 outline-none"
                  value={s.service} onChange={e => update(idx, "service", e.target.value)}>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                  <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                  <option value="gemini-3.1-flash-image-preview">Gemini 3.1 Image</option>
                  <option value="gemini-2.5-flash-preview-tts">Gemini 2.5 TTS</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold flex items-center gap-1"><MessageSquare size={10} /> Системный Промпт</label>
                <textarea rows={3}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:border-red-500 outline-none resize-none"
                  value={s.prompt} onChange={e => update(idx, "prompt", e.target.value)} />
              </div>
            </div>
          </div>
        ))}

        <button onClick={handleSave} disabled={saving}
          className={`w-full font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 border mb-6 ${saved ? "bg-green-900/50 border-green-700 text-green-400" : "bg-red-900/80 hover:bg-red-800 text-white border-red-700"}`}>
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saved ? "Сохранено!" : saving ? "Сохранение..." : "Сохранить настройки ИИ"}
        </button>
      </div>
    </motion.div>
  );
}
