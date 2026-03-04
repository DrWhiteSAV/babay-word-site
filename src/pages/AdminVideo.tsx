import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Save, ArrowLeft, Video, Plus, Trash2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { DEFAULT_VERTICAL_VIDEOS, DEFAULT_HORIZONTAL_VIDEOS } from "../config/defaultSettings";

export default function AdminVideo() {
  const navigate = useNavigate();
  const [verticalVideos, setVerticalVideos] = useState<string[]>([]);
  const [horizontalVideos, setHorizontalVideos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("video_cutscenes")
        .select("orientation, url, sort_order")
        .order("sort_order");

      if (data && data.length > 0) {
        setVerticalVideos(data.filter(d => d.orientation === "vertical").map(d => d.url));
        setHorizontalVideos(data.filter(d => d.orientation === "horizontal").map(d => d.url));
      } else {
        // Seed defaults if empty
        setVerticalVideos([...DEFAULT_VERTICAL_VIDEOS]);
        setHorizontalVideos([...DEFAULT_HORIZONTAL_VIDEOS]);
        await seedDefaults();
      }
      setLoading(false);
    };
    load();
  }, []);

  const seedDefaults = async () => {
    const rows = [
      ...DEFAULT_VERTICAL_VIDEOS.map((url, i) => ({ orientation: "vertical", url, sort_order: i })),
      ...DEFAULT_HORIZONTAL_VIDEOS.map((url, i) => ({ orientation: "horizontal", url, sort_order: i })),
    ];
    await supabase.from("video_cutscenes").insert(rows);
  };

  const handleSave = async () => {
    setSaving(true);
    // Delete all and re-insert
    await supabase.from("video_cutscenes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const rows = [
      ...verticalVideos.filter(v => v.trim()).map((url, i) => ({ orientation: "vertical", url, sort_order: i })),
      ...horizontalVideos.filter(v => v.trim()).map((url, i) => ({ orientation: "horizontal", url, sort_order: i })),
    ];
    if (rows.length > 0) {
      await supabase.from("video_cutscenes").insert(rows);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleChange = (type: "vertical" | "horizontal", index: number, value: string) => {
    if (type === "vertical") {
      const n = [...verticalVideos]; n[index] = value; setVerticalVideos(n);
    } else {
      const n = [...horizontalVideos]; n[index] = value; setHorizontalVideos(n);
    }
  };
  const addVideo = (type: "vertical" | "horizontal") => {
    if (type === "vertical") setVerticalVideos(p => [...p, ""]);
    else setHorizontalVideos(p => [...p, ""]);
  };
  const removeVideo = (type: "vertical" | "horizontal", index: number) => {
    if (type === "vertical") setVerticalVideos(p => p.filter((_, i) => i !== index));
    else setHorizontalVideos(p => p.filter((_, i) => i !== index));
  };

  const VideoList = ({ type, videos }: { type: "vertical" | "horizontal"; videos: string[] }) => (
    <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-red-400">
          {type === "vertical" ? "Вертикальные видео (Мобильные)" : "Горизонтальные видео (ПК)"}
        </h2>
        <button onClick={() => addVideo(type)} className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-white transition-colors">
          <Plus size={18} />
        </button>
      </div>
      <div className="space-y-3">
        {videos.length === 0 && <p className="text-neutral-500 text-sm italic">Список пуст</p>}
        {videos.map((url, index) => (
          <div key={index} className="flex items-center gap-2">
            <input type="text" value={url} onChange={(e) => handleChange(type, index, e.target.value)}
              placeholder="https://example.com/video.mp4"
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500 transition-colors" />
            <button onClick={() => removeVideo(type, index)} className="p-2 text-neutral-500 hover:text-red-500 hover:bg-neutral-800 rounded-lg transition-colors">
              <Trash2 size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex-1 flex flex-col bg-neutral-950 text-neutral-200 relative overflow-y-auto h-screen">
      <div className="p-4 md:p-6 max-w-4xl mx-auto w-full pb-24">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/admin")} className="p-2 bg-neutral-900 rounded-xl hover:bg-neutral-800 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-6 h-6 text-red-500" /> Управление видео
          </h1>
        </div>

        <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800 mb-6 text-sm text-neutral-400">
          Видео синхронизируются с базой данных. Вертикальные — для мобильных, горизонтальные — для ПК.
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-red-500" /></div>
        ) : (
          <div className="space-y-8">
            <VideoList type="vertical" videos={verticalVideos} />
            <VideoList type="horizontal" videos={horizontalVideos} />
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
