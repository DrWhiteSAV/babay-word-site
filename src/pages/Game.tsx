import { useState, useEffect, useRef, useCallback } from "react";
import DemoWall from "../components/DemoWall";
import ProfilePopup from "../components/ProfilePopup";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { usePlayerStore } from "../store/playerStore";
import {
  generateScenario,
  generateFriendChat,
  generateBackgroundImage,
  generateSpookyVoice,
  generateBossImage,
} from "../services/ai";
import { playScreamer, playSuccess, playClick } from "../services/sfx";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, ArrowRight, ArrowLeft, Skull, Zap, MessageSquare, X, RefreshCw } from "lucide-react";
import { saveImageToGallery } from "../utils/galleryUtils";
import { useTelegram } from "../context/TelegramContext";

const DANIL_AVATAR = "https://i.ibb.co/rKGSq544/image.png";

type Difficulty = "Сложная" | "Невозможная" | "Бесконечная";

interface Scenario {
  text: string;
  options: string[];
  correctAnswer: number;
  successText: string;
  failureText: string;
}

export default function Game() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pvpRoomId = searchParams.get("pvp") || null;
  const pvpDiffParam = searchParams.get("diff") as Difficulty | null;
  const {
    character, fear, energy, useEnergy, addFear, settings, gallery, addToGallery,
    addWatermelons, inventory, watermelons, lastEnergyUpdate, bossLevel,
    globalBackgroundUrl, pageBackgrounds, storeConfig, friends,
  } = usePlayerStore();
  const { profile } = useTelegram();
  const tgId = profile?.telegram_id;
  // Always-fresh ref so async callbacks get the latest telegram_id regardless of closure staleness
  const tgIdRef = useRef<number | undefined>(undefined);
  useEffect(() => { tgIdRef.current = profile?.telegram_id; }, [profile?.telegram_id]);

  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [stage, setStage] = useState(1);
  const [maxStages, setMaxStages] = useState(15);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bgImage, setBgImage] = useState<string>("");
  const [bgGenStatus, setBgGenStatus] = useState<"idle" | "generating" | "done">("idle");
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [showScreamer, setShowScreamer] = useState(false);
  const [showSuccessAvatar, setShowSuccessAvatar] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [aiRetry, setAiRetry] = useState(false);
  const [stageCountdown, setStageCountdown] = useState(0);
  const aiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stageCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const [pendingRetryStage, setPendingRetryStage] = useState<number | null>(null);

  // World generation phase
  const [isGeneratingWorld, setIsGeneratingWorld] = useState(false);
  const [worldReady, setWorldReady] = useState(false);
  const [bgGenCountdown, setBgGenCountdown] = useState(0);
  const [bgGenRetry, setBgGenRetry] = useState(false);
  const bgGenIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bgGenResolvedRef = useRef(false);

  // Result State
  const [isResultView, setIsResultView] = useState(false);
  const [resultText, setResultText] = useState("");
  const [lastChoiceCorrect, setLastChoiceCorrect] = useState(false);

  // Boss Battle State
  const [isBossBattle, setIsBossBattle] = useState(false);
  const [bossTaps, setBossTaps] = useState(0);
  const [bossTimer, setBossTimer] = useState(0);
  const [bossImage, setBossImage] = useState("");
  const [isBossDefeated, setIsBossDefeated] = useState(false);
  const [bossRewardMultiplier, setBossRewardMultiplier] = useState(1);

  // Boss preparation phase (60s countdown + rules before battle)
  const [isBossPreparation, setIsBossPreparation] = useState(false);
  const [bossPreparationCountdown, setBossPreparationCountdown] = useState(60);
  const [bossImageReady, setBossImageReady] = useState(false);
  const [bossGenRetry, setBossGenRetry] = useState(false);
  const bossPreparationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bossImageReadyRef = useRef(false);

  // Boss warning (stage 15 / 45)
  const [showBossWarning, setShowBossWarning] = useState(false);
  const [bossWarningStage, setBossWarningStage] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bossTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Danil Chat State
  const [isDanilChat, setIsDanilChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ sender: "user" | "danil"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isDanilTyping, setIsDanilTyping] = useState(false);
  const [showDanilProfile, setShowDanilProfile] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // PVP State
  const [isPvpLobby, setIsPvpLobby] = useState(false);
  const [pvpParticipants, setPvpParticipants] = useState<string[]>([]);
  const [localFear, setLocalFear] = useState(0);
  const localFearRef = useRef(0); // always-fresh ref for async closures
  const [localWatermelons, setLocalWatermelons] = useState(0);
  const localWatermelonsRef = useRef(0); // always-fresh ref for async closures
  const [exitedEarly, setExitedEarly] = useState(false);
  const exitedEarlyRef = useRef(false);

  interface PvpResult { name: string; fear: number; watermelons: number; isLocal: boolean; exited?: boolean; }
  const [pvpResults, setPvpResults] = useState<PvpResult[] | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      const diff = now - lastEnergyUpdate;
      const regenRateMs = storeConfig.energyRegenMinutes * 60 * 1000;
      const remaining = regenRateMs - (diff % regenRateMs);
      setTimeLeft(Math.floor(remaining / 1000));
    };
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [lastEnergyUpdate]);

  useEffect(() => {
    if (!character) navigate("/");
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [character, navigate]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = settings.musicVolume / 100;
  }, [settings.musicVolume]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Boss timer countdown
  useEffect(() => {
    if (isBossBattle && bossTimer > 0 && !isBossDefeated) {
      bossTimerRef.current = setTimeout(() => setBossTimer(t => t - 1), 1000);
    } else if (isBossBattle && bossTimer === 0 && !isBossDefeated && bossImage) {
      alert("Время вышло! Босс оказался сильнее...");
      setIsBossBattle(false);
      const nextStage = stage + 1;
      setStage(nextStage);
      loadNextStage(nextStage);
    }
    return () => { if (bossTimerRef.current) clearTimeout(bossTimerRef.current); };
  }, [isBossBattle, bossTimer, isBossDefeated, bossImage]);

  // PVP room: auto-start game when arrived via ?pvp= param
  useEffect(() => {
    if (pvpRoomId && pvpDiffParam && !difficulty && character) {
      startGame(pvpDiffParam);
      setDifficulty(pvpDiffParam);
      setMaxStages(pvpDiffParam === "Сложная" ? 16 : 46);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pvpRoomId, pvpDiffParam, character]);

  // PVP: write timeout to DB (used on early exit / app close)
  const writePvpTimeout = useCallback(async (roomId: string, tid: number) => {
    const score = localFearRef.current;
    console.log(`[DB WRITE] 📝 PVP timeout: tgId=${tid}, room=${roomId}, score=${score}`);
    await supabase.from("pvp_room_members").update({
      status: "timeout",
      score,
      finished_at: new Date().toISOString(),
    }).eq("room_id", roomId).eq("telegram_id", tid);
  }, []);

  // PVP: on app hide / close → mark as timeout via beacon so it fires even on tab close
  useEffect(() => {
    if (!pvpRoomId || !tgId) return;
    const onHide = () => {
      if (exitedEarlyRef.current || pvpSavedRef.current) return;
      // Use sendBeacon for reliability on tab close
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/pvp_room_members?room_id=eq.${pvpRoomId}&telegram_id=eq.${tgId}`;
      const body = JSON.stringify({ status: "timeout", score: localFearRef.current, finished_at: new Date().toISOString() });
      navigator.sendBeacon
        ? navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))
        : writePvpTimeout(pvpRoomId, tgId);
    };
    document.addEventListener("visibilitychange", () => { if (document.hidden) onHide(); });
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", () => { if (document.hidden) onHide(); });
      window.removeEventListener("pagehide", onHide);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pvpRoomId, tgId]);

  // PVP room: report finish to DB when game over, then navigate
  const [pvpSaved, setPvpSaved] = useState(false);
  const pvpSavedRef = useRef(false);
  useEffect(() => {
    if (!pvpRoomId || !tgId || !isGameOver || pvpSaved) return;
    setPvpSaved(true);
    pvpSavedRef.current = true;
    const finalScore = localFearRef.current;
    const finalWatermelons = localWatermelonsRef.current;
    const exited = exitedEarlyRef.current;
    console.log(`[DB WRITE] 📝 PVP finish: tgId=${tgId}, room=${pvpRoomId}, score=${finalScore}, watermelons=${finalWatermelons}, exited=${exited}`);
    (async () => {
      const { error } = await supabase.from("pvp_room_members").update({
        status: exited ? "timeout" : "finished",
        score: finalScore,
        watermelons: exited ? 0 : finalWatermelons,
        finished_at: new Date().toISOString(),
      }).eq("room_id", pvpRoomId).eq("telegram_id", tgId);
      console.log(`[DB WRITE] 📝 pvp_room_members update result:`, error ? `ERROR: ${error.message}` : "OK");

      // First finisher → set timer_ends_at
      const { data: roomData } = await supabase
        .from("pvp_rooms").select("timer_ends_at, difficulty").eq("id", pvpRoomId).single();
      if (roomData && !roomData.timer_ends_at && !exited) {
        const waitMinutes = roomData.difficulty === "Невозможная" ? 10 : 3;
        const timerEndsAt = new Date(Date.now() + waitMinutes * 60 * 1000).toISOString();
        await supabase.from("pvp_rooms").update({ timer_ends_at: timerEndsAt }).eq("id", pvpRoomId);
      }

      // All done → close room
      const { data: membersData } = await supabase
        .from("pvp_room_members").select("status").eq("room_id", pvpRoomId);
      const stillPlaying = (membersData || []).filter(m => m.status === "playing" || m.status === "joined");
      if (stillPlaying.length === 0) {
        await supabase.from("pvp_rooms").update({ status: "finished" }).eq("id", pvpRoomId);
      }

      navigate(`/pvp/results/${pvpRoomId}`, { replace: true });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGameOver, pvpRoomId, tgId, pvpSaved]);

  // PVP results (old local sim — keep for non-room PVP legacy)
  useEffect(() => {
    if (isGameOver && pvpParticipants.length > 0 && !pvpResults && !pvpRoomId) {
      const results: { name: string; fear: number; watermelons: number; isLocal: boolean; exited?: boolean }[] = pvpParticipants.map(p => {
        const successRate = 0.5 + Math.random() * 0.4;
        const simulatedFear = Math.floor(maxStages * successRate);
        const simulatedWatermelons = Math.floor(Math.random() * 25);
        return { name: p, fear: simulatedFear, watermelons: simulatedWatermelons, isLocal: false };
      });
      results.push({ name: "Вы", fear: exitedEarly ? 0 : localFear, watermelons: exitedEarly ? 0 : localWatermelons, isLocal: true, exited: exitedEarly });
      results.sort((a, b) => b.fear - a.fear);
      setPvpResults(results);
      if (results[0].isLocal && !exitedEarly) {
        addFear(results.reduce((sum, r) => sum + r.fear, 0));
        addWatermelons(results.reduce((sum, r) => sum + r.watermelons, 0));
      }
    }
  }, [isGameOver, pvpParticipants, pvpResults, pvpRoomId, localFear, localWatermelons, maxStages, exitedEarly, addFear, addWatermelons]);

  const getDefaultGameBg = () => {
    const gameBgs = pageBackgrounds["/game"];
    if (gameBgs && gameBgs.length > 0) {
      const picked = gameBgs[Math.floor(Math.random() * gameBgs.length)];
      if (picked.url) return picked.url;
    }
    if (globalBackgroundUrl) return globalBackgroundUrl;
    return "https://i.ibb.co/BVgY7XrT/babai.png";
  };

  const getBossTimeBonus = () => {
    if (inventory.includes("pajama_star")) return 15;
    if (inventory.includes("pajama_forest")) return 5;
    if (inventory.includes("pajama_home")) return 1;
    return 0;
  };

  const getTapDamage = () => {
    if (inventory.includes("tongue_chameleon")) return 4;
    if (inventory.includes("tongue_anteater")) return 3;
    if (inventory.includes("tongue_frog")) return 2;
    return 1;
  };

  const isBossStage = (s: number, diff: Difficulty) => {
    if (diff === "Сложная") return s === 16;
    if (diff === "Невозможная") return s === 46;
    return false;
  };

  const isBossWarningStage = (s: number, diff: Difficulty) => {
    if (diff === "Сложная") return s === 15;
    if (diff === "Невозможная") return s === 45;
    return false;
  };

  // -------- Generate boss image and save to gallery --------
  const generateBossImageWithSave = useCallback(async (currentStage: number, charData: Record<string, string>) => {
    if (!character) return;
    try {
      const bResult = await generateBossImage(currentStage, character.style, charData, tgId) as { url: string; prompt: string };
      if (bResult?.url && bResult.url.startsWith("http")) {
        setBossImage(bResult.url);
        bossImageReadyRef.current = true;
        setBossImageReady(true);
        // Save to gallery [bosses] via saveImageToGallery (unified approach)
        const activeTgId = tgIdRef.current ?? tgId ?? (charData ? Number(charData.telegram_id) || undefined : undefined);
        const bossLvl = charData?.boss_level || String(bossLevel || currentStage);
        const bossLabel = `[bosses] Босс ур.${bossLvl}`;
        console.log(`[Game] 👹 boss ready, tgId=${activeTgId}, label="${bossLabel}", saving to gallery...`);
        if (activeTgId) {
          saveImageToGallery(bResult.url, activeTgId, bossLabel, bResult.prompt)
            .then(saved => console.log("[Game] 📦 boss gallery save:", saved ? "ok" : "failed"))
            .catch(console.error);
        } else {
          console.warn("[Game] ⚠️ no tgId — boss not saved to gallery");
        }
        // Auto-launch battle if still in preparation phase
        if (bossPreparationIntervalRef.current) {
          clearInterval(bossPreparationIntervalRef.current);
        }
        // Small delay then start battle
        await new Promise(r => setTimeout(r, 1200));
        setIsBossPreparation(false);
        setIsBossBattle(true);
        setBossTimer(30 + getBossTimeBonus());
      } else {
        // Bad format — show retry
        if (!bossImageReadyRef.current) {
          if (bossPreparationIntervalRef.current) clearInterval(bossPreparationIntervalRef.current);
          setBossGenRetry(true);
        }
      }
    } catch {
      if (!bossImageReadyRef.current) {
        if (bossPreparationIntervalRef.current) clearInterval(bossPreparationIntervalRef.current);
        setBossGenRetry(true);
      }
    }
  }, [character, tgId, profile, bossLevel, difficulty, inventory]);

  // -------- Start boss preparation phase after "Я готов к бою!" --------
  const launchBossPreparation = useCallback((currentStage: number, charData: Record<string, string>) => {
    const rewardMult = (difficulty || "Сложная") === "Невозможная" ? 2 : 1;
    setBossRewardMultiplier(rewardMult);
    setBossTaps(0);
    setBossTimer(0);
    setIsBossDefeated(false);
    setBossImage("");
    bossImageReadyRef.current = false;
    setBossImageReady(false);
    setBossGenRetry(false);
    setBossPreparationCountdown(120);
    setIsBossPreparation(true);
    setIsBossBattle(false);

    // Start 120s countdown
    let countdown = 120;
    if (bossPreparationIntervalRef.current) clearInterval(bossPreparationIntervalRef.current);
    bossPreparationIntervalRef.current = setInterval(() => {
      countdown -= 1;
      setBossPreparationCountdown(countdown);
      if (countdown <= 0) {
        clearInterval(bossPreparationIntervalRef.current!);
        // If image not ready yet, show retry
        if (!bossImageReadyRef.current) {
          setBossGenRetry(true);
        }
      }
    }, 1000);

    // Generate boss image in background (non-blocking)
    generateBossImageWithSave(currentStage, charData);
  }, [difficulty, generateBossImageWithSave]);

  const retryBossImageGen = useCallback((currentStage: number) => {
    setBossGenRetry(false);
    bossImageReadyRef.current = false;
    setBossPreparationCountdown(120);
    let countdown = 120;
    if (bossPreparationIntervalRef.current) clearInterval(bossPreparationIntervalRef.current);
    bossPreparationIntervalRef.current = setInterval(() => {
      countdown -= 1;
      setBossPreparationCountdown(countdown);
      if (countdown <= 0) {
        clearInterval(bossPreparationIntervalRef.current!);
        if (!bossImageReadyRef.current) setBossGenRetry(true);
      }
    }, 1000);
    if (character) {
      const charData: Record<string, string> = {
        name: character.name, gender: character.gender, style: character.style,
        wishes: character.wishes.join(", "), telekinesis: String(character.telekinesisLevel),
        lore: character.lore || "", fear: String(fear), watermelons: String(watermelons),
        boss_level: String(bossLevel), username: profile?.username || "",
        first_name: profile?.first_name || "", telegram_id: String(tgId || ""),
      };
      generateBossImageWithSave(currentStage, charData);
    }
  }, [character, fear, watermelons, bossLevel, profile, tgId, generateBossImageWithSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bossPreparationIntervalRef.current) clearInterval(bossPreparationIntervalRef.current);
      if (bgGenIntervalRef.current) clearInterval(bgGenIntervalRef.current);
      if (stageCountdownRef.current) clearTimeout(stageCountdownRef.current);
    };
  }, []);

  const startGame = async (diff: Difficulty) => {
    const cost = diff === "Сложная" ? 3 : diff === "Невозможная" ? 15 : 50;
    if (!useEnergy(cost)) {
      alert("Недостаточно энергии!");
      return;
    }

    setDifficulty(diff);
    setMaxStages(diff === "Сложная" ? 16 : diff === "Невозможная" ? 46 : Infinity);
    setStage(1);
    setScore(0);
    setLocalFear(0);
    localFearRef.current = 0;
    setLocalWatermelons(0);
    localWatermelonsRef.current = 0;
    setExitedEarly(false);
    exitedEarlyRef.current = false;
    setPvpResults(null);
    setIsGameOver(false);
    setWorldReady(false);
    setBgGenRetry(false);
    bgGenResolvedRef.current = false;

    const defaultBg = getDefaultGameBg();
    setBgImage(defaultBg);

    if (character) {
      setIsGeneratingWorld(true);
      setBgGenStatus("generating");

      const charData: Record<string, string> = {
        name: character.name, gender: character.gender, style: character.style,
        wishes: character.wishes.join(", "), telekinesis: String(character.telekinesisLevel),
        lore: character.lore || "", fear: String(fear), watermelons: String(watermelons),
        boss_level: String(bossLevel), username: profile?.username || "",
        first_name: profile?.first_name || "", telegram_id: String(tgId || ""),
        difficulty: diff,
      };

      // Start 120s countdown for background gen
      let countdown = 120;
      setBgGenCountdown(120);
      if (bgGenIntervalRef.current) clearInterval(bgGenIntervalRef.current);
      bgGenIntervalRef.current = setInterval(() => {
        countdown -= 1;
        setBgGenCountdown(countdown);
        if (countdown <= 0) {
          clearInterval(bgGenIntervalRef.current!);
          if (!bgGenResolvedRef.current) {
            setBgGenRetry(true);
          }
        }
      }, 1000);

      try {
        const bgPromise = generateBackgroundImage(1, character.style, charData, tgId);
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 120000));
        const bgResult = await Promise.race([bgPromise, timeoutPromise]);

        if (bgGenIntervalRef.current) clearInterval(bgGenIntervalRef.current);

        if (bgResult && (bgResult as any).url && (bgResult as any).url.startsWith("http")) {
          bgGenResolvedRef.current = true;
          const bgUrl = (bgResult as any).url;
          setBgImage(bgUrl);
          setBgGenRetry(false);
          // Save to gallery [backgrounds] via saveImageToGallery (unified approach)
          const charTgId = Number(charData?.telegram_id) || undefined;
          const activeTgId = tgIdRef.current ?? tgId ?? charTgId;
          console.log(`[Game] 🖼 background ready, tgId=${activeTgId}, saving to gallery...`);
          if (activeTgId) {
            saveImageToGallery(bgUrl, activeTgId, `[backgrounds] Фон: ${diff}`, (bgResult as any).prompt)
              .then(saved => console.log("[Game] 📦 bg gallery save:", saved ? "ok" : "failed"))
              .catch(console.error);
          } else {
            console.warn("[Game] ⚠️ no tgId — bg not saved to gallery");
          }
        } else {
          if (!bgGenResolvedRef.current) setBgGenRetry(true);
        }
      } catch {
        if (bgGenIntervalRef.current) clearInterval(bgGenIntervalRef.current);
        setBgGenRetry(true);
      }

      setBgGenStatus("done");
      setIsGeneratingWorld(false);
    }
  };

  const retryBgGen = async () => {
    if (!character) return;
    setBgGenRetry(false);
    bgGenResolvedRef.current = false;
    setBgGenCountdown(120);
    setIsGeneratingWorld(true);

    const diff = difficulty || "Сложная";
    const charData: Record<string, string> = {
      name: character.name, gender: character.gender, style: character.style,
      wishes: character.wishes.join(", "), telekinesis: String(character.telekinesisLevel),
      lore: character.lore || "", fear: String(fear), watermelons: String(watermelons),
      boss_level: String(bossLevel), username: profile?.username || "",
      first_name: profile?.first_name || "", telegram_id: String(tgId || ""),
      difficulty: diff,
    };

    let countdown = 120;
    if (bgGenIntervalRef.current) clearInterval(bgGenIntervalRef.current);
    bgGenIntervalRef.current = setInterval(() => {
      countdown -= 1;
      setBgGenCountdown(countdown);
      if (countdown <= 0) {
        clearInterval(bgGenIntervalRef.current!);
        if (!bgGenResolvedRef.current) setBgGenRetry(true);
      }
    }, 1000);

    try {
      const bgResult = await generateBackgroundImage(1, character.style, charData, tgId);
      if (bgGenIntervalRef.current) clearInterval(bgGenIntervalRef.current);
      if (bgResult?.url && bgResult.url.startsWith("http")) {
        bgGenResolvedRef.current = true;
        setBgImage(bgResult.url);
        setBgGenRetry(false);
        const charTgId2 = Number(charData?.telegram_id) || undefined;
        const activeTgId = tgIdRef.current ?? tgId ?? charTgId2;
        console.log(`[Game] 🔁 retry bg ready, tgId=${activeTgId}, saving to gallery...`);
        if (activeTgId) {
          saveImageToGallery(bgResult.url, activeTgId, `[backgrounds] Фон: ${diff}`, bgResult.prompt)
            .then(saved => console.log("[Game] 📦 retry bg gallery save:", saved ? "ok" : "failed"))
            .catch(console.error);
        } else {
          console.warn("[Game] ⚠️ no tgId on retry — bg not saved to gallery");
        }
      } else {
        setBgGenRetry(true);
      }
    } catch {
      if (bgGenIntervalRef.current) clearInterval(bgGenIntervalRef.current);
      setBgGenRetry(true);
    }
    setIsGeneratingWorld(false);
  };

  const loadNextStage = async (currentStage: number) => {
    setIsLoading(true);
    setIsResultView(false);
    setShowBossWarning(false);
    setAiRetry(false);
    setStageCountdown(20);

    const charData: Record<string, string> = character ? {
      name: character.name, gender: character.gender, style: character.style,
      wishes: character.wishes.join(", "), telekinesis: String(character.telekinesisLevel),
      lore: character.lore || "", fear: String(fear), watermelons: String(watermelons),
      boss_level: String(bossLevel), username: profile?.username || "",
      first_name: profile?.first_name || "", telegram_id: String(tgId || ""),
    } : {};

    const currentDiff = difficulty || "Сложная";

    // Boss warning stage
    if (isBossWarningStage(currentStage, currentDiff)) {
      setBossWarningStage(currentStage);
      setShowBossWarning(true);
      setIsLoading(false);
      setStageCountdown(0);
      return;
    }

    // Boss battle stage → now goes to preparation phase
    if (isBossStage(currentStage, currentDiff)) {
      setIsLoading(false);
      setStageCountdown(0);
      launchBossPreparation(currentStage, charData);
      return;
    }

    // Danil chat every 5th stage
    if (currentStage > 1 && currentStage % 5 === 0) {
      setIsDanilChat(true);
      setChatMessages([{
        sender: "danil",
        text: `Ну что, ${character?.name}, как успехи на ${currentStage} этаже?`,
      }]);
      setIsLoading(false);
      setStageCountdown(0);
      return;
    }

    if (character) {
      setAiRetry(false);
      setPendingRetryStage(currentStage);

      // 20s countdown
      let countdown = 20;
      setStageCountdown(20);
      if (stageCountdownRef.current) clearTimeout(stageCountdownRef.current);
      const countInterval = setInterval(() => {
        countdown -= 1;
        setStageCountdown(countdown);
        if (countdown <= 0) clearInterval(countInterval);
      }, 1000);

      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = setTimeout(() => {
        clearInterval(countInterval);
        setAiRetry(true);
        setIsLoading(false);
        setStageCountdown(0);
      }, 20000);

      try {
        // Resolve inventory item IDs to their display names from shop
        const { shopItems: storeShopItems, bossItems: storeBossItems } = usePlayerStore.getState();
        const allShopItems = [...storeShopItems, ...storeBossItems];
        const inventoryNames = inventory
          .map(id => allShopItems.find(si => si.id === id)?.name)
          .filter(Boolean)
          .join(", ") || "нет предметов";
        const charDataForScenario = {
          name: character.name, gender: character.gender, style: character.style,
          wishes: character.wishes.join(", "), inventory: inventoryNames,
          lore: character.lore || "", telekinesis: String(character.telekinesisLevel),
        };
        const newScenario = await generateScenario(currentStage, currentDiff, character.style, tgId, charDataForScenario);
        clearTimeout(aiTimeoutRef.current!);
        clearInterval(countInterval);
        setStageCountdown(0);
        setAiRetry(false);

        if (!newScenario?.text || !newScenario?.options?.length) {
          setAiRetry(true);
          setIsLoading(false);
          return;
        }
        setScenario(newScenario);

        if (settings.ttsEnabled) {
          generateSpookyVoice(newScenario.text).then((audioData) => {
            if (audioData && audioRef.current) {
              audioRef.current.src = audioData;
              audioRef.current.play().catch(() => {});
            }
          });
        }
      } catch {
        clearTimeout(aiTimeoutRef.current!);
        clearInterval(countInterval);
        setStageCountdown(0);
        setAiRetry(true);
        setIsLoading(false);
        return;
      }
    }
    setIsLoading(false);
    setStageCountdown(0);
  };

  const handleOptionSelect = async (index: number) => {
    if (!scenario) return;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }

    const isCorrect = index === scenario.correctAnswer;
    setLastChoiceCorrect(isCorrect);
    setResultText(isCorrect ? scenario.successText : scenario.failureText);

    if (isCorrect) {
      const fearReward = 1 + (character ? (character.telekinesisLevel - 1) * storeConfig.telekinesisRewardBonus : 0);
      // PVP real-room OR legacy local sim: track score locally, don't add to global store yet
      if (pvpRoomId || pvpParticipants.length > 0) {
        setLocalFear(f => {
          const next = f + fearReward;
          localFearRef.current = next;
          return next;
        });
      } else addFear(fearReward);
      setScore(s => s + 1);
      playSuccess(settings.musicVolume);
      setShowSuccessAvatar(true);
      await new Promise(r => setTimeout(r, 1000));
      setShowSuccessAvatar(false);
    } else {
      setShowScreamer(true);
      playScreamer(settings.musicVolume);
      await new Promise(r => setTimeout(r, 800));
      setShowScreamer(false);
    }

    setIsResultView(true);
  };

  // Demo mode: show wall after stage 1
  const [showDemoWall, setShowDemoWall] = useState(false);
  const isDemo = profile?.role === "Демо";

  const nextAfterResult = () => {
    const nextStage = stage + 1;

    // Demo users can only play 1 stage
    if (isDemo && nextStage > 1) {
      setShowDemoWall(true);
      return;
    }

    if (nextStage > maxStages) {
      setIsGameOver(true);
    } else {
      setStage(nextStage);
      loadNextStage(nextStage);
    }
  };

  const handleBossTap = () => {
    if (isBossDefeated) return;
    const newTaps = bossTaps + getTapDamage();
    setBossTaps(newTaps);
    const maxHp = 100 * Math.pow(2, bossLevel - 1);
    const reward = Math.floor(storeConfig.bossRewardBase * Math.pow(storeConfig.bossRewardMultiplier, bossLevel - 1) * bossRewardMultiplier);
    if (newTaps >= maxHp) {
      setIsBossDefeated(true);
      if (pvpRoomId || pvpParticipants.length > 0) setLocalWatermelons(w => {
        const next = w + reward;
        localWatermelonsRef.current = next;
        return next;
      });
      else addWatermelons(reward);
      playSuccess(settings.musicVolume);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !character) return;
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { sender: "user", text: userMsg }]);
    setChatInput("");
    setIsDanilTyping(true);
    const recentMessages = chatMessages.slice(-10);
    const danilReply = await generateFriendChat(userMsg, "ДанИИл", character, character.style, recentMessages, undefined, tgId);
    setChatMessages(prev => [...prev, { sender: "danil", text: danilReply }]);
    setIsDanilTyping(false);
  };

  const continueAfterChat = () => {
    setIsDanilChat(false);
    const nextStage = stage + 1;
    setStage(nextStage);
    loadNextStage(nextStage);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleInviteFriend = (friendName: string) => {
    if (!pvpParticipants.includes(friendName)) setPvpParticipants([...pvpParticipants, friendName]);
  };

  const startPvpGame = async (diff: Difficulty) => {
    const cost = diff === "Сложная" ? 3 : diff === "Невозможная" ? 15 : 50;
    if (!useEnergy(cost)) { alert("Недостаточно энергии!"); return; }
    setDifficulty(diff);
    setMaxStages(diff === "Сложная" ? 16 : diff === "Невозможная" ? 46 : Infinity);
    setStage(1);
    setScore(0);
    setLocalFear(0);
    setLocalWatermelons(0);
    setExitedEarly(false);
    setPvpResults(null);
    setIsGameOver(false);
    setIsPvpLobby(false);
    setBgImage(getDefaultGameBg());
    await startGame(diff);
  };

  const getBossRules = () => {
    const maxHp = 100 * Math.pow(2, bossLevel - 1);
    const timeLimit = 30 + getBossTimeBonus();
    const damage = getTapDamage();
    return {
      maxHp,
      timeLimit,
      damage,
      reward: Math.floor(storeConfig.bossRewardBase * Math.pow(storeConfig.bossRewardMultiplier, bossLevel - 1) * bossRewardMultiplier),
    };
  };

  // ======== DEMO WALL ========
  if (showDemoWall) {
    return <DemoWall showCutscene />;
  }

  // ======== SCREENS ========

  if (isGameOver) {
    // PVP room mode → show loading while DB write + redirect happen in useEffect
    if (pvpRoomId) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-red-500" />
        </div>
      );
    }
    if (pvpParticipants.length > 0 && pvpResults) {
      const isWinner = pvpResults[0].isLocal && !exitedEarly;
      const totalFear = pvpResults.reduce((sum, r) => sum + r.fear, 0);
      const totalWatermelons = pvpResults.reduce((sum, r) => sum + r.watermelons, 0);
      return (
        <div className="flex-1 flex flex-col p-6 text-white relative z-10 overflow-y-auto">
          <h1 className="text-2xl font-black text-red-600 uppercase tracking-tighter mb-6">Итоги PVP</h1>
          <div className="flex-1 space-y-4">
            {isWinner ? (
              <div className="p-4 bg-green-900/50 border border-green-500 rounded-xl text-center mb-4">
                <h2 className="text-xl font-bold text-green-400">ВЫ ПОБЕДИЛИ!</h2>
                <p className="text-sm text-green-200 mt-1">Вы забираете весь банк: <span className="text-red-400 font-bold">{totalFear} 💀</span> + <span className="text-green-400 font-bold">{totalWatermelons} 🍉</span></p>
              </div>
            ) : (
              <div className="p-4 bg-red-900/50 border border-red-500 rounded-xl text-center mb-4">
                <h2 className="text-xl font-bold text-red-400">ВЫ ПРОИГРАЛИ</h2>
              </div>
            )}
            {pvpResults.map((res, idx) => (
              <div key={res.name} className={`flex items-center justify-between p-3 rounded-xl border ${res.isLocal ? 'bg-neutral-800 border-neutral-600' : 'bg-neutral-900 border-neutral-800'}`}>
                <span className="font-bold text-neutral-500 w-4">{idx + 1}.</span>
                <span className={`flex-1 font-bold ${res.isLocal ? 'text-white' : 'text-neutral-300'}`}>{res.name}</span>
                <span className="text-red-500 text-sm font-bold mr-2"><Skull size={12} className="inline" /> {res.fear}</span>
                <span className="text-green-500 text-sm font-bold">🍉 {res.watermelons}</span>
              </div>
            ))}
          </div>
          <button onClick={() => { playClick(settings.musicVolume); navigate("/hub"); }} className="w-full mt-6 p-4 bg-red-700 hover:bg-red-600 rounded-xl font-bold text-lg transition-colors">ВЕРНУТЬСЯ В ХАБ</button>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-white text-center relative z-10">
        <img src="https://i.ibb.co/BVgY7XrT/babai.png" alt="Bab-AI" className="w-48 mb-6 drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]" />
        <h2 className="text-4xl font-black text-red-600 mb-4 uppercase tracking-tighter" style={{ fontFamily: "'Playfair Display', serif" }}>ИГРА ОКОНЧЕНА</h2>
        <p className="text-xl mb-8 text-neutral-400">Успешно выгнано жильцов: <span className="text-red-500 font-bold">{score}</span></p>
        <button onClick={() => { playClick(settings.musicVolume); navigate("/hub"); }} className="px-8 py-4 bg-red-700 hover:bg-red-600 rounded-xl font-bold text-lg transition-colors">ВЕРНУТЬСЯ В ХАБ</button>
      </div>
    );
  }

  // Difficulty selection screen
  if (!difficulty && !isPvpLobby) {
    return (
      <div className="flex-1 flex flex-col p-6 text-white relative z-10 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <button onClick={() => navigate("/hub")} className="p-2 bg-neutral-900 rounded-full"><X size={20} /></button>
          <div className="flex gap-4 font-bold">
            <div className="flex flex-col items-center">
              <span className="text-yellow-500 flex items-center gap-1"><Zap size={16} /> {energy}</span>
              <div className="text-[10px] text-yellow-500/70 font-bold -mt-1">{formatTime(timeLeft)}</div>
            </div>
            <span className="text-red-500 flex items-center gap-1"><Skull size={16} /> {fear}</span>
            <span className="text-green-500 flex items-center gap-1">🍉 {watermelons}</span>
          </div>
        </header>

        <h2 className="text-3xl font-black text-red-600 uppercase tracking-tighter mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>Выбор сложности</h2>

        <div className="space-y-4">
          <button onClick={() => startGame("Сложная")} className="w-full p-6 bg-neutral-900 border border-neutral-800 rounded-2xl text-left hover:border-red-900 transition-colors group lightning-btn">
            <h3 className="text-xl font-bold text-white group-hover:text-red-500 transition-colors">Сложная</h3>
            <p className="text-neutral-400 text-sm mt-1">15 этапов + босс на 16м. Стоимость: <span className="text-yellow-400 font-bold">3 <Zap size={12} className="inline" /></span></p>
          </button>
          <button onClick={() => startGame("Невозможная")} className="w-full p-6 bg-neutral-900 border border-neutral-800 rounded-2xl text-left hover:border-red-900 transition-colors group lightning-btn">
            <h3 className="text-xl font-bold text-white group-hover:text-red-500 transition-colors">Невозможная</h3>
            <p className="text-neutral-400 text-sm mt-1">45 этапов + босс на 46м (×2 награда). Стоимость: <span className="text-yellow-400 font-bold">15 <Zap size={12} className="inline" /></span></p>
          </button>
          <button onClick={() => startGame("Бесконечная")} className="w-full p-6 bg-neutral-900 border border-neutral-800 rounded-2xl text-left hover:border-red-900 transition-colors group lightning-btn">
            <h3 className="text-xl font-bold text-white group-hover:text-red-500 transition-colors">Бесконечная</h3>
            <p className="text-neutral-400 text-sm mt-1">Без конца, без боссов. Стоимость: <span className="text-yellow-400 font-bold">50 <Zap size={12} className="inline" /></span></p>
          </button>
          <button onClick={() => navigate("/pvp")} className="w-full p-6 bg-neutral-900 border border-neutral-800 rounded-2xl text-left hover:border-red-900 transition-colors group lightning-btn">
            <h3 className="text-xl font-bold text-white group-hover:text-red-500 transition-colors">PVP Бабаев</h3>
            <p className="text-neutral-400 text-sm mt-1">Групповое участие с друзьями.</p>
          </button>
        </div>
      </div>
    );
  }

  if (isPvpLobby) {
    return (
      <div className="flex-1 flex flex-col p-6 bg-transparent text-white relative z-10">
        <header className="flex justify-between items-center mb-8">
          <button onClick={() => setIsPvpLobby(false)} className="p-2 bg-neutral-900 rounded-full"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-bold uppercase tracking-widest">PVP Комната</h1>
          <div className="w-10" />
        </header>
        <div className="flex-1 overflow-y-auto space-y-6">
          <section>
            <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">Пригласить друзей</h2>
            <div className="space-y-2">
              {friends.map(friend => (
                <div key={friend.name} className="flex items-center justify-between p-3 bg-neutral-900 rounded-xl border border-neutral-800">
                  <span className="font-bold">{friend.name}</span>
                  <button onClick={() => handleInviteFriend(friend.name)} disabled={pvpParticipants.includes(friend.name)} className="px-4 py-2 bg-red-900 hover:bg-red-800 rounded-lg text-sm font-bold disabled:opacity-50">
                    {pvpParticipants.includes(friend.name) ? "Приглашен" : "Пригласить"}
                  </button>
                </div>
              ))}
            </div>
          </section>
          {pvpParticipants.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">Выберите сложность</h2>
              <div className="space-y-4">
                {(["Сложная", "Невозможная"] as Difficulty[]).map(diff => (
                  <button key={diff} onClick={() => startPvpGame(diff)} className="w-full p-4 bg-neutral-900 border border-neutral-800 rounded-xl text-left hover:border-red-900 transition-colors">
                    <h3 className="text-lg font-bold text-white">{diff}</h3>
                    <p className="text-neutral-400 text-sm mt-1">Стоимость: {diff === "Сложная" ? 3 : 15} <Zap size={12} className="inline text-yellow-500" /></p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  // Main game screen
  return (
    <div className="flex-1 flex flex-col bg-transparent text-white relative overflow-y-auto">
      <AnimatePresence>
        {showScreamer && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center bg-red-900">
            <Skull size={250} className="text-black animate-ping" />
          </motion.div>
        )}
        {showSuccessAvatar && character && (
          <motion.div initial={{ opacity: 0, scale: 0.5, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.2 }} className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <img src={character.avatarUrl} alt="Success" className="w-64 h-64 rounded-full object-cover border-4 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.8)]" />
          </motion.div>
        )}
      </AnimatePresence>

      <audio ref={audioRef} className="hidden" />

      {/* Background Image */}
      <div className="fixed inset-0 z-0 bg-neutral-950">
        {isBossBattle && bossImage && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none blur-xl scale-110"
            style={{ backgroundImage: `url(${bossImage})` }}
          />
        )}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50 pointer-events-none transition-opacity duration-1000"
          style={{ backgroundImage: bgImage ? `url(${bgImage})` : undefined }}
        />
      </div>
      <div className="fixed inset-0 z-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent pointer-events-none" />

      <div className="fog-container">
        <div className="fog-layer"></div>
        <div className="fog-layer-2"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-4 pt-12 bg-neutral-950/50 backdrop-blur-sm border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              if (pvpRoomId && tgId) {
                // PVP real room: write timeout immediately then go to lobby
                exitedEarlyRef.current = true;
                pvpSavedRef.current = true;
                await writePvpTimeout(pvpRoomId, tgId);
                navigate(`/pvp/room/${pvpRoomId}`, { replace: true });
              } else if (pvpParticipants.length > 0) {
                exitedEarlyRef.current = true;
                setExitedEarly(true);
                setIsGameOver(true);
              } else navigate("/hub");
            }}
            className="p-2 bg-neutral-900/80 rounded-full hover:bg-neutral-800 transition-colors"
          >
            <X size={18} />
          </button>
          <div>
            <div className="text-xs text-neutral-400 uppercase tracking-widest font-bold">Этап {stage}</div>
            <div className="text-sm font-bold text-red-500">{difficulty}</div>
          </div>
        </div>
        <div className="flex gap-3 font-bold text-sm">
          {bgGenStatus === "generating" && (
            <span className="text-yellow-400 flex items-center gap-1 text-xs"><Loader2 size={12} className="animate-spin" /> Мир</span>
          )}
          <span className="text-red-500 flex items-center gap-1"><Skull size={14} /> {pvpParticipants.length > 0 ? localFear : fear}</span>
          <span className="text-green-500 flex items-center gap-1">🍉 {pvpParticipants.length > 0 ? localWatermelons : watermelons}</span>
        </div>
      </header>

      {/* World generation screen */}
      {isGeneratingWorld && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center">
          <motion.img
            animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ repeat: Infinity, duration: 2 }}
            src="https://i.ibb.co/BVgY7XrT/babai.png"
            alt="Creating world"
            className="w-40 mb-6 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]"
          />
          <p className="text-sm uppercase tracking-widest text-red-500 animate-pulse font-bold mb-3">Создаю мир игры...</p>
          {!bgGenRetry ? (
            <>
              {/* Countdown circle */}
              <div className="relative w-20 h-20 mb-4">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" stroke="#1f1f1f" strokeWidth="6" fill="none" />
                  <circle
                    cx="40" cy="40" r="34"
                    stroke="#ef4444"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - bgGenCountdown / 60)}`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-white">{bgGenCountdown}</span>
              </div>
              <p className="text-xs text-neutral-500">Генерирую атмосферный фон...</p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 mt-2">
              <p className="text-neutral-400 text-sm">ИИ что-то завис...</p>
              <button
                onClick={retryBgGen}
                className="px-6 py-3 bg-red-800 hover:bg-red-700 rounded-xl font-bold text-white flex items-center gap-2"
              >
                <RefreshCw size={18} /> ИИ тупит, Давай ещё раз?
              </button>
              <button
                onClick={() => { setBgGenRetry(false); setIsGeneratingWorld(false); }}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-sm text-neutral-300"
              >
                Пропустить, играть без фона
              </button>
            </div>
          )}
        </div>
      )}

      {/* World ready — show "Let's go" button before first stage */}
      {!isGeneratingWorld && difficulty && !worldReady && !isDanilChat && !isBossBattle && !isBossPreparation && !showBossWarning && stage === 1 && !scenario && !aiRetry && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center">
          <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src={character?.avatarUrl || "https://i.ibb.co/BVgY7XrT/babai.png"}
            alt="Babai"
            className="w-40 h-40 rounded-full object-cover border-4 border-red-700 shadow-[0_0_30px_rgba(220,38,38,0.4)] mb-6"
          />
          <p className="text-xl font-bold text-white mb-2">Мир создан!</p>
          <p className="text-sm text-neutral-400 mb-8">Готов пугать жильцов?</p>
          <button
            onClick={() => { setWorldReady(true); loadNextStage(1); }}
            className="px-8 py-4 bg-red-700 hover:bg-red-600 rounded-xl font-bold text-lg transition-colors shadow-[0_0_20px_rgba(220,38,38,0.4)]"
          >
            Полетели всех пугать! 👻
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {!isGeneratingWorld && (worldReady || stage > 1 || isDanilChat || isBossBattle || isBossPreparation || showBossWarning) && (
        <div className="relative z-10 flex-1 flex flex-col p-4 overflow-y-auto pb-28 min-h-0" style={{ maxHeight: 'calc(100dvh - 80px)' }}>
          <AnimatePresence mode="wait">

            {/* --- STAGE LOADING with countdown --- */}
            {isLoading && !isBossBattle && !isBossPreparation ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center text-neutral-500">
                <motion.img animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 2 }} src="https://i.ibb.co/BVgY7XrT/babai.png" alt="Loading" className="w-40 mb-4 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
                <p className="text-sm uppercase tracking-widest text-red-500 animate-pulse font-bold mb-4">Генерация кошмара...</p>
                {stageCountdown > 0 && (
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="26" stroke="#1f1f1f" strokeWidth="5" fill="none" />
                      <circle
                        cx="32" cy="32" r="26"
                        stroke="#ef4444"
                        strokeWidth="5"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 26}`}
                        strokeDashoffset={`${2 * Math.PI * 26 * (1 - stageCountdown / 20)}`}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-base font-black text-white">{stageCountdown}</span>
                  </div>
                )}
              </motion.div>

            ) : aiRetry ? (
              <motion.div key="retry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center gap-6">
                <p className="text-neutral-400 text-lg">ИИ молчит уже 20 секунд...</p>
                <button
                  onClick={() => { setAiRetry(false); setIsLoading(true); if (pendingRetryStage !== null) loadNextStage(pendingRetryStage); }}
                  className="px-6 py-4 bg-red-800 hover:bg-red-700 rounded-xl font-bold text-white flex items-center gap-2 text-lg"
                >
                  <RefreshCw size={20} /> ИИ тупит, Давай ещё раз?
                </button>
              </motion.div>

            ) : showBossWarning ? (
              // Boss warning screen (stage 15/45)
              <motion.div key="boss-warning" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center text-center gap-6">
                <div className="text-8xl animate-pulse">👹</div>
                <h2 className="text-3xl font-black text-red-600 uppercase tracking-tight">ВНИМАНИЕ!</h2>
                <p className="text-lg text-neutral-300 max-w-xs leading-relaxed">
                  Ты на {bossWarningStage} этаже. Следующий этап — <span className="text-red-500 font-bold">БИТВА С БОССОМ!</span>
                  {difficulty === "Невозможная" && <><br /><span className="text-yellow-400 text-sm mt-2 block">× 2 награда за победу!</span></>}
                </p>
                <p className="text-neutral-500 text-sm">ДанИИл: «Приготовься. Там серьёзный противник. Длинный язык — единственное твоё оружие.»</p>
                <button
                  onClick={() => {
                    setShowBossWarning(false);
                    const nextStage = stage + 1;
                    setStage(nextStage);
                    loadNextStage(nextStage);
                  }}
                  className="px-8 py-4 bg-red-700 hover:bg-red-600 rounded-xl font-bold text-lg transition-colors shadow-[0_0_20px_rgba(220,38,38,0.5)]"
                >
                  Я готов к бою! ⚔️
                </button>
              </motion.div>

            ) : isBossPreparation ? (
              // --- BOSS PREPARATION PHASE ---
              <motion.div key="boss-prep" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-start text-center gap-5 pt-4 overflow-y-auto">
                <div className="text-6xl mb-1">⚔️</div>
                <h2 className="text-2xl font-black text-red-500 uppercase tracking-tight">Подготовка к бою</h2>

                {/* Countdown or image ready */}
                {!bossGenRetry && !bossImageReady && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative w-20 h-20">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="34" stroke="#1f1f1f" strokeWidth="6" fill="none" />
                        <circle
                          cx="40" cy="40" r="34"
                          stroke="#ef4444"
                          strokeWidth="6"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 34}`}
                          strokeDashoffset={`${2 * Math.PI * 34 * (1 - bossPreparationCountdown / 60)}`}
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-white">{bossPreparationCountdown}</span>
                    </div>
                    <p className="text-xs text-neutral-500 flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" /> Вызываю босса из тьмы...
                    </p>
                    <p className="text-xs text-yellow-400/70">⚡ Матч может начаться раньше отсчёта — как только босс появится!</p>
                  </div>
                )}

                {bossImageReady && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-900/40 border border-green-600/40 rounded-xl">
                    <span className="text-green-400 text-lg">✅</span>
                    <p className="text-green-300 text-sm font-bold">Босс готов! Запускаю бой...</p>
                  </div>
                )}

                {bossGenRetry && (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-neutral-400 text-sm">Нейросеть не ответила вовремя...</p>
                    <button
                      onClick={() => retryBossImageGen(stage)}
                      className="px-6 py-3 bg-red-800 hover:bg-red-700 rounded-xl font-bold text-white flex items-center gap-2"
                    >
                      <RefreshCw size={18} /> ИИ тупит, Давай ещё раз?
                    </button>
                    <button
                      onClick={() => {
                        // Skip image, start battle with placeholder
                        if (bossPreparationIntervalRef.current) clearInterval(bossPreparationIntervalRef.current);
                        setBossImage("https://i.ibb.co/BVgY7XrT/babai.png");
                        setIsBossPreparation(false);
                        setIsBossBattle(true);
                        setBossTimer(30 + getBossTimeBonus());
                      }}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-sm text-neutral-300"
                    >
                      Биться вслепую 👊
                    </button>
                  </div>
                )}

                {/* Boss rules */}
                {(() => {
                  const rules = getBossRules();
                  return (
                    <div className="w-full max-w-xs bg-neutral-900/80 border border-red-900/40 rounded-2xl p-4 text-left space-y-3 mt-1">
                      <h3 className="font-black text-red-400 uppercase tracking-widest text-xs mb-3">Правила битвы</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400">Уровень босса</span>
                          <span className="font-bold text-white">👹 Ур. {bossLevel}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400">HP босса</span>
                          <span className="font-bold text-red-400">{rules.maxHp} ударов</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400">Твой урон за тап</span>
                          <span className="font-bold text-yellow-400">×{rules.damage}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400">Время на бой</span>
                          <span className="font-bold text-orange-400">{rules.timeLimit} сек</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400">Награда за победу</span>
                          <span className="font-bold text-green-400">🍉 {rules.reward}</span>
                        </div>
                        {bossRewardMultiplier > 1 && (
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-400">Бонус</span>
                            <span className="font-bold text-yellow-400">× {bossRewardMultiplier} награда!</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 pt-2 border-t border-neutral-800">
                        Тапай по боссу как можно быстрее — уничтожь его раньше, чем закончится время!
                      </p>
                    </div>
                  );
                })()}
              </motion.div>

            ) : isBossBattle ? (
              <motion.div key="boss" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-black text-red-600 uppercase tracking-tighter mb-2">
                    БИТВА С БОССОМ (УР. {bossLevel})
                    {bossRewardMultiplier > 1 && <span className="text-yellow-400 ml-2">× {bossRewardMultiplier}</span>}
                  </h3>
                  <div className="flex gap-4 justify-center">
                    <span className="text-yellow-500">ВРЕМЯ: {bossTimer}с</span>
                    <span className="text-red-500">УДАРЫ: {bossTaps}/{100 * Math.pow(2, bossLevel - 1)}</span>
                  </div>
                </div>

                {!bossImage ? (
                  <div className="w-64 h-64 rounded-3xl border-4 border-red-900 flex items-center justify-center bg-neutral-900">
                    <Loader2 size={48} className="animate-spin text-red-500" />
                  </div>
                ) : (
                  <div
                    onClick={handleBossTap}
                    className="relative w-64 h-64 md:w-80 md:h-80 rounded-3xl overflow-hidden border-4 border-red-900 shadow-[0_0_50px_rgba(220,38,38,0.4)] cursor-pointer active:scale-95 transition-transform"
                  >
                    <img src={bossImage} alt="Boss" className="w-full h-full object-cover" />
                    {isBossDefeated && (
                      <div className="absolute inset-0 bg-green-500/40 flex items-center justify-center">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-white font-black text-4xl uppercase">ПОБЕДА!</motion.div>
                      </div>
                    )}
                  </div>
                )}

                {isBossDefeated ? (
                  <div className="mt-8 text-center space-y-4">
                    <p className="text-green-400 font-bold">
                      Вы одолели босса и получили {Math.floor(storeConfig.bossRewardBase * Math.pow(storeConfig.bossRewardMultiplier, bossLevel - 1) * bossRewardMultiplier)} 🍉!
                    </p>
                    <button
                      onClick={() => {
                        setIsBossBattle(false);
                        setIsGameOver(true);
                      }}
                      className="px-8 py-4 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold flex items-center gap-2"
                    >
                      ФИНИШ! <ArrowRight size={18} />
                    </button>
                  </div>
                ) : bossImage ? (
                  <p className="mt-6 text-neutral-400 animate-pulse">ТАПАЙ ПО БОССУ!</p>
                ) : null}
              </motion.div>

            ) : isDanilChat ? (
              <motion.div key="chat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col">
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
                  style={{ backgroundImage: bgImage ? `url(${bgImage})` : undefined }}
                />
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-800 relative z-10">
                  <button
                    className="w-10 h-10 rounded-full overflow-hidden border border-red-900 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setShowDanilProfile(true)}
                  >
                    <img src={DANIL_AVATAR} alt="ДанИИл" className="w-full h-full object-cover" />
                  </button>
                  <div>
                    <button className="font-bold text-lg hover:text-red-400 transition-colors" onClick={() => setShowDanilProfile(true)}>ДанИИл</button>
                    <p className="text-xs text-green-500">В сети</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pb-4 relative z-10">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.sender === "danil" && (
                        <button onClick={() => setShowDanilProfile(true)} className="shrink-0 self-end mr-2">
                          <img src={DANIL_AVATAR} alt="ДанИИл" className="w-7 h-7 rounded-full object-cover" />
                        </button>
                      )}
                      <div className={`max-w-[80%] p-3 rounded-2xl ${msg.sender === "user" ? "bg-red-900 text-white rounded-tr-sm" : "bg-neutral-800 text-neutral-200 rounded-tl-sm"}`}>
                        <p className="text-sm">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                  {isDanilTyping && (
                    <div className="flex justify-start">
                      <img src={DANIL_AVATAR} alt="ДанИИл" className="w-7 h-7 rounded-full object-cover mr-2 shrink-0 self-end" />
                      <div className="max-w-[80%] p-3 rounded-2xl bg-neutral-800 text-neutral-400 rounded-tl-sm flex gap-1">
                        <span className="animate-bounce">.</span><span className="animate-bounce delay-100">.</span><span className="animate-bounce delay-200">.</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {chatMessages.length > 1 && chatMessages[chatMessages.length - 1].sender === "danil" ? (
                  <button onClick={continueAfterChat} className="w-full py-4 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 mt-4 relative z-10">
                    Продолжить путь <ArrowRight size={18} />
                  </button>
                ) : (
                  <div className="flex gap-2 mt-4 relative z-10">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                      placeholder="Написать ДанИИлу..."
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-900 transition-colors"
                    />
                    <button
                      onClick={handleSendChat}
                      disabled={!chatInput.trim() || isDanilTyping}
                      className="p-3 bg-red-700 hover:bg-red-600 rounded-xl disabled:opacity-50 transition-colors"
                    >
                      <MessageSquare size={20} />
                    </button>
                  </div>
                )}
              </motion.div>

            ) : isResultView ? (
              <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col items-center justify-center text-center">
                <div className={`text-2xl font-black mb-6 uppercase tracking-widest ${lastChoiceCorrect ? 'text-green-500' : 'text-red-500'}`}>
                  {lastChoiceCorrect ? 'УСПЕХ' : 'ПРОВАЛ'}
                </div>
                <p className="text-lg md:text-xl leading-relaxed mb-12 italic font-serif">{resultText}</p>
                <button onClick={nextAfterResult} className="w-full py-4 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                  ПРОДОЛЖИТЬ <ArrowRight size={18} />
                </button>
              </motion.div>

            ) : scenario ? (
              <motion.div key="scenario" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="overflow-y-auto flex-1 pb-6 -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <div className="py-4">
                    <p className="text-base md:text-lg leading-relaxed font-medium text-center" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {scenario.text}
                    </p>
                  </div>
                  <div className="space-y-3 mt-2 pb-4">
                    {scenario.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleOptionSelect(i)}
                        className="w-full p-3 bg-neutral-900/80 backdrop-blur-md border border-neutral-800 hover:border-red-900 rounded-2xl text-left transition-all active:scale-95 text-sm font-medium lightning-btn"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      )}
      {showDanilProfile && (
        <ProfilePopup name="ДанИИл" onClose={() => setShowDanilProfile(false)} />
      )}
    </div>
  );
}
