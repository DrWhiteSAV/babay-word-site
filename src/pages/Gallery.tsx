import { useState, useEffect, useCallback } from "react";
import { usePlayerStore } from "../store/playerStore";
import { motion, AnimatePresence } from "motion/react";
import { Image as ImageIcon, X, Download, Loader2, ExternalLink, User, Mountain, Skull, RefreshCw } from "lucide-react";
import { useAudio } from "../hooks/useAudio";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";

// Video cache key — preserved on progress reset
const VIDEO_CACHE_KEY = "babai_video_cache";

interface GalleryItem {
  id: string;
  image_url: string;
  label: string | null;
  created_at: string;
}

type Section = "all" | "avatars" | "backgrounds" | "bosses";

export default function Gallery() {
  const { settings, updateCharacter, character } = usePlayerStore();
  const { playClick } = useAudio(settings.musicVolume);
  const { profile, isLoading: tgLoading } = useTelegram();
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>("all");
  const [loadError, setLoadError] = useState<string | null>(null);

  const isRenderableImageUrl = (url: string | null | undefined) =>
    typeof url === "string" && /^https?:\/\//i.test(url.trim());

  const loadGallery = useCallback(async () => {
    // Wait for Telegram profile to be available
    const tgId = profile?.telegram_id;
    if (!tgId) {
      if (!tgLoading) {
        setItems([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setLoadError(null);

    console.log("[Gallery] Loading for telegram_id:", tgId);

    const { data, error } = await supabase
      .from("gallery")
      .select("id, image_url, label, created_at")
      .eq("telegram_id", tgId)
      .order("created_at", { ascending: false })
      .limit(200);

    console.log("[Gallery] DB result:", { count: data?.length, error: error?.message });

    if (error) {
      console.error("[Gallery] load error:", error);
      setLoadError("Не удалось загрузить галерею: " + error.message);
      setLoading(false);
      return;
    }

    const normalized = (data || [])
      .filter((row) => isRenderableImageUrl(row.image_url))
      .map((row) => ({ ...row, image_url: row.image_url.trim() }));

    console.log("[Gallery] Loaded items:", normalized.length, normalized.map(i => ({ label: i.label, url: i.image_url.substring(0, 60) })));

    setItems(normalized);
    usePlayerStore.setState({ gallery: normalized.map((item) => item.image_url) });
    setLoading(false);
  }, [profile?.telegram_id, tgLoading]);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  const getCategory = (item: GalleryItem): Section => {
    const label = (item.label || "").toLowerCase();
    if (
      label.includes("[avatars]") ||
      label.includes("[avatar]") ||
      label.includes("аватар") ||
      label.startsWith("avatar")
    ) return "avatars";
    if (
      label.includes("[backgrounds]") ||
      label.includes("[background]") ||
      label.includes("фон")
    ) return "backgrounds";
    if (
      label.includes("[bosses]") ||
      label.includes("[boss]") ||
      label.includes("босс")
    ) return "bosses";
    // Default: try to guess from URL pattern, otherwise avatars
    return "avatars";
  };

  const filteredItems = activeSection === "all"
    ? items
    : items.filter(item => getCategory(item) === activeSection);

  const sectionTabs: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "Все", icon: <ImageIcon size={14} /> },
    { key: "avatars", label: "Аватары", icon: <User size={14} /> },
    { key: "backgrounds", label: "Фоны", icon: <Mountain size={14} /> },
    { key: "bosses", label: "Боссы", icon: <Skull size={14} /> },
  ];

  const handleSetAsAvatar = async () => {
    if (!selectedImage || !character) return;
    updateCharacter({ avatarUrl: selectedImage.image_url });
    if (profile?.telegram_id) {
      await supabase.from("player_stats")
        .update({ avatar_url: selectedImage.image_url })
        .eq("telegram_id", profile.telegram_id);
    }
    alert("Аватар обновлён!");
    setSelectedImage(null);
  };

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
        rightContent={
          <button
            onClick={loadGallery}
            disabled={loading}
            className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-full font-bold transition-colors flex items-center gap-1"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Обновить
          </button>
        }
      />

      {/* Section Tabs */}
      <div className="relative z-10 flex gap-2 px-4 pt-3 pb-2 overflow-x-auto">
        {sectionTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveSection(tab.key); playClick(); }}
            className={`flex items-center gap-1 px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeSection === tab.key
                ? "bg-red-700 text-white"
                : "bg-neutral-900 text-neutral-400 border border-neutral-800 hover:border-neutral-600"
            }`}
          >
            {tab.icon} {tab.label}
            <span className="ml-1 opacity-60">
              ({tab.key === "all" ? items.length : items.filter(i => getCategory(i) === tab.key).length})
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={32} className="animate-spin text-red-500" />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 text-center px-6">
            <ImageIcon size={48} className="mb-4 opacity-50" />
            <p>{loadError}</p>
            <button
              onClick={loadGallery}
              className="mt-4 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm"
            >
              Повторить
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500">
            <ImageIcon size={48} className="mb-4 opacity-50" />
            <p className="font-bold">Здесь пусто...</p>
            <p className="text-xs mt-2 text-center">
              {activeSection === "avatars" ? "Создайте персонажа или купите предметы в магазине" :
               activeSection === "backgrounds" ? "Сыграйте в игру — фон сохранится сюда" :
               activeSection === "bosses" ? "Победите босса и картинка сохранится здесь" :
               "Играйте, чтобы открыть новые образы"}
            </p>
            {items.length === 0 && (
              <button onClick={loadGallery} className="mt-4 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm flex items-center gap-2">
                <RefreshCw size={14} /> Загрузить из БД
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                className="aspect-square rounded-xl overflow-hidden border border-neutral-800 cursor-pointer hover:border-red-900/50 transition-colors relative group"
                onClick={() => {
                  setSelectedImage(item);
                  playClick();
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
                    {item.label.replace(/^\[(avatars?|backgrounds?|bosses?)\]\s*/i, "")}
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  {getCategory(item) === "avatars" && <span className="bg-purple-900/80 text-purple-300 text-[9px] px-1.5 py-0.5 rounded-full font-bold">АВАТАР</span>}
                  {getCategory(item) === "backgrounds" && <span className="bg-blue-900/80 text-blue-300 text-[9px] px-1.5 py-0.5 rounded-full font-bold">ФОН</span>}
                  {getCategory(item) === "bosses" && <span className="bg-red-900/80 text-red-300 text-[9px] px-1.5 py-0.5 rounded-full font-bold">БОСС</span>}
                </div>
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
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setSelectedImage(null)}
          >
            <button
              className="absolute top-4 right-4 p-2 bg-neutral-800 rounded-full text-white hover:bg-neutral-700 transition-colors z-50"
              onClick={(e) => { e.stopPropagation(); playClick(); setSelectedImage(null); }}
            >
              <X size={24} />
            </button>

            <div className="relative max-w-full max-h-full w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <img
                src={selectedImage.image_url}
                alt={selectedImage.label || "Full size"}
                className="max-w-full max-h-[75vh] rounded-lg shadow-2xl border border-neutral-800 object-contain"
                referrerPolicy="no-referrer"
              />
              {selectedImage.label && (
                <p className="text-center text-neutral-400 text-sm mt-2">
                  {selectedImage.label.replace(/^\[(avatars?|backgrounds?|bosses?)\]\s*/i, "")}
                </p>
              )}

              {/* Direct ImgBB link */}
              <p className="text-[10px] text-neutral-600 mt-1 text-center break-all px-4 max-w-sm">
                {selectedImage.image_url}
              </p>

              <div className="mt-3 flex justify-center gap-2 flex-wrap">
                {getCategory(selectedImage) === "avatars" && character && (
                  <button
                    onClick={handleSetAsAvatar}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-800 hover:bg-purple-700 text-white rounded-full transition-colors text-sm font-medium"
                  >
                    <User size={16} /> Сделать аватаром
                  </button>
                )}
                <a
                  href={selectedImage.image_url}
                  download={`babai_${Date.now()}.jpg`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-red-900 hover:bg-red-800 text-white rounded-full transition-colors text-sm font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={16} /> Скачать
                </a>
                <a
                  href={selectedImage.image_url}
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
