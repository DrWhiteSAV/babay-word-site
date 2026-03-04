import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { usePlayerStore } from "./store/playerStore";
import { useState, useEffect, useRef } from "react";
import { useAudio, menuMusic, bgMusics } from "./hooks/useAudio";
import BottomNav from "./components/BottomNav";
import { CutscenePlayer } from "./components/CutscenePlayer";

// Pages
import Home from "./pages/Home";
import CharacterCreate from "./pages/CharacterCreate";
import GameHub from "./pages/GameHub";
import Game from "./pages/Game";
import Shop from "./pages/Shop";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Friends from "./pages/Friends";
import Chat from "./pages/Chat";
import Gallery from "./pages/Gallery";
import Leaderboard from "./pages/Leaderboard";
import Events from "./pages/Events";
import Admin from "./pages/Admin";
import AdminPic from "./pages/AdminPic";
import AdminVideo from "./pages/AdminVideo";
import AdminStore from "./pages/AdminStore";
import AdminUsers from "./pages/AdminUsers";
import AdminAI from "./pages/AdminAI";
import AdminAudio from "./pages/AdminAudio";
import AdminText from "./pages/AdminText";
import AdminStat from "./pages/AdminStat";

function AppContent() {
  const [hasSeenInitialCutscene, setHasSeenInitialCutscene] = useState(false);
  const { updateEnergy, settings, globalBackgroundUrl, setGlobalBackgroundUrl, character, pageBackgrounds } = usePlayerStore();
  const { playClick } = useAudio(settings.musicVolume);
  const location = useLocation();
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const { friends, addFriend, toggleFriendAi } = usePlayerStore.getState();
    const danil = friends.find(f => f.name === "ДанИИл");
    if (!danil) {
      addFriend("ДанИИл");
    } else if (!danil.isAiEnabled) {
      toggleFriendAi("ДанИИл");
    }
  }, []);

  useEffect(() => {
    if (!bgMusicRef.current) {
      bgMusicRef.current = new Audio();
      bgMusicRef.current.loop = true;
    }

    const isGame = location.pathname === "/game";
    const currentSrc = bgMusicRef.current.src;
    let targetSrc = menuMusic;

    if (isGame) {
      const isPlayingGameMusic = bgMusics.some(m => currentSrc.includes(encodeURI(m)) || currentSrc === m);
      if (!isPlayingGameMusic) {
        targetSrc = bgMusics[Math.floor(Math.random() * bgMusics.length)];
      } else {
        targetSrc = currentSrc;
      }
    }

    const normalizedCurrent = currentSrc.replace(window.location.origin, "");
    const normalizedTarget = targetSrc.replace(window.location.origin, "");

    if (normalizedCurrent !== normalizedTarget) {
      bgMusicRef.current.src = targetSrc;
      const hasInteracted = (navigator as any).userActivation ? (navigator as any).userActivation.hasBeenActive : true;
      if (hasInteracted) {
        bgMusicRef.current.play().catch(() => {});
      }
    }

    bgMusicRef.current.volume = (settings.musicVolume / 100) * 0.2;
  }, [location.pathname, settings.musicVolume]);

  useEffect(() => {
    const handleInteraction = () => {
      if (bgMusicRef.current && bgMusicRef.current.paused) {
        bgMusicRef.current.play().catch(() => {});
      }
    };
    document.addEventListener("click", handleInteraction);
    return () => document.removeEventListener("click", handleInteraction);
  }, []);

  useEffect(() => {
    // Update energy every second to sync with UI timer
    const interval = setInterval(() => {
      updateEnergy();
    }, 1000);
    return () => clearInterval(interval);
  }, [updateEnergy]);

  useEffect(() => {
    const handleClick = () => playClick();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [playClick]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.fontSize}px`;
  }, [settings.fontSize]);

  const fontFamilyMap: Record<string, string> = {
    "Inter": "font-inter",
    "Roboto": "font-roboto",
    "Montserrat": "font-montserrat",
    "Playfair Display": "font-playfair",
    "JetBrains Mono": "font-jetbrains",
    "Press Start 2P": "font-press-start",
    "Russo One": "font-russo-one",
    "Rubik Beastly": "font-rubik-beastly",
    "Rubik Burned": "font-rubik-burned",
    "Rubik Glitch": "font-rubik-glitch",
    "Neucha": "font-neucha",
    "Ruslan Display": "font-ruslan-display",
    "Tektur": "font-tektur",
  };

  const fontClass = fontFamilyMap[settings.fontFamily] || "font-jetbrains";
  const themeClass = settings.theme === "cyberpunk" ? "theme-cyberpunk" : "";

  const buttonSizeClass = 
    settings.buttonSize === "small" ? "btn-small" :
    settings.buttonSize === "large" ? "btn-large" : "btn-medium";

  const currentPath = location.pathname;
  const customBg = pageBackgrounds?.[currentPath];
  const activeBgUrl = customBg?.url || globalBackgroundUrl;
  
  // Calculate dimming values based on customBg.dimming (0-100)
  // If no custom dimming, use default 80% to 95% gradient
  const dimmingTop = customBg ? customBg.dimming / 100 : 0.8;
  const dimmingBottom = customBg ? Math.min(1, (customBg.dimming + 15) / 100) : 0.95;

  return (
    <div 
      className={`min-h-[100dvh] bg-neutral-950 text-neutral-100 ${fontClass} ${themeClass} selection:bg-red-900 selection:text-white ${buttonSizeClass}`}
      style={activeBgUrl ? {
        backgroundImage: `linear-gradient(to bottom, rgba(23, 23, 23, ${dimmingTop}), rgba(23, 23, 23, ${dimmingBottom})), url(${activeBgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      } : {}}
    >
      {!hasSeenInitialCutscene && (
        <CutscenePlayer onComplete={() => setHasSeenInitialCutscene(true)} />
      )}
      <style>{`
        * {
          -webkit-text-fill-color: color-mix(in srgb, currentColor ${settings.fontBrightness ?? 100}%, black) !important;
        }
      `}</style>
      <div 
        className="w-full max-w-7xl mx-auto h-[100dvh] shadow-2xl relative overflow-hidden flex flex-col md:flex-row pb-16 md:pb-0"
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CharacterCreate />} />
          <Route path="/hub" element={<GameHub />} />
          <Route path="/game" element={<Game />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/events" element={<Events />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/pic" element={<AdminPic />} />
          <Route path="/admin/video" element={<AdminVideo />} />
          <Route path="/admin/store" element={<AdminStore />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/ai" element={<AdminAI />} />
          <Route path="/admin/audio" element={<AdminAudio />} />
          <Route path="/admin/text" element={<AdminText />} />
          <Route path="/admin/role" element={<AdminUsers />} />
          <Route path="/admin/stat" element={<AdminStat />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <BottomNav />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
