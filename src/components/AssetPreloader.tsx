import { useEffect, useState, useRef } from "react";
import { supabase } from "../integrations/supabase/client";
import { motion, AnimatePresence } from "motion/react";
import { bgMusics, menuMusic } from "../hooks/useAudio";

interface AssetEntry {
  url: string;
  label: string;
  sizeBytes?: number;
}

const PRELOADED_KEY = "babai_assets_preloaded_v2";

function formatMb(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function cacheAsset(url: string): Promise<number> {
  try {
    const cache = await caches.open("babai-assets-v2");
    const existing = await cache.match(url);
    if (existing) {
      // Already cached — estimate size from content-length header
      const cl = existing.headers.get("content-length");
      return cl ? parseInt(cl) : 500_000;
    }
    const resp = await fetch(url, { cache: "force-cache" });
    if (!resp.ok) return 0;
    const cl = resp.headers.get("content-length");
    const bytes = cl ? parseInt(cl) : 500_000;
    await cache.put(url, resp);
    return bytes;
  } catch {
    return 0;
  }
}

interface Props {
  onComplete: () => void;
}

export default function AssetPreloader({ onComplete }: Props) {
  const [assets, setAssets] = useState<AssetEntry[]>([]);
  const [loaded, setLoaded] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [loadedBytes, setLoadedBytes] = useState(0);
  const [currentLabel, setCurrentLabel] = useState("Инициализация...");
  const [phase, setPhase] = useState<"fetching" | "loading" | "done">("fetching");
  const doneRef = useRef(false);

  // Check if already preloaded this session
  useEffect(() => {
    if (sessionStorage.getItem(PRELOADED_KEY) === "1") {
      onComplete();
      return;
    }
    // Check if Cache API available
    if (!("caches" in window)) {
      sessionStorage.setItem(PRELOADED_KEY, "1");
      onComplete();
      return;
    }
    loadAssetList();
  }, []);

  const loadAssetList = async () => {
    setPhase("fetching");
    setCurrentLabel("Получение списка ресурсов...");

    // 1) Fetch lists from Supabase
    const [bgRes, videoRes, audioRes] = await Promise.all([
      supabase.from("page_backgrounds").select("url, page_path"),
      supabase.from("video_cutscenes").select("url, orientation"),
      supabase.from("audio_settings").select("value, label"),
    ]);

    const list: AssetEntry[] = [];

    // Static audio tracks
    [...bgMusics, menuMusic].forEach(url => {
      list.push({ url, label: "🎵 Фоновая музыка" });
    });

    // Page backgrounds
    (bgRes.data || []).forEach(row => {
      if (row.url) list.push({ url: row.url, label: `🖼 Фон страницы` });
    });

    // Video cutscenes
    (videoRes.data || []).forEach(row => {
      if (row.url) list.push({ url: row.url, label: `🎬 Видео (${row.orientation === "vertical" ? "вертикальное" : "горизонтальное"})` });
    });

    // Custom audio
    (audioRes.data || []).forEach(row => {
      if (row.value && (row.value.startsWith("http") || row.value.startsWith("/"))) {
        list.push({ url: row.value, label: `🔊 ${row.label || "Звук"}` });
      }
    });

    // De-dupe
    const unique = Array.from(new Map(list.map(a => [a.url, a])).values());

    if (unique.length === 0) {
      sessionStorage.setItem(PRELOADED_KEY, "1");
      onComplete();
      return;
    }

    setAssets(unique);
    // Rough estimate: 2MB per video, 500KB per audio, 200KB per image
    const estimatedTotal = unique.reduce((acc, a) => {
      if (a.url.match(/\.(mp4|webm|mov)/i)) return acc + 2_000_000;
      if (a.url.match(/\.(mp3|ogg|wav)/i)) return acc + 500_000;
      return acc + 200_000;
    }, 0);
    setTotalBytes(estimatedTotal);
    setPhase("loading");
    startLoading(unique, estimatedTotal);
  };

  const startLoading = async (list: AssetEntry[], total: number) => {
    let done = 0;
    let bytesAcc = 0;

    for (const asset of list) {
      if (doneRef.current) break;
      setCurrentLabel(asset.label);
      const bytes = await cacheAsset(asset.url);
      bytesAcc += bytes || (total / list.length);
      done += 1;
      setLoaded(done);
      setLoadedBytes(Math.min(bytesAcc, total));
    }

    doneRef.current = true;
    setPhase("done");
    sessionStorage.setItem(PRELOADED_KEY, "1");
    setTimeout(onComplete, 600);
  };

  const pct = assets.length > 0 ? Math.round((loaded / assets.length) * 100) : 0;

  return (
    <AnimatePresence>
      {phase !== "done" && (
        <motion.div
          key="preloader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-neutral-950"
          style={{
            background: "radial-gradient(ellipse at center, rgba(80,10,10,0.4) 0%, #0a0a0a 70%)"
          }}
        >
          {/* Logo / ghost */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="text-7xl mb-8 select-none"
          >
            👻
          </motion.div>

          <h1 className="text-white font-black text-2xl uppercase tracking-widest mb-1">БАБАЙ</h1>
          <p className="text-neutral-500 text-xs uppercase tracking-[0.25em] mb-10">Загрузка духа...</p>

          {/* Progress bar */}
          <div className="w-64 space-y-3">
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #7f1d1d, #ef4444)" }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-neutral-400 text-xs font-mono">{pct}%</span>
              <span className="text-neutral-600 text-[10px]">
                {formatMb(loadedBytes)} / {formatMb(totalBytes)}
              </span>
            </div>

            <p className="text-neutral-500 text-[10px] text-center truncate px-2">{currentLabel}</p>
          </div>

          {/* Skip button */}
          <button
            onClick={() => {
              doneRef.current = true;
              sessionStorage.setItem(PRELOADED_KEY, "1");
              onComplete();
            }}
            className="mt-10 text-neutral-600 hover:text-neutral-400 text-xs transition-colors underline underline-offset-4"
          >
            Пропустить
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
