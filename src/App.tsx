import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { usePlayerStore } from "./store/playerStore";
import { TelegramProvider } from "./context/TelegramContext";
import { useState, useEffect, useRef } from "react";
import { useAudio, menuMusic, bgMusics } from "./hooks/useAudio";
import BottomNav from "./components/BottomNav";
import { CutscenePlayer } from "./components/CutscenePlayer";
import { supabase } from "./integrations/supabase/client";
import { NotificationPopupProvider } from "./components/NotificationPopup";
import { useOnlinePresence } from "./hooks/useOnlinePresence";
import { useAchievements } from "./hooks/useAchievements";
import { usePlayerStatsSync } from "./hooks/usePlayerStatsSync";
import { useIncomingMessageNotifier } from "./hooks/useIncomingMessageNotifier";
import { useGroupChatsSync } from "./hooks/useGroupChatsSync";
import { useTelegram } from "./context/TelegramContext";
import { protalkGenerateText } from "./services/protalk";

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
import Achievements from "./pages/Achievements";
import Chats from "./pages/Chats";
import Admin from "./pages/Admin";
import AdminPic from "./pages/AdminPic";
import AdminVideo from "./pages/AdminVideo";
import AdminStore from "./pages/AdminStore";
import AdminUsers from "./pages/AdminUsers";
import AdminAI from "./pages/AdminAI";
import AdminAudio from "./pages/AdminAudio";
import AdminText from "./pages/AdminText";
import AdminStat from "./pages/AdminStat";
import AdminNotifications from "./pages/AdminNotifications";
import AdminImages from "./pages/AdminImages";
import AdminEvents from "./pages/AdminEvents";
import AdminAchievements from "./pages/AdminAchievements";
import NotificationSettings from "./pages/NotificationSettings";
import TelegramOnly from "./pages/TelegramOnly";
import PvpSetup from "./pages/PvpSetup";
import PvpRoom from "./pages/PvpRoom";
import PvpResults from "./pages/PvpResults";

/** Restricts a route to Супер-Бабай and Ад-Бабай only */
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { profile, isLoading } = useTelegram();
  if (isLoading) return null;
  const allowed = profile?.role === "Супер-Бабай" || profile?.role === "Ад-Бабай";
  if (!allowed) return <Navigate to="/hub" replace />;
  return <>{children}</>;
}

