import React, { useState, useEffect, useRef } from 'react';
import { SkipForward } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';

interface CutscenePlayerProps {
  onComplete: () => void;
}

const GameDescription = () => (
  <div className="mt-8 max-w-md text-center px-6 animate-in fade-in duration-1000">
    <h2 className="text-red-500 font-bold text-lg mb-3 tracking-widest uppercase drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]">О проекте</h2>
    <div className="space-y-3 text-neutral-300 text-sm leading-relaxed">
      <p>
        <strong className="text-red-400">BABAI</strong> — это интерактивный текстовый хоррор-квест.
      </p>
      <div className="mt-4 p-4 border border-red-900/30 bg-black/60 rounded-lg backdrop-blur-md">
        <h3 className="text-red-500 font-bold mb-3 uppercase text-xs tracking-wider">Как играть:</h3>
        <ul className="text-left space-y-2 text-xs text-neutral-300">
          <li className="flex items-start gap-2">
            <span className="text-red-500 mt-0.5">▸</span>
            Внимательно читайте диалоги и сообщения от персонажей
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-500 mt-0.5">▸</span>
            Принимайте решения, от которых зависит развитие сюжета
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-500 mt-0.5">▸</span>
            Используйте инвентарь и решайте загадки для продвижения
          </li>
        </ul>
      </div>
    </div>
  </div>
);

/** Pick a random home background from pageBackgrounds["/"] */
function useHomeBg() {
  const { pageBackgrounds } = usePlayerStore();
  const [rng] = useState(() => Math.random());
  const entries = pageBackgrounds["/"];
  if (!entries || entries.length === 0) return null;
  const entry = entries[Math.floor(rng * entries.length) % entries.length];
  return entry?.url || null;
}

export const CutscenePlayer: React.FC<CutscenePlayerProps> = ({ onComplete }) => {
  const { videoCutscenes } = usePlayerStore();
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videosLoadedRef = useRef(false);
  const hasTriedPlayRef = useRef(false);

  const homeBg = useHomeBg();
  // Use home bg from admin/pic — with lighter dimming for cutscene loading
  const bgStyle = homeBg
    ? {
        backgroundImage: `url(${homeBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'grayscale(40%) contrast(110%) brightness(0.6)',
      }
    : {
        backgroundImage: 'url("https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?q=80&w=2000&auto=format&fit=crop")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'grayscale(100%) contrast(150%) brightness(0.5)',
      };

  useEffect(() => {
    const isPortrait = window.innerHeight > window.innerWidth;
    const videos = isPortrait ? videoCutscenes.vertical : videoCutscenes.horizontal;

    if (videos && videos.length > 0) {
      videosLoadedRef.current = true;
      const raw = videos[Math.floor(Math.random() * videos.length)];
      setVideoUrl(raw);
    }
  }, [videoCutscenes]);

  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      if (!videosLoadedRef.current) onComplete();
    }, 6000);
    return () => clearTimeout(fallbackTimer);
  }, [onComplete]);

  useEffect(() => {
    if (!videoUrl) return;
    const timeout = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        setNeedsInteraction(true);
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [videoUrl, isLoading]);

  const tryAutoPlay = () => {
    if (!videoRef.current || hasTriedPlayRef.current) return;
    hasTriedPlayRef.current = true;
    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsLoading(false);
          setNeedsInteraction(false);
        })
        .catch(() => {
          setIsLoading(false);
          setNeedsInteraction(true);
        });
    }
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    tryAutoPlay();
  };

  const handleManualPlay = () => {
    setNeedsInteraction(false);
    hasTriedPlayRef.current = false;
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="cutscene-overlay fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      {isLoading && !needsInteraction && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 overflow-hidden" style={{ backgroundColor: 'rgba(10,10,10,0.6)' }}>
          <div
            className="absolute inset-0 w-full h-full opacity-50 animate-zoom-pulse pointer-events-none origin-center"
            style={bgStyle}
          />
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.7)_100%)] z-10" />
          <div className="relative z-20 flex flex-col items-center">
            <img
              src="https://i.ibb.co/BVgY7XrT/babai.png"
              alt="Babai Logo"
              className="w-48 h-48 object-contain mb-8 drop-shadow-[0_0_25px_rgba(220,38,38,0.6)] animate-pulse"
              referrerPolicy="no-referrer"
            />
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 border-4 border-red-900/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-red-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-red-500 font-black tracking-[0.3em] uppercase text-sm drop-shadow-[0_0_10px_rgba(220,38,38,0.8)] animate-pulse">
              Загрузка...
            </p>
            <GameDescription />
          </div>
        </div>
      )}

      {needsInteraction && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div
            className="absolute inset-0 w-full h-full opacity-50 animate-zoom-pulse pointer-events-none origin-center"
            style={bgStyle}
          />
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.7)_100%)] z-10" />
          <div className="relative z-20 flex flex-col items-center">
            <button
              onClick={handleManualPlay}
              style={{ clipPath: 'none', borderRadius: '50%', letterSpacing: 'normal', textTransform: 'none' }}
              className="transition-transform hover:scale-110 active:scale-95"
            >
              <img
                src="https://i.ibb.co/BVgY7XrT/babai.png"
                alt="Babai Logo"
                className="w-48 h-48 object-contain drop-shadow-[0_0_25px_rgba(220,38,38,0.6)] animate-pulse"
                referrerPolicy="no-referrer"
              />
            </button>
            <p className="text-red-500 font-black mt-6 tracking-[0.3em] uppercase text-sm drop-shadow-[0_0_10px_rgba(220,38,38,0.8)] animate-pulse">
              Нажмите чтобы начать
            </p>
            <GameDescription />
          </div>
        </div>
      )}

      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-cover"
          onCanPlay={handleCanPlay}
          onEnded={onComplete}
          playsInline
          preload="auto"
          muted={false}
        />
      )}

      {/* Skip button */}
      <button
        onClick={onComplete}
        style={{
          clipPath: 'none',
          borderRadius: '9999px',
          textTransform: 'none',
          letterSpacing: 'normal',
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(4px)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
        className="cutscene-skip-btn absolute top-16 right-4 z-30 text-white/60 hover:text-white/90 px-3 py-1.5 flex items-center gap-1.5 transition-colors text-xs"
      >
        <span>Пропустить</span>
        <SkipForward size={13} />
      </button>
    </div>
  );
};
