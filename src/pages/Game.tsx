import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Skull,
  Zap,
  MessageSquare,
  X,
} from "lucide-react";
import { CutscenePlayer } from "../components/CutscenePlayer";
import { saveImageToGallery } from "../utils/galleryUtils";
import { useTelegram } from "../context/TelegramContext";

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
  const location = useLocation();
  const { character, fear, energy, useEnergy, addFear, settings, gallery, addToGallery, addWatermelons, inventory, watermelons, lastEnergyUpdate, bossLevel, globalBackgroundUrl, pageBackgrounds, storeConfig } =
    usePlayerStore();
  const { profile } = useTelegram();
  const tgId = profile?.telegram_id;
    
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [stage, setStage] = useState(1);
  const [maxStages, setMaxStages] = useState(15);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bgImage, setBgImage] = useState<string>("");
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [showScreamer, setShowScreamer] = useState(false);
  const [showSuccessAvatar, setShowSuccessAvatar] = useState(false);
  const [showCutscene, setShowCutscene] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

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

  // Result State
  const [isResultView, setIsResultView] = useState(false);
  const [resultText, setResultText] = useState("");
  const [lastChoiceCorrect, setLastChoiceCorrect] = useState(false);

  // Boss Battle State
  const [isBossBattle, setIsBossBattle] = useState(false);
  const [bossTaps, setBossTaps] = useState(0);
  const [bossTimer, setBossTimer] = useState(30);
  const [bossImage, setBossImage] = useState("");
  const [isBossDefeated, setIsBossDefeated] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bossTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Danil Chat State
  const [isDanilChat, setIsDanilChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { sender: "user" | "danil"; text: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [isDanilTyping, setIsDanilTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!character) navigate("/");
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [character, navigate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = settings.musicVolume / 100;
    }
  }, [settings.musicVolume]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  useEffect(() => {
    // bossTimer=0 means "not started yet" — don't count down or fail until it's been set to >0
    if (isBossBattle && bossTimer > 0 && !isBossDefeated) {
      bossTimerRef.current = setTimeout(() => setBossTimer(t => t - 1), 1000);
    } else if (isBossBattle && bossTimer === 0 && !isBossDefeated && bossImage) {
      // Only timeout if battle is active AND bossImage is loaded (timer was running)
      alert("Время вышло! Босс оказался сильнее...");
      setIsBossBattle(false);
      const nextStage = stage + 1;
      setStage(nextStage);
      loadNextStage(nextStage);
    }
    return () => {
      if (bossTimerRef.current) clearTimeout(bossTimerRef.current);
    };
  }, [isBossBattle, bossTimer, isBossDefeated, bossImage]);

  const startGame = async (diff: Difficulty) => {
    const cost = diff === "Сложная" ? 1 : diff === "Невозможная" ? 5 : 25;
    if (!useEnergy(cost)) {
      alert("Недостаточно энергии!");
      return;
    }

    setDifficulty(diff);
    setMaxStages(
      diff === "Сложная" ? 15 : diff === "Невозможная" ? 45 : Infinity,
    );
    setStage(1);
    setScore(0);
    setLocalFear(0);
    setLocalWatermelons(0);
    setExitedEarly(false);
    setPvpResults(null);
    setPvpParticipants([]);
    setIsGameOver(false);
    setShowCutscene(true);
    await loadNextStage(1);
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

  const loadNextStage = async (currentStage: number) => {
    setIsLoading(true);
    setIsResultView(false);

    // Build character data for macros
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
      telegram_id: String(profile?.telegram_id || ""),
    } : {};

    // tgId available from top-level const

    // Boss Battle check (stages 16 and 46)
    if (currentStage === 16 || currentStage === 46) {
      setShowCutscene(true);
      // Wait for cutscene to complete (at least 3s) then generate boss image
      setBossTaps(0);
      setBossTimer(0); // Timer not started yet
      setIsBossDefeated(false);
      setBossImage(""); // Clear previous boss image
      setIsLoading(true);

      if (character) {
        // Wait for cutscene + generate boss image in parallel
        const [bResult] = await Promise.all([
          generateBossImage(currentStage, character.style, charData, tgId),
          new Promise(r => setTimeout(r, 3000)), // min cutscene wait
        ]);
        const typedResult = bResult as { url: string; prompt: string };
        setBossImage(typedResult.url);
        // Save boss image to gallery via ImgBB/save-to-gallery
        if (tgId) {
          saveImageToGallery(typedResult.url, tgId, `Босс уровня ${bossLevel}`, typedResult.prompt).catch(console.error);
        }
        // Small delay for page to render the boss image before starting timer
        await new Promise(r => setTimeout(r, 1000));
      }

      setIsBossBattle(true);
      setBossTimer(30 + getBossTimeBonus()); // Start timer AFTER image loaded
      setIsLoading(false);
      return;
    }

    // Default background (always set first, then replace with generated one)
    const DEFAULT_GAME_BG = "https://i.ibb.co/BVgY7XrT/babai.png";
    if (!bgImage) setBgImage(globalBackgroundUrl || DEFAULT_GAME_BG);

    // Generate background image on stage 1 or every 5th stage
    if (currentStage === 1 || currentStage % 5 === 0) {
      if (character) {
        generateBackgroundImage(currentStage, character.style, charData, tgId).then((result) => {
          // Accept any URL including picsum - always set as bg
          if (result.url) {
            setBgImage(result.url);
            addToGallery(result.url);
            // Save to gallery via ImgBB/save-to-gallery (fire & forget) - only for non-picsum real images
            if (tgId && !result.url.includes("picsum.photos")) {
              saveImageToGallery(result.url, tgId, `Фон этапа ${currentStage}`, result.prompt).catch(console.error);
            }
          }
        }).catch(err => {
          console.warn("[Game] background gen failed:", err);
          // Keep the default background
        });
      }
    }

    // Check if it's Danil time (every 5th stage)
    if (currentStage > 1 && currentStage % 5 === 0) {
      setIsDanilChat(true);
      setChatMessages([
        {
          sender: "danil",
          text: `Ну что, ${character?.name}, как успехи на ${currentStage} этаже?`,
        },
      ]);
      setIsLoading(false);
      return;
    }

    if (character) {
      // Pre-generate next scenario before showing it
      const newScenario = await generateScenario(
        currentStage,
        difficulty || "Сложная",
        character.style,
        tgId,
      );
      setScenario(newScenario);

      // Generate spooky voice for the scenario
      if (settings.ttsEnabled) {
        generateSpookyVoice(newScenario.text).then((audioData) => {
          // Check if we are still on this stage and not loading
          if (audioData && audioRef.current && !isLoading) {
            audioRef.current.src = audioData;
            const hasInteracted = (navigator as any).userActivation ? (navigator as any).userActivation.hasBeenActive : true;
            if (hasInteracted) {
              audioRef.current
                .play()
                .catch((e) => console.log("Audio play blocked", e));
            }
          } else if (!audioData && !isLoading) {
            // Fallback to browser TTS if API fails
            if ('speechSynthesis' in window) {
              const hasInteracted = (navigator as any).userActivation ? (navigator as any).userActivation.hasBeenActive : true;
              if (hasInteracted) {
                window.speechSynthesis.cancel(); // Stop any previous speech
                const utterance = new SpeechSynthesisUtterance(newScenario.text);
                utterance.lang = 'ru-RU';
                utterance.pitch = 0.5;
                utterance.rate = 0.9;
                window.speechSynthesis.speak(utterance);
              }
            }
          }
        });
      }
    }
    setIsLoading(false);
  };

  const handleOptionSelect = async (index: number) => {
    if (!scenario) return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    const isCorrect = index === scenario.correctAnswer;
    setLastChoiceCorrect(isCorrect);
    setResultText(isCorrect ? scenario.successText : scenario.failureText);

    if (isCorrect) {
      const fearReward = 1 + (character ? (character.telekinesisLevel - 1) * storeConfig.telekinesisRewardBonus : 0);
      if (pvpParticipants.length > 0) {
        setLocalFear(f => f + fearReward);
      } else {
        addFear(fearReward);
      }
      setScore((s) => s + 1);
      playSuccess(settings.musicVolume);
      setShowSuccessAvatar(true);
      await new Promise((r) => setTimeout(r, 1000));
      setShowSuccessAvatar(false);
    } else {
      setShowScreamer(true);
      playScreamer(settings.musicVolume);
      await new Promise((r) => setTimeout(r, 800));
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
    const reward = storeConfig.bossRewardBase * Math.pow(storeConfig.bossRewardMultiplier, bossLevel - 1);

    if (newTaps >= maxHp) {
      setIsBossDefeated(true);
      if (pvpParticipants.length > 0) {
        setLocalWatermelons(w => w + reward);
      } else {
        addWatermelons(reward);
      }
      playSuccess(settings.musicVolume);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !character) return;

    const userMsg = chatInput;
    setChatMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setChatInput("");
    setIsDanilTyping(true);

    const recentMessages = chatMessages.slice(-10);
    const danilReply = await generateFriendChat(userMsg, "ДанИИл", character, character.style, recentMessages, undefined, profile?.telegram_id);
    setChatMessages((prev) => [...prev, { sender: "danil", text: danilReply }]);
    setIsDanilTyping(false);

    // After Danil replies, give a button to continue
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

  const [isPvpLobby, setIsPvpLobby] = useState(false);
  const [pvpParticipants, setPvpParticipants] = useState<string[]>([]);
  const [localFear, setLocalFear] = useState(0);
  const [localWatermelons, setLocalWatermelons] = useState(0);
  const [exitedEarly, setExitedEarly] = useState(false);
  const [pvpResults, setPvpResults] = useState<{name: string, fear: number, watermelons: number, isLocal: boolean, exited?: boolean}[] | null>(null);

  const { friends } = usePlayerStore();

  const handleInviteFriend = (friendName: string) => {
    if (!pvpParticipants.includes(friendName)) {
      setPvpParticipants([...pvpParticipants, friendName]);
    }
  };

  const startPvpGame = async (diff: Difficulty) => {
    const cost = diff === "Сложная" ? 1 : diff === "Невозможная" ? 5 : 25;
    if (!useEnergy(cost)) {
      alert("Недостаточно энергии!");
      return;
    }

    setDifficulty(diff);
    setMaxStages(diff === "Сложная" ? 15 : diff === "Невозможная" ? 45 : Infinity);
    setStage(1);
    setScore(0);
    setLocalFear(0);
    setLocalWatermelons(0);
    setExitedEarly(false);
    setPvpResults(null);
    setIsGameOver(false);
    setIsPvpLobby(false);
    setShowCutscene(true);
    await loadNextStage(1);
  };

  useEffect(() => {
    if (isGameOver && pvpParticipants.length > 0 && !pvpResults) {
      const results: {name: string, fear: number, watermelons: number, isLocal: boolean, exited?: boolean}[] = pvpParticipants.map(p => {
        const successRate = 0.5 + Math.random() * 0.4;
        const simulatedFear = Math.floor(maxStages * successRate);
        const numBosses = Math.floor(maxStages / 15);
        const simulatedWatermelons = numBosses > 0 ? Math.floor(Math.random() * 25 * numBosses) : 0;
        return { name: p, fear: simulatedFear, watermelons: simulatedWatermelons, isLocal: false };
      });
      
      results.push({ name: "Вы", fear: exitedEarly ? 0 : localFear, watermelons: exitedEarly ? 0 : localWatermelons, isLocal: true, exited: exitedEarly });
      
      results.sort((a, b) => b.fear - a.fear);
      
      setPvpResults(results);
      
      if (results[0].isLocal && !exitedEarly) {
        const totalFear = results.reduce((sum, r) => sum + r.fear, 0);
        const totalWatermelons = results.reduce((sum, r) => sum + r.watermelons, 0);
        addFear(totalFear);
        addWatermelons(totalWatermelons);
      }
    }
  }, [isGameOver, pvpParticipants, pvpResults, localFear, localWatermelons, maxStages, exitedEarly, addFear, addWatermelons]);

  if (isGameOver) {
    if (pvpParticipants.length > 0 && pvpResults) {
      const isWinner = pvpResults[0].isLocal && !exitedEarly;
      const totalFear = pvpResults.reduce((sum, r) => sum + r.fear, 0);
      const totalWatermelons = pvpResults.reduce((sum, r) => sum + r.watermelons, 0);

      return (
        <div className="flex-1 flex flex-col p-6 text-white relative z-10 overflow-y-auto">
          <header className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-black text-red-600 uppercase tracking-tighter">Итоги PVP</h1>
          </header>
          
          <div className="flex-1 space-y-4">
            {isWinner ? (
              <div className="p-4 bg-green-900/50 border border-green-500 rounded-xl text-center mb-6">
                <h2 className="text-xl font-bold text-green-400 mb-2">ВЫ ПОБЕДИЛИ!</h2>
                <p className="text-sm text-green-200">Вы забираете весь банк:</p>
                <div className="flex justify-center gap-4 mt-2 font-bold">
                  <span className="text-red-400 flex items-center gap-1"><Skull size={16} /> {totalFear}</span>
                  <span className="text-green-400 flex items-center gap-1">🍉 {totalWatermelons}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-red-900/50 border border-red-500 rounded-xl text-center mb-6">
                <h2 className="text-xl font-bold text-red-400 mb-2">ВЫ ПРОИГРАЛИ</h2>
                <p className="text-sm text-red-200">
                  {exitedEarly ? "Вы покинули игру и автоматически проиграли." : "Ваши достижения в этом забеге аннулированы."}
                </p>
              </div>
            )}

            <div className="space-y-2">
              {pvpResults.map((res, idx) => (
                <div key={res.name} className={`flex items-center justify-between p-3 rounded-xl border ${res.isLocal ? 'bg-neutral-800 border-neutral-600' : 'bg-neutral-900 border-neutral-800'}`}>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-neutral-500 w-4">{idx + 1}.</span>
                    <span className={`font-bold ${res.isLocal ? 'text-white' : 'text-neutral-300'}`}>
                      {res.name} {res.exited && <span className="text-xs text-red-500 ml-2">(Сбежал)</span>}
                    </span>
                  </div>
                  <div className="flex gap-3 text-sm font-bold">
                    <span className="text-red-500 flex items-center gap-1"><Skull size={14} /> {res.fear}</span>
                    <span className="text-green-500 flex items-center gap-1">🍉 {res.watermelons}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              playClick(settings.musicVolume);
              navigate("/hub");
            }}
            className="w-full mt-6 p-4 bg-red-700 hover:bg-red-600 rounded-xl font-bold text-lg transition-colors"
          >
            ВЕРНУТЬСЯ В ХАБ
          </button>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-white text-center relative z-10">
        <img 
          src="https://i.ibb.co/BVgY7XrT/babai.png" 
          alt="Bab-AI" 
          className="w-48 mb-6 drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]"
        />
        <h2 className="text-4xl font-black text-red-600 mb-4 uppercase tracking-tighter" style={{ fontFamily: "'Playfair Display', serif" }}>
          ИГРА ОКОНЧЕНА
        </h2>
        <p className="text-xl mb-2">Вы прошли {maxStages} этапов.</p>
        <p className="text-lg text-neutral-400 mb-8">
          Успешно выгнано жильцов: <span className="text-red-500 font-bold">{score}</span>
        </p>
        <button
          onClick={() => {
            playClick(settings.musicVolume);
            navigate("/hub");
          }}
          className="px-8 py-4 bg-red-700 hover:bg-red-600 rounded-xl font-bold text-lg transition-colors"
        >
          ВЕРНУТЬСЯ В ХАБ
        </button>
      </div>
    );
  }

  if (!difficulty && !isPvpLobby) {
    return (
      <div className="flex-1 flex flex-col p-6 text-white relative z-10">
        <header className="flex justify-between items-center mb-8">
          <button
            onClick={() => navigate("/hub")}
            className="p-2 bg-neutral-900 rounded-full"
          >
            <X size={20} />
          </button>
          <div className="flex gap-4 font-bold">
            <div className="flex flex-col items-center justify-center">
              <span className="text-yellow-500 flex items-center gap-1">
                <Zap size={16} /> {energy}
              </span>
              <div className="text-[10px] text-yellow-500/70 font-bold -mt-1">
                {formatTime(timeLeft)}
              </div>
            </div>
            <span className="text-red-500 flex items-center gap-1">
              <Skull size={16} /> {fear}
            </span>
            <span className="text-green-500 flex items-center gap-1">
              🍉 {watermelons}
            </span>
          </div>
        </header>

        <h2
          className="text-3xl font-black text-red-600 uppercase tracking-tighter mb-6"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Выбор сложности
        </h2>

        <div className="space-y-4">
          <button
            onClick={() => startGame("Сложная")}
            className="w-full p-6 bg-neutral-900 border border-neutral-800 rounded-2xl text-left hover:border-red-900 transition-colors group lightning-btn"
          >
            <h3 className="text-xl font-bold text-white group-hover:text-red-500 transition-colors">
              Сложная
            </h3>
            <p className="text-neutral-400 text-sm mt-1">
              15 этапов. Стоимость: 1{" "}
              <Zap size={12} className="inline text-yellow-500" />
            </p>
          </button>
          <button
            onClick={() => startGame("Невозможная")}
            className="w-full p-6 bg-neutral-900 border border-neutral-800 rounded-2xl text-left hover:border-red-900 transition-colors group lightning-btn"
          >
            <h3 className="text-xl font-bold text-white group-hover:text-red-500 transition-colors">
              Невозможная
            </h3>
            <p className="text-neutral-400 text-sm mt-1">
              45 этапов. Стоимость: 5{" "}
              <Zap size={12} className="inline text-yellow-500" />
            </p>
          </button>
          <button
            onClick={() => startGame("Бесконечная")}
            className="w-full p-6 bg-neutral-900 border border-neutral-800 rounded-2xl text-left hover:border-red-900 transition-colors group lightning-btn"
          >
            <h3 className="text-xl font-bold text-white group-hover:text-red-500 transition-colors">
              Бесконечная
            </h3>
            <p className="text-neutral-400 text-sm mt-1">
              Без конца. Стоимость: 25{" "}
              <Zap size={12} className="inline text-yellow-500" />
            </p>
          </button>
          <button
            onClick={() => setIsPvpLobby(true)}
            className="w-full p-6 bg-neutral-900 border border-neutral-800 rounded-2xl text-left hover:border-red-900 transition-colors group lightning-btn"
          >
            <h3 className="text-xl font-bold text-white group-hover:text-red-500 transition-colors">
              PVP Бабаев
            </h3>
            <p className="text-neutral-400 text-sm mt-1">
              Групповое участие с друзьями.
            </p>
          </button>
        </div>
      </div>
    );
  }

  if (isPvpLobby) {
    return (
      <div className="flex-1 flex flex-col p-6 bg-transparent text-white relative z-10">
        <header className="flex justify-between items-center mb-8">
          <button
            onClick={() => setIsPvpLobby(false)}
            className="p-2 bg-neutral-900 rounded-full"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold uppercase tracking-widest">PVP Комната</h1>
          <div className="w-10" />
        </header>

        <div className="flex-1 overflow-y-auto space-y-6">
          <section>
            <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">
              Пригласить друзей
            </h2>
            <div className="space-y-2">
              {friends.map(friend => (
                <div key={friend.name} className="flex items-center justify-between p-3 bg-neutral-900 rounded-xl border border-neutral-800">
                  <span className="font-bold">{friend.name}</span>
                  <button
                    onClick={() => handleInviteFriend(friend.name)}
                    disabled={pvpParticipants.includes(friend.name)}
                    className="px-4 py-2 bg-red-900 hover:bg-red-800 rounded-lg text-sm font-bold disabled:opacity-50"
                  >
                    {pvpParticipants.includes(friend.name) ? "Приглашен" : "Пригласить"}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {pvpParticipants.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">
                Выберите сложность
              </h2>
              <div className="space-y-4">
                <button
                  onClick={() => startPvpGame("Сложная")}
                  className="w-full p-4 bg-neutral-900 border border-neutral-800 rounded-xl text-left hover:border-red-900 transition-colors"
                >
                  <h3 className="text-lg font-bold text-white">Сложная (15 этапов)</h3>
                  <p className="text-neutral-400 text-sm mt-1">Стоимость: 1 <Zap size={12} className="inline text-yellow-500" /></p>
                </button>
                <button
                  onClick={() => startPvpGame("Невозможная")}
                  className="w-full p-4 bg-neutral-900 border border-neutral-800 rounded-xl text-left hover:border-red-900 transition-colors"
                >
                  <h3 className="text-lg font-bold text-white">Невозможная (45 этапов)</h3>
                  <p className="text-neutral-400 text-sm mt-1">Стоимость: 5 <Zap size={12} className="inline text-yellow-500" /></p>
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-transparent text-white relative">
      {showCutscene && <CutscenePlayer onComplete={() => setShowCutscene(false)} />}
      <AnimatePresence>
        {showScreamer && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-red-900"
          >
            <Skull size={250} className="text-black animate-ping" />
          </motion.div>
        )}
        {showSuccessAvatar && character && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <img 
              src={character.avatarUrl} 
              alt="Success" 
              className="w-64 h-64 rounded-full object-cover border-4 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.8)]" 
            />
          </motion.div>
        )}
      </AnimatePresence>

      <audio ref={audioRef} className="hidden" />
      {/* Background Image */}
      {bgImage && (
        <div className="fixed inset-0 z-0 bg-neutral-950">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-50 pointer-events-none transition-opacity duration-1000"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
        </div>
      )}
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
              if (pvpParticipants.length > 0) {
                setExitedEarly(true);
                setIsGameOver(true);
              } else {
                navigate("/hub");
              }
            }}
            className="p-2 bg-neutral-900/80 rounded-full hover:bg-neutral-800 transition-colors"
          >
            <X size={18} />
          </button>
          <div>
            <div className="text-xs text-neutral-400 uppercase tracking-widest font-bold">
              Этап {stage}
            </div>
            <div className="text-sm font-bold text-red-500">{difficulty}</div>
          </div>
        </div>
        <div className="flex gap-3 font-bold text-sm">
          <span className="text-red-500 flex items-center gap-1">
            <Skull size={14} /> {pvpParticipants.length > 0 ? localFear : fear}
          </span>
          <span className="text-green-500 flex items-center gap-1">
            🍉 {pvpParticipants.length > 0 ? localWatermelons : watermelons}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col p-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center text-neutral-500"
            >
              <motion.img 
                animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ repeat: Infinity, duration: 2 }}
                src="https://i.ibb.co/BVgY7XrT/babai.png"
                alt="Loading"
                className="w-48 mb-6 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]"
              />
              <p className="text-sm uppercase tracking-widest text-red-500 animate-pulse font-bold">
                Генерация кошмара...
              </p>
            </motion.div>
          ) : isBossBattle ? (
            <motion.div
              key="boss"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center"
            >
              <div className="text-center mb-6">
                <h3 className="text-2xl font-black text-red-600 uppercase tracking-tighter mb-2">БИТВА С БОССОМ (УР. {bossLevel})</h3>
                <div className="flex gap-4 justify-center">
                  <span className="text-yellow-500">ВРЕМЯ: {bossTimer}с</span>
                  <span className="text-red-500">УДАРЫ: {bossTaps}/{100 * Math.pow(2, bossLevel - 1)}</span>
                </div>
              </div>

              <div 
                onClick={handleBossTap}
                className="relative w-64 h-64 md:w-80 md:h-80 rounded-3xl overflow-hidden border-4 border-red-900 shadow-[0_0_50px_rgba(220,38,38,0.4)] cursor-pointer active:scale-95 transition-transform"
              >
                <img 
                  src={bossImage || "https://picsum.photos/id/718/1080/1920"} 
                  alt="Boss" 
                  className="w-full h-full object-cover"
                />
                {isBossDefeated && (
                  <div className="absolute inset-0 bg-green-500/40 flex items-center justify-center">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-white font-black text-4xl uppercase"
                    >
                      ПОБЕДА!
                    </motion.div>
                  </div>
                )}
              </div>

              {isBossDefeated ? (
                <div className="mt-8 text-center space-y-4">
                  <p className="text-green-400 font-bold">Вы одолели босса и получили {storeConfig.bossRewardBase * Math.pow(storeConfig.bossRewardMultiplier, bossLevel - 1)} кг арбуза!</p>
                  <button
                    onClick={async () => {
                      // Send boss defeat image to Telegram
                      if (bossImage && tgId && !bossImage.includes("picsum.photos")) {
                        saveImageToGallery(bossImage, tgId, `Победа над боссом ур. ${bossLevel}!`, undefined)
                          .catch(console.error);
                      }
                      setIsBossBattle(false);
                      const nextStage = stage + 1;
                      setStage(nextStage);
                      loadNextStage(nextStage);
                    }}
                    className="px-8 py-4 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold flex items-center gap-2"
                  >
                    ИДТИ ДАЛЬШЕ <ArrowRight size={18} />
                  </button>
                </div>
              ) : (
                <p className="mt-6 text-neutral-400 animate-pulse">ТАПАЙ ПО БОССУ!</p>
              )}
            </motion.div>
          ) : isDanilChat ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-800">
                <div className="w-10 h-10 rounded-full bg-red-900 flex items-center justify-center font-bold text-xl">
                  Д
                </div>
                <div>
                  <h3 className="font-bold text-lg">ДанИИл</h3>
                  <p className="text-xs text-green-500">В сети</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl ${msg.sender === "user" ? "bg-red-900 text-white rounded-tr-sm" : "bg-neutral-800 text-neutral-200 rounded-tl-sm"}`}
                    >
                      <p className="text-sm">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {isDanilTyping && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] p-3 rounded-2xl bg-neutral-800 text-neutral-400 rounded-tl-sm flex gap-1">
                      <span className="animate-bounce">.</span>
                      <span className="animate-bounce delay-100">.</span>
                      <span className="animate-bounce delay-200">.</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {chatMessages.length > 0 &&
              chatMessages[chatMessages.length - 1].sender === "danil" &&
              chatMessages.length > 1 ? (
                <button
                  onClick={continueAfterChat}
                  className="w-full py-4 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 mt-4"
                >
                  Продолжить путь <ArrowRight size={18} />
                </button>
              ) : (
                <div className="flex gap-2 mt-4">
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
                    className="p-3 bg-red-700 hover:bg-red-600 rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center"
                  >
                    <MessageSquare size={20} />
                  </button>
                </div>
              )}
            </motion.div>
          ) : isResultView ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <div className={`text-2xl font-black mb-6 uppercase tracking-widest ${lastChoiceCorrect ? 'text-green-500' : 'text-red-500'}`}>
                {lastChoiceCorrect ? 'УСПЕХ' : 'ПРОВАЛ'}
              </div>
              <p className="text-lg md:text-xl leading-relaxed mb-12 italic font-serif">
                {resultText}
              </p>
              <button
                onClick={nextAfterResult}
                className="w-full py-4 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                ПРОДОЛЖИТЬ <ArrowRight size={18} />
              </button>
            </motion.div>
          ) : scenario ? (
            <motion.div
              key="scenario"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="flex-1 flex items-center justify-center py-8">
                <p
                  className="text-lg md:text-xl leading-relaxed font-medium text-center"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
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
    </div>
  );
}
