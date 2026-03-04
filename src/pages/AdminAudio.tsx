import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Music, Save, Volume2, Loader2 } from "lucide-react";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";

const DEFAULT_AUDIO: Record<string, string> = {
  menuMusic: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  bgMusic1: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  bgMusic2: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  bgMusic3: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  bgMusic4: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  bgMusic5: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
  click: "https://www.soundjay.com/buttons/button-16.mp3",
  transition: "https://www.soundjay.com/free-music/whoosh-01.mp3",
  scream: "https://www.soundjay.com/human/man-scream-01.mp3",
  cat: "https://www.soundjay.com/mechanical/camera-shutter-click-01.mp3",
  fear: "https://www.soundjay.com/human/heartbeat-01.mp3",
};

const AUDIO_LABELS: Record<string, string> = {
  menuMusic: "Главное меню",
  bgMusic1: "Фон в игре 1",
  bgMusic2: "Фон в игре 2",
  bgMusic3: "Фон в игре 3",
  bgMusic4: "Фон в игре 4",
  bgMusic5: "Фон в игре 5",
  click: "Клик по кнопке",
  transition: "Переход между страницами",
  scream: "Крик (scream)",
  cat: "Фото/Кот (cat)",
  fear: "Страх/Сердцебиение",
};

export default function AdminAudio() {
  const [audio, setAudio] = useState<Record<string, string>>({ ...DEFAULT_AUDIO });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("audio_settings").select("key, value");
      if (data && data.length > 0) {
        const merged = { ...DEFAULT_AUDIO };
        data.forEach(r => { merged[r.key] = r.value; });
        setAudio(merged);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const rows = Object.entries(audio).map(([key, value]) => ({ key, value, label: AUDIO_LABELS[key] || key }));
    const { error } = await supabase.from("audio_settings").upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) { alert("Ошибка: " + error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const musicKeys = Object.keys(DEFAULT_AUDIO).filter(k => k.toLowerCase().includes("music"));
  const sfxKeys = Object.keys(DEFAULT_AUDIO).filter(k => !k.toLowerCase().includes("music"));

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
          Ссылки на аудиофайлы. Изменения синхронизируются с базой данных.
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-red-500" /></div>
        ) : (
          <div className="space-y-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-white border-b border-neutral-800 pb-2 flex items-center gap-2">
                <Music size={14} className="text-red-500" /> Музыка
              </h3>
              {musicKeys.map(key => (
                <div key={key} className="space-y-1">
                  <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">{AUDIO_LABELS[key]}</label>
                  <input type="text"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:border-red-500 outline-none"
                    value={audio[key] || ""}
                    onChange={e => setAudio(prev => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-white border-b border-neutral-800 pb-2 flex items-center gap-2">
                <Volume2 size={14} className="text-red-500" /> Звуковые эффекты
              </h3>
              {sfxKeys.map(key => (
                <div key={key} className="space-y-1">
                  <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">{AUDIO_LABELS[key]}</label>
                  <input type="text"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:border-red-500 outline-none"
                    value={audio[key] || ""}
                    onChange={e => setAudio(prev => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
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
