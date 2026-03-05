import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { motion, AnimatePresence } from "motion/react";
import { Image as ImageIcon, X, Download, Loader2, ExternalLink } from "lucide-react";
import { useAudio } from "../hooks/useAudio";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";

interface GalleryItem {
  id: string;
  image_url: string;
  label: string | null;
  created_at: string;
}

export default function Gallery() {
  const navigate = useNavigate();
  const { settings } = usePlayerStore();
  const { playClick } = useAudio(settings.musicVolume);
  const { profile } = useTelegram();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const tgId = profile?.telegram_id;
      if (tgId) {
        const { data, error } = await supabase
          .from("gallery")
          .select("id, image_url, label, created_at")
          .eq("telegram_id", tgId)
          .order("created_at", { ascending: false });
        if (error) console.error("[Gallery] load error:", error);
        if (data) setItems(data);
      }
      setLoading(false);
    };
    load();
  }, [profile?.telegram_id]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden h-screen"
    >
      <div className="fog-container">
        <div className="fog-layer"></div>
        <div className="fog-layer-2"></div>
      </div>

      <Header
        title={<><ImageIcon size={20} /> Галерея</>}
        backUrl="/profile"
      />

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={32} className="animate-spin text-red-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500">
            <ImageIcon size={48} className="mb-4 opacity-50" />
            <p>Галерея пуста...</p>
            <p className="text-xs mt-2">Играйте, чтобы открыть новые образы.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                className="aspect-square rounded-xl overflow-hidden border border-neutral-800 cursor-pointer hover:border-red-900/50 transition-colors relative group"
                onClick={() => {
                  setSelectedImage(item.image_url);
                  setSelectedLabel(item.label);
                }}
              >
                <img
                  src={item.image_url}
                  alt={item.label || `Gallery item ${index}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://i.ibb.co/BVgY7XrT/babai.png";
                  }}
                />
                {item.label && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-neutral-300 px-2 py-1 truncate">
                    {item.label}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => { setSelectedImage(null); setSelectedLabel(null); }}
          >
            <button
              className="absolute top-4 right-4 p-2 bg-neutral-800 rounded-full text-white hover:bg-neutral-700 transition-colors z-50"
              onClick={(e) => {
                e.stopPropagation();
                playClick();
                setSelectedImage(null);
                setSelectedLabel(null);
              }}
            >
              <X size={24} />
            </button>

            <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
              <img
                src={selectedImage}
                alt={selectedLabel || "Full size"}
                className="max-w-full max-h-[75vh] rounded-lg shadow-2xl border border-neutral-800"
                referrerPolicy="no-referrer"
              />
              {selectedLabel && (
                <p className="text-center text-neutral-400 text-sm mt-2">{selectedLabel}</p>
              )}
              <div className="mt-3 flex justify-center gap-3">
                <a
                  href={selectedImage}
                  download={`babai_gallery_${Date.now()}.png`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-red-900 hover:bg-red-800 text-white rounded-full transition-colors text-sm font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    playClick();
                  }}
                >
                  <Download size={16} /> Скачать
                </a>
                <a
                  href={selectedImage}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full transition-colors text-sm font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={16} /> Открыть
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