function AppContent() {
  const { entryMode, isLoading, profile } = useTelegram();
  const [hasSeenInitialCutscene, setHasSeenInitialCutscene] = useState(false);
  const { updateEnergy, settings, globalBackgroundUrl, setGlobalBackgroundUrl, character, pageBackgrounds, setPageBackground, setVideoCutscenes } = usePlayerStore();
  const { playClick } = useAudio(settings.musicVolume);
  const location = useLocation();
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const restartSentRef = useRef(false);

  // Send /restart to ProTalk once when profile is loaded — skip in Lovable editor
  useEffect(() => {
    if (!isLoading && profile && !restartSentRef.current && entryMode !== "lovable") {
      restartSentRef.current = true;
      protalkGenerateText("/restart", profile.telegram_id).catch(() => {});
    }
  }, [isLoading, profile, entryMode]);

  // Sync player stats and achievements
  usePlayerStatsSync();
  useOnlinePresence();
  useAchievements();
  useIncomingMessageNotifier();
  useGroupChatsSync();


  // Load page backgrounds and video cutscenes from Supabase on startup
  useEffect(() => {
    const loadRemoteData = async () => {
      const [bgResult, videoResult] = await Promise.all([
        supabase.from("page_backgrounds").select("page_path, url, dimming"),
        supabase.from("video_cutscenes").select("orientation, url, sort_order").order("sort_order"),
      ]);

      if (bgResult.data && bgResult.data.length > 0) {
        bgResult.data.forEach(row => {
          setPageBackground(row.page_path, row.url || "", row.dimming ?? 80);
        });
      }

      if (videoResult.data && videoResult.data.length > 0) {
        const vertical = videoResult.data.filter(d => d.orientation === "vertical").map(d => d.url);
        const horizontal = videoResult.data.filter(d => d.orientation === "horizontal").map(d => d.url);
        setVideoCutscenes(vertical, horizontal);
      }
    };
    loadRemoteData();
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
    "Special Elite": "font-special-elite",
    "Cinzel Decorative": "font-cinzel-decorative",
    "Nunito": "font-nunito",
    "Marck Script": "font-marck-script",
    "Cuprum": "font-cuprum",
    "Lobster": "font-lobster",
    "Pacifico": "font-pacifico",
    "Comfortaa": "font-comfortaa",
  };

  const fontClass = fontFamilyMap[settings.fontFamily] || "font-jetbrains";
  const themeClassMap: Record<string, string> = {
    cyberpunk: "theme-cyberpunk",
    horror: "theme-horror",
    steampunk: "theme-steampunk",
    anime: "theme-anime",
    soviet: "theme-soviet",
    fairytale: "theme-fairytale",
    cartoon: "theme-cartoon",
    fantasy: "theme-fantasy",
  };
  const themeClass = themeClassMap[settings.theme] || "";

  const buttonSizeClass = 
    settings.buttonSize === "small" ? "btn-small" :
    settings.buttonSize === "large" ? "btn-large" : "btn-medium";

  const currentPath = location.pathname;
  const customBg = pageBackgrounds?.[currentPath];
  const activeBgUrl = customBg?.url || globalBackgroundUrl;

  // Calculate dimming values based on customBg.dimming (0-100)
  const dimmingTop = customBg ? customBg.dimming / 100 : 0.8;
  const dimmingBottom = customBg ? Math.min(1, (customBg.dimming + 15) / 100) : 0.95;

  return (
    <>
      <div 
        className={`min-h-[100dvh] bg-neutral-950 text-neutral-100 ${fontClass} ${themeClass} selection:bg-red-900 selection:text-white ${buttonSizeClass}`}
        style={activeBgUrl ? {
          backgroundImage: `linear-gradient(to bottom, rgba(23, 23, 23, ${dimmingTop}), rgba(23, 23, 23, ${dimmingBottom})), url(${activeBgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        } : {}}
      >
        <NotificationPopupProvider />
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
          <Route path="/settings/notifications" element={<NotificationSettings />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/events" element={<Events />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/chats" element={<Chats />} />
          <Route path="/pvp" element={<PvpSetup />} />
          <Route path="/pvp/room/:roomId" element={<PvpRoom />} />
          <Route path="/pvp/results/:roomId" element={<PvpResults />} />
          <Route path="/admin" element={<AdminGuard><Admin /></AdminGuard>} />
          <Route path="/admin/pic" element={<AdminGuard><AdminPic /></AdminGuard>} />
          <Route path="/admin/video" element={<AdminGuard><AdminVideo /></AdminGuard>} />
          <Route path="/admin/store" element={<AdminGuard><AdminStore /></AdminGuard>} />
          <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
          <Route path="/admin/ai" element={<AdminGuard><AdminAI /></AdminGuard>} />
          <Route path="/admin/audio" element={<AdminGuard><AdminAudio /></AdminGuard>} />
          <Route path="/admin/text" element={<AdminGuard><AdminText /></AdminGuard>} />
          <Route path="/admin/role" element={<AdminGuard><AdminUsers /></AdminGuard>} />
          <Route path="/admin/stat" element={<AdminGuard><AdminStat /></AdminGuard>} />
          <Route path="/admin/notifications" element={<AdminGuard><AdminNotifications /></AdminGuard>} />
          <Route path="/admin/images" element={<AdminGuard><AdminImages /></AdminGuard>} />
          <Route path="/admin/events" element={<AdminGuard><AdminEvents /></AdminGuard>} />
          <Route path="/admin/achievements" element={<AdminGuard><AdminAchievements /></AdminGuard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <BottomNav />
      </div>
    </div>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <TelegramProvider>
        <AppContent />
      </TelegramProvider>
    </Router>
  );
}
