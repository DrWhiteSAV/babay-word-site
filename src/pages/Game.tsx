import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  const {
    character, fear, energy, useEnergy, addFear, settings, gallery, addToGallery,
    addWatermelons, inventory, watermelons, lastEnergyUpdate, bossLevel,
    globalBackgroundUrl, pageBackgrounds, storeConfig, friends,
  } = usePlayerStore();
  const { profile } = useTelegram();
  const tgId = profile?.telegram_id;

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
  const aiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [pendingRetryStage, setPendingRetryStage] = useState<number | null>(null);

  // World generation phase
  const [isGeneratingWorld, setIsGeneratingWorld] = useState(false);
  const [worldReady, setWorldReady] = useState(false);

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
  const chatEndRef = useRef<HTMLDivElement>(null);

  // PVP State
  const [isPvpLobby, setIsPvpLobby] = useState(false);
  const [pvpParticipants, setPvpParticipants] = useState<string[]>([]);
  const [localFear, setLocalFear] = useState(0);
  const [localWatermelons, setLocalWatermelons] = useState(0);
  const [exitedEarly, setExitedEarly] = useState(false);

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

  // PVP results
  useEffect(() => {
    if (isGameOver && pvpParticipants.length > 0 && !pvpResults) {
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
  }, [isGameOver, pvpParticipants, pvpResults, localFear, localWatermelons, maxStages, exitedEarly, addFear, addWatermelons]);

  const getDefaultGameBg = () => {
    const gameBg = pageBackgrounds["/game"];
    if (gameBg?.url) return gameBg.url;
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

  // Check if current stage triggers boss battle
  const isBossStage = (s: number, diff: Difficulty) => {
    if (diff === "Сложная") return s === 16;
    if (diff === "Невозможная") return s === 46;
    return false; // No boss in Endless
  };

  // Check if current stage shows boss warning
  const isBossWarningStage = (s: number, diff: Difficulty) => {
    if (diff === "Сложная") return s === 15;
    if (diff === "Невозможная") return s === 45;
    return false;
  };

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
    setLocalWatermelons(0);
    setExitedEarly(false);
    setPvpResults(null);
    setIsGameOver(false);
    setWorldReady(false);

    const defaultBg = getDefaultGameBg();
    setBgImage(defaultBg);

    if (character) {
      setIsGeneratingWorld(true);
      setBgGenStatus("generating");

      const charData: Record<string, string> = {
        name: character.name,
        gender: character.gender,
        style: character.style,
        wishes: character.wishes.join(", "),
        telekinesis: String(character.telekinesisLevel),
        lore: character.lore || "",
        fear: String(fear),
        watermelons: String(watermelons),
        boss_level: String(bossLevel),
        username: profile?.username || "",
        first_name: profile?.first_name || "",
        telegram_id: String(tgId || ""),
        difficulty: diff,
      };

      try {
        const bgPromise = generateBackgroundImage(1, character.style, charData, tgId);
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000));
        const bgResult = await Promise.race([bgPromise, timeoutPromise]);

        if (bgResult && (bgResult as any).url && (bgResult as any).url.startsWith("http")) {
          const bgUrl = (bgResult as any).url;
          setBgImage(bgUrl);
          // Save to gallery DB (fire and forget — don't await)
          if (tgId) {
            saveImageToGallery(bgUrl, tgId, `[backgrounds] Фон: ${diff}`, (bgResult as any).prompt)
              .catch(console.error);
          }
        }
      } catch (e) {
        console.warn("[Game] bg gen failed:", e);
      }

      setBgGenStatus("done");
      setIsGeneratingWorld(false);
    }
  };

  const loadNextStage = async (currentStage: number) => {
    setIsLoading(true);
    setIsResultView(false);
    setShowBossWarning(false);

    const charData: Record<string, string> = character ? {
      name: character.name,
      gender: character.gender,
      style: character.style,
      wishes: character.wishes.join(", "),
      telekinesis: String(character.telekinesisLevel),
      lore: character.lore || "",
      fear: String(fear),
      watermelons: String(watermelons),
      boss_level: String(bossLevel),
      username: profile?.username || "",
      first_name: profile?.first_name || "",
      telegram_id: String(tgId || ""),
    } : {};

    const currentDiff = difficulty || "Сложная";

    // Boss warning stage (15 for Hard, 45 for Impossible)
    if (isBossWarningStage(currentStage, currentDiff)) {
      setBossWarningStage(currentStage);
      setShowBossWarning(true);
      setIsLoading(false);
      return;
    }

    // Boss battle stage (16 for Hard, 46 for Impossible; not in Endless)
    if (isBossStage(currentStage, currentDiff)) {
      const rewardMult = currentDiff === "Невозможная" ? 2 : 1;
      setBossRewardMultiplier(rewardMult);
      setBossTaps(0);
      setBossTimer(0);
      setIsBossDefeated(false);
      setBossImage("");
      setIsLoading(true);
      setIsBossBattle(true);

      if (character) {
        let retryCount = 0;
        let bossUrl = "";
        while (!bossUrl && retryCount < 3) {
          try {
            const bResult = await generateBossImage(currentStage, character.style, charData, tgId) as { url: string; prompt: string };
            if (bResult.url && bResult.url.startsWith("http")) {
              bossUrl = bResult.url;
              setBossImage(bossUrl);
              if (tgId) {
                saveImageToGallery(bossUrl, tgId, `[bosses] Босс ур.${bossLevel}`, bResult.prompt).catch(console.error);
              }
            }
          } catch (e) {
            console.warn("[Game] boss image retry", retryCount, e);
          }
          retryCount++;
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      setBossTimer(30 + getBossTimeBonus());
      setIsLoading(false);
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
      return;
    }

    if (character) {
      setAiRetry(false);
      setPendingRetryStage(currentStage);
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = setTimeout(() => {
        setAiRetry(true);
        setIsLoading(false);
      }, 30000);

      try {
        const newScenario = await generateScenario(currentStage, currentDiff, character.style, tgId);
        clearTimeout(aiTimeoutRef.current!);
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
      } catch (e) {
        clearTimeout(aiTimeoutRef.current!);
        setAiRetry(true);
        setIsLoading(false);
        return;
      }
    }
    setIsLoading(false);
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
      if (pvpParticipants.length > 0) setLocalFear(f => f + fearReward);
      else addFear(fearReward);
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

  const nextAfterResult = () => {
    const nextStage = stage + 1;
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
      if (pvpParticipants.length > 0) setLocalWatermelons(w => w + reward);
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

  // ======== SCREENS ========

  if (isGameOver) {
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
          <button onClick={() => setIsPvpLobby(true)} className="w-full p-6 bg-neutral-900 border border-neutral-800 rounded-2xl text-left hover:border-red-900 transition-colors group lightning-btn">
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
    <div className="flex-1 flex flex-col bg-transparent text-white relative">
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
        {/* Boss image as blurred background when in boss battle */}
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
      <header className="relative z-10 flex justify-between items-center p-4 bg-neutral-950/50 backdrop-blur-sm border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (pvpParticipants.length > 0) { setExitedEarly(true); setIsGameOver(true); }
              else navigate("/hub");
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
            className="w-48 mb-6 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]"
          />
          <p className="text-sm uppercase tracking-widest text-red-500 animate-pulse font-bold mb-2">Создаю мир игры...</p>
          <p className="text-xs text-neutral-500">Генерирую атмосферный фон</p>
        </div>
      )}

      {/* World ready — show "Let's go" button before first stage */}
      {!isGeneratingWorld && difficulty && !worldReady && !isDanilChat && !isBossBattle && !showBossWarning && stage === 1 && !scenario && !aiRetry && (
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
      {!isGeneratingWorld && (worldReady || stage > 1 || isDanilChat || isBossBattle || showBossWarning) && (
        <div className="relative z-10 flex-1 flex flex-col p-6 overflow-y-auto pb-24">
          <AnimatePresence mode="wait">
            {isLoading && !isBossBattle ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center text-neutral-500">
                <motion.img animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 2 }} src="https://i.ibb.co/BVgY7XrT/babai.png" alt="Loading" className="w-48 mb-6 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
                <p className="text-sm uppercase tracking-widest text-red-500 animate-pulse font-bold">Генерация кошмара...</p>
              </motion.div>
            ) : aiRetry ? (
              <motion.div key="retry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center gap-6">
                <p className="text-neutral-400 text-lg">ИИ молчит уже 30 секунд...</p>
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

                {isLoading || !bossImage ? (
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
                      onClick={async () => {
                        if (bossImage && tgId && bossImage.includes("ibb.co")) {
                          saveImageToGallery(bossImage, tgId, `[bosses] Победа над боссом ур. ${bossLevel}!`, undefined).catch(console.error);
                        }
                        setIsBossBattle(false);
                        setIsGameOver(true);
                      }}
                      className="px-8 py-4 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold flex items-center gap-2"
                    >
                      ФИНИШ! <ArrowRight size={18} />
                    </button>
                  </div>
                ) : !isLoading && bossImage ? (
                  <p className="mt-6 text-neutral-400 animate-pulse">ТАПАЙ ПО БОССУ!</p>
                ) : null}
              </motion.div>
            ) : isDanilChat ? (
              <motion.div key="chat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col">
                {/* Danil chat bg uses game background (bgImage) */}
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
                  style={{ backgroundImage: bgImage ? `url(${bgImage})` : undefined }}
                />
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-800 relative z-10">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-red-900 shrink-0">
                    <img src={DANIL_AVATAR} alt="ДанИИл" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">ДанИИл</h3>
                    <p className="text-xs text-green-500">В сети</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pb-4 relative z-10">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.sender === "danil" && (
                        <img src={DANIL_AVATAR} alt="ДанИИл" className="w-7 h-7 rounded-full object-cover mr-2 shrink-0 self-end" />
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
              <motion.div key="scenario" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col overflow-y-auto">
                <div className="flex items-center justify-center py-8 min-h-[120px]">
                  <p className="text-lg md:text-xl leading-relaxed font-medium text-center" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {scenario.text}
                  </p>
                </div>
                <div className="space-y-3 mt-auto">
                  {scenario.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleOptionSelect(i)}
                      className="w-full p-4 bg-neutral-900/80 backdrop-blur-md border border-neutral-800 hover:border-red-900 rounded-2xl text-left transition-all active:scale-95 text-sm md:text-base font-medium lightning-btn"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
