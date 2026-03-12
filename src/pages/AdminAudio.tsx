import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Music, Save, Volume2, Loader2, Plus, Trash2 } from "lucide-react";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";

const AUDIO_GROUPS = [
  { key: "menuMusic", label: "Главное меню", isMusic: true },
  { key: "bgMusic1", label: "Фон в игре 1", isMusic: true },
  { key: "bgMusic2", label: "Фон в игре 2", isMusic: true },
  { key: "bgMusic3", label: "Фон в игре 3", isMusic: true },
  { key: "bgMusic4", label: "Фон в игре 4", isMusic: true },
  { key: "bgMusic5", label: "Фон в игре 5", isMusic: true },
  { key: "click", label: "Клик по кнопке", isMusic: false },
  { key: "transition", label: "Переход между страницами", isMusic: false },
  { key: "scream", label: "Крик (scream)", isMusic: false },
  { key: "cat", label: "Фото/Кот (cat)", isMusic: false },
  { key: "fear", label: "Страх/Сердцебиение", isMusic: false },
];

type AudioEntry = { id?: string; key: string; value: string; sort_order: number };

export default function AdminAudio() {
  const [audioMap, setAudioMap] = useState<Record<string, AudioEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("audio_settings").select("id, key, value, sort_order").order("sort_order");
      const map: Record<string, AudioEntry[]> = {};
      // Initialize all groups with empty arrays
      AUDIO_GROUPS.forEach(g => { map[g.key] = []; });
      if (data) {
        data.forEach(r => {
          if (!map[r.key]) map[r.key] = [];
          map[r.key].push({ id: r.id, key: r.key, value: r.value, sort_order: r.sort_order });
        });
      }
      setAudioMap(map);
      setLoading(false);
    };
    load();
  }, []);

  const addUrl = (key: string) => {
    setAudioMap(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), { key, value: "", sort_order: (prev[key]?.length || 0) }],
    }));
  };

  const removeUrl = (key: string, index: number) => {
    setAudioMap(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter((_, i) => i !== index),
    }));
  };

  const updateUrl = (key: string, index: number, value: string) => {
    setAudioMap(prev => ({
      ...prev,
      [key]: (prev[key] || []).map((entry, i) => i === index ? { ...entry, value } : entry),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    // Delete all existing and re-insert
    await supabase.from("audio_settings").delete().neq("key", "__never__");
    
    const rows: { key: string; value: string; label: string; sort_order: number }[] = [];
    AUDIO_GROUPS.forEach(group => {
      const entries = audioMap[group.key] || [];
      entries.forEach((entry, i) => {
        if (entry.value.trim()) {
          rows.push({ key: group.key, value: entry.value.trim(), label: group.label, sort_order: i });
        }
      });
    });

    if (rows.length > 0) {
      const { error } = await supabase.from("audio_settings").insert(rows);
      if (error) { alert("Ошибка: " + error.message); setSaving(false); return; }
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const musicGroups = AUDIO_GROUPS.filter(g => g.isMusic);
  const sfxGroups = AUDIO_GROUPS.filter(g => !g.isMusic);

  const renderGroup = (group: typeof AUDIO_GROUPS[0]) => {
    const entries = audioMap[group.key] || [];
    return (
      <div key={group.key} className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">{group.label}</label>
          <button onClick={() => addUrl(group.key)} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1">
            <Plus size={12} /> Добавить ссылку
          </button>
        </div>
        {entries.length === 0 && (
          <p className="text-[10px] text-neutral-600 italic">Нет ссылок — будет использован звук по умолчанию</p>
        )}
        {entries.map((entry, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="text"
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:border-red-500 outline-none"
              value={entry.value}
              onChange={e => updateUrl(group.key, i, e.target.value)}
              placeholder="https://..."
            />
            <button onClick={() => removeUrl(group.key, i)} className="text-red-500 hover:text-red-400 p-1">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container"><div className="fog-layer"></div><div className="fog-layer-2"></div></div>
      <Header title={<><Music size={20} /> Настройки Аудио</>} backUrl="/admin" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-800 text-xs text-neutral-400">
          Добавьте несколько ссылок на аудио для каждого типа — они будут воспроизводиться в случайном порядке.
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-red-500" /></div>
        ) : (
          <div className="space-y-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-neutral-800 pb-2 flex items-center gap-2">
                <Music size={14} className="text-red-500" /> Музыка
              </h3>
              {musicGroups.map(renderGroup)}
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-neutral-800 pb-2 flex items-center gap-2">
                <Volume2 size={14} className="text-red-500" /> Звуковые эффекты
              </h3>
              {sfxGroups.map(renderGroup)}
            </div>
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          className={`w-full font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 border mb-6 ${saved ? "bg-green-900/50 border-green-700 text-green-400" : "bg-red-900/80 hover:bg-red-800 text-white border-red-700"}`}>
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saved ? "Сохранено!" : saving ? "Сохранение..." : "Сохранить настройки аудио"}
        </button>
      </div>
    </motion.div>
  );
}
