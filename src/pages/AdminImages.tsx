import { useState, useRef } from "react";
import { motion } from "motion/react";
import { Upload, Image as ImageIcon, Loader2, Check, Trash2, Copy } from "lucide-react";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";

const SUPABASE_URL = "https://psuvnvqvspqibsezcrny.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzdXZudnF2c3BxaWJzZXpjcm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDI5NTIsImV4cCI6MjA4NzU3ODk1Mn0.VHI6Kefzbz6Hc8TpLI5_JRXAyPJ-y4oeE3Bkh16jFRU";

interface UploadedImage {
  url: string;
  label: string;
  copiedUrl?: boolean;
}

export default function AdminImages() {
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [label, setLabel] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedBase64, setSelectedBase64] = useState<string | null>(null);
  const [saveToGalleryTgId, setSaveToGalleryTgId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
      setSelectedBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedBase64) return;
    setUploading(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/upload-to-imgbb`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ imageBase64: selectedBase64 }),
      });
      const data = await resp.json();
      if (data.url) {
        const newImg: UploadedImage = { url: data.url, label: label || "Без названия" };
        setUploadedImages(prev => [newImg, ...prev]);

        // Optionally save to gallery DB if tgId provided
        if (saveToGalleryTgId) {
          await supabase.from("gallery").insert({
            telegram_id: parseInt(saveToGalleryTgId),
            image_url: data.url,
            label: label || null,
            prompt: null,
          });
        }

        setPreview(null);
        setSelectedBase64(null);
        setLabel("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        alert("Ошибка загрузки: " + (data.error || "неизвестная ошибка"));
      }
    } catch (e) {
      alert("Ошибка: " + e);
    } finally {
      setUploading(false);
    }
  };

  const copyUrl = async (url: string, idx: number) => {
    await navigator.clipboard.writeText(url);
    setUploadedImages(prev => prev.map((img, i) => i === idx ? { ...img, copiedUrl: true } : img));
    setTimeout(() => setUploadedImages(prev => prev.map((img, i) => i === idx ? { ...img, copiedUrl: false } : img)), 2000);
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

      <Header title={<><ImageIcon size={20} /> Загрузка картинок</>} backUrl="/admin" />

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">Загрузить картинку на ImgBB</h2>
          <p className="text-xs text-neutral-500">Загрузите изображение с устройства — получите прямую ссылку ImgBB для использования в приложении.</p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {preview ? (
            <div className="relative">
              <img src={preview} alt="Превью" className="w-full max-h-64 object-contain rounded-xl border border-neutral-700" />
              <button
                onClick={() => { setPreview(null); setSelectedBase64(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-full"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-8 border-2 border-dashed border-neutral-700 hover:border-red-600 rounded-xl flex flex-col items-center gap-3 text-neutral-500 hover:text-red-400 transition-all"
            >
              <Upload size={32} />
              <span className="text-sm font-medium">Нажмите для выбора файла</span>
              <span className="text-xs">PNG, JPG, GIF, WEBP</span>
            </button>
          )}

          {preview && (
            <>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Название (опционально)"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-700"
              />
              <input
                type="text"
                value={saveToGalleryTgId}
                onChange={(e) => setSaveToGalleryTgId(e.target.value)}
                placeholder="Telegram ID для галереи (опционально)"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-700"
              />
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full py-3 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {uploading ? <><Loader2 size={16} className="animate-spin" /> Загружаем...</> : <><Upload size={16} /> Загрузить на ImgBB</>}
              </button>
            </>
          )}
        </div>

        {uploadedImages.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-white uppercase tracking-wider">Загруженные в этой сессии</h2>
            {uploadedImages.map((img, idx) => (
              <div key={idx} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex gap-4">
                <img src={img.url} alt={img.label} className="w-20 h-20 object-cover rounded-xl flex-shrink-0 border border-neutral-700" />
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="font-bold text-white text-sm truncate">{img.label}</p>
                  <p className="text-xs text-neutral-500 truncate">{img.url}</p>
                  <button
                    onClick={() => copyUrl(img.url, idx)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    {img.copiedUrl ? <><Check size={12} className="text-green-400" /> Скопировано!</> : <><Copy size={12} /> Скопировать ссылку</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
