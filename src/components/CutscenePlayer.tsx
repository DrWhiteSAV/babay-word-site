import React, { useState, useEffect, useRef } from 'react';
import { SkipForward } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { resolveUrl } from '../utils/cachedUrl';

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

export const CutscenePlayer: React.FC<CutscenePlayerProps> = ({ onComplete }) => {
  const { videoCutscenes } = usePlayerStore();
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const isPortrait = window.innerHeight > window.innerWidth;
    const videos = isPortrait ? videoCutscenes.vertical : videoCutscenes.horizontal;
    
    if (videos && videos.length > 0) {
      const raw = videos[Math.floor(Math.random() * videos.length)];
      // Use cached version if already downloaded, else direct URL (fallback)
      resolveUrl(raw).then(resolved => setVideoUrl(resolved));
    } else {
      // Fallback if no videos are configured
      onComplete();
    }
  }, [videoCutscenes, onComplete]);

  useEffect(() => {
    // Fallback: if video doesn't trigger onCanPlay within 2 seconds (e.g. due to mobile data saving or autoplay blocking),
    // show the interaction button.
    const timeout = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        setNeedsInteraction(true);
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [isLoading]);

  const handleCanPlay = () => {
    setIsLoading(false);
    if (videoRef.current) {
      // Check if user has interacted to avoid browser console error
      const hasInteracted = 
        (navigator as any).userActivation ? (navigator as any).userActivation.hasBeenActive : true;

      if (!hasInteracted) {
        setNeedsInteraction(true);
        return;
      }

      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          setNeedsInteraction(true);
        });
      }
    }
  };

  const handleManualPlay = () => {
    setNeedsInteraction(false);
    if (videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Ignore manual play errors
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      {isLoading && !needsInteraction && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-neutral-950 overflow-hidden">
          {/* Fog Background */}
          <div 
            className="absolute inset-0 w-full h-full opacity-30 animate-zoom-pulse pointer-events-none origin-center"
            style={{
              backgroundImage: 'url("https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?q=80&w=2000&auto=format&fit=crop")',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'grayscale(100%) contrast(150%) brightness(0.5)',
            }}
          />
          
          {/* Vignette */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.9)_100%)] z-10" />

          {/* Content */}
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
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/60 overflow-hidden">
          {/* Fog Background */}
          <div 
            className="absolute inset-0 w-full h-full opacity-30 animate-zoom-pulse pointer-events-none origin-center"
            style={{
              backgroundImage: 'url("https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?q=80&w=2000&auto=format&fit=crop")',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'grayscale(100%) contrast(150%) brightness(0.5)',
            }}
          />
          
          {/* Vignette */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.9)_100%)] z-10" />

          <div className="relative z-20 flex flex-col items-center">
            <button
              onClick={handleManualPlay}
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

      {/* Skip button — pushed down 3 rows (top-24) to avoid Telegram close/back buttons */}
      <button
        onClick={onComplete}
        className="absolute top-24 right-4 z-20 text-white/50 hover:text-white/90 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors text-xs"
        style={{
          background: "rgba(0,0,0,0.25)",
          backdropFilter: "blur(4px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <span>Пропустить</span>
        <SkipForward size={13} />
      </button>
    </div>
  );
};
