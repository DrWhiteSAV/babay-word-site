import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore, Gender, Style } from "../store/playerStore";
import { DEFAULT_GALLERY_IMAGES } from "../config/defaultSettings";
import { generateCharacterName, generateAvatar, generateLore } from "../services/ai";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, ArrowRight, Sparkles, RefreshCw, CheckCircle } from "lucide-react";
import { saveImageToGallery } from "../utils/galleryUtils";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";

const STYLES: Style[] = [
  "Фотореализм", "Хоррор", "Стимпанк", "Киберпанк", "Аниме",
  "Постсоветский", "Русская сказка", "2D мультфильм", "Фентези деревня",
];

const WISHES_OPTIONS = [
  "Длинные когти", "Светящиеся глаза", "Рваная пижама", "Огромные зубы",
  "Лысина", "Борода до колен", "Много глаз", "Щупальца вместо рук",
];

export default function CharacterCreate() {
  const navigate = useNavigate();
  const { setCharacter, updateCharacter, addFear, addEnergy } = usePlayerStore();
  const { profile } = useTelegram();

  const [gender, setGender] = useState<Gender | null>(null);
  const [style, setStyle] = useState<Style | null>(null);
  const [wishes, setWishes] = useState<string[]>([]);
  const [selectedDefaultImage, setSelectedDefaultImage] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  // Generated data
  const [generatedName, setGeneratedName] = useState<string>("");
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string>("");
  const [generatedAvatarPrompt, setGeneratedAvatarPrompt] = useState<string>("");

  // Loading states
  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarStep, setAvatarStep] = useState<"idle" | "generating" | "sending_tg" | "done">("idle");

  const tgId = profile?.telegram_id;

  const toggleWish = (wish: string) => {
    if (wishes.includes(wish)) {
      setWishes(wishes.filter((w) => w !== wish));
    } else if (wishes.length < 4) {
      setWishes([...wishes, wish]);
    }
  };

  // Step 2 auto-generate name after gender+style selected
  const handleStyleSelect = async (s: Style) => {
    setStyle(s);
    if (!gender) return;
    setIsGeneratingName(true);
    try {
      const name = await generateCharacterName(gender, s, tgId);
      setGeneratedName(name);
      console.log(`[Create] name generated: ${name}`);
    } catch (e) {
      console.error("[Create] name gen error:", e);
      setGeneratedName("Безымянный");
    } finally {
      setIsGeneratingName(false);
    }
  };

  const handleRegenerateName = async () => {
    if (!gender || !style || isGeneratingName) return;
    setIsGeneratingName(true);
    try {
      const name = await generateCharacterName(gender, style, tgId);
      setGeneratedName(name);
    } catch (e) {
      console.error("[Create] name regen error:", e);
    } finally {
      setIsGeneratingName(false);
    }
  };

  const handleGenerateAvatar = async () => {
    if (!gender || !style || isGeneratingAvatar) return;
    setIsGeneratingAvatar(true);
    setAvatarStep("generating");
    try {
      const name = generatedName || "Бабай";
      console.log(`[Create] generating avatar: name=${name}, gender=${gender}, style=${style}, tgId=${tgId}`);

      setAvatarStep("generating");
      const { url: rawUrl, prompt } = await generateAvatar(gender, style, wishes, { name }, tgId);
      console.log(`[Create] avatar raw url: ${rawUrl}`);

      if (rawUrl && rawUrl.startsWith("http") && !rawUrl.includes("picsum") && !rawUrl.includes("babai.png")) {
        // Send to Telegram first to get a stable URL
        setAvatarStep("sending_tg");
        if (tgId) {
          const savedUrl = await saveImageToGallery(rawUrl, tgId, `Аватар: ${name}`, prompt);
          if (savedUrl && savedUrl.startsWith("http")) {
            setGeneratedAvatarUrl(savedUrl);
            setGeneratedAvatarPrompt(prompt);
            console.log(`[Create] avatar saved via telegram: ${savedUrl}`);
          } else {
            setGeneratedAvatarUrl(rawUrl);
            setGeneratedAvatarPrompt(prompt);
          }
        } else {
          setGeneratedAvatarUrl(rawUrl);
          setGeneratedAvatarPrompt(prompt);
        }
      } else {
        // fallback default
        setGeneratedAvatarUrl("");
        console.warn("[Create] avatar url invalid or fallback, using default");
      }
      setAvatarStep("done");
    } catch (e) {
      console.error("[Create] avatar gen error:", e);
      setAvatarStep("idle");
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const handleFinish = async () => {
    if (!gender || !style) return;
    setIsSaving(true);
    const name = generatedName || "Безымянный";
    const finalUrl = selectedDefaultImage || generatedAvatarUrl || "https://i.ibb.co/BVgY7XrT/babai.png";

    setCharacter({
      name,
      gender,
      style,
      wishes,
      avatarUrl: finalUrl,
      telekinesisLevel: 1,
    });

    // Generate lore in background
    generateLore(name, gender, style, {
      wishes: wishes.join(", "),
      username: profile?.username || "",
      first_name: profile?.first_name || "",
    }, tgId).then(async (lore) => {
      if (lore) {
        updateCharacter({ lore });
        if (tgId) {
          await supabase.from("player_stats").update({ lore }).eq("telegram_id", tgId);
        }
      }
    }).catch(console.error);

    // Handle referral bonus
    if (profile?.referral_code && tgId) {
      try {
        const { data: inviterProfile } = await supabase
          .from("profiles")
          .select("telegram_id")
          .eq("username", profile.referral_code)
          .single();

        if (inviterProfile?.telegram_id) {
          const { data: inviterStats } = await supabase
            .from("player_stats")
            .select("telekinesis_level, fear, energy")
            .eq("telegram_id", inviterProfile.telegram_id)
            .single();

          addFear(100);
          addEnergy(100);

          const inviterTelekinesis = inviterStats?.telekinesis_level || 1;
          const bonus = 100 * Math.max(1, inviterTelekinesis);
          await supabase.from("player_stats").update({
            fear: (inviterStats?.fear || 0) + bonus,
            energy: (inviterStats?.energy || 0) + bonus,
          }).eq("telegram_id", inviterProfile.telegram_id);
        }
      } catch (e) {
        console.error("[Create] referral bonus error:", e);
      }
    }

    setIsSaving(false);
    navigate("/hub");
  };

  const canFinish = !!gender && !!style && !isSaving;
  const currentAvatarPreview = selectedDefaultImage || generatedAvatarUrl;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col p-6 bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container">
        <div className="fog-layer"></div>
        <div className="fog-layer-2"></div>
      </div>

      <div className="mb-8">
        <h2 className="text-3xl font-black text-red-600 uppercase tracking-tighter" style={{ fontFamily: "'Playfair Display', serif" }}>
          Создание Духа
        </h2>
        <p className="text-neutral-500 text-sm mt-1">Шаг {step} из 3</p>
        {/* Progress bar */}
        <div className="flex gap-1 mt-3">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-500 ${s <= step ? "bg-red-600" : "bg-neutral-800"}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {/* STEP 1: Gender */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h3 className="text-xl font-bold text-white">Кто ты?</h3>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => { setGender("Бабай"); setStep(2); }}
                className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all ${gender === "Бабай" ? "border-red-600 bg-red-900/20" : "border-neutral-800 bg-neutral-900 hover:border-neutral-600"}`}>
                <div className="text-4xl">👴</div>
                <span className="font-bold text-lg">Бабай</span>
                <span className="text-xs text-neutral-500 text-center">Мужской дух</span>
              </button>
              <button onClick={() => { setGender("Бабайка"); setStep(2); }}
                className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all ${gender === "Бабайка" ? "border-red-600 bg-red-900/20" : "border-neutral-800 bg-neutral-900 hover:border-neutral-600"}`}>
                <div className="text-4xl">👵</div>
                <span className="font-bold text-lg">Бабайка</span>
                <span className="text-xs text-neutral-500 text-center">Женский дух</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: Style + auto-generate name */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h3 className="text-xl font-bold text-white">Выбери стиль</h3>
            <p className="text-xs text-neutral-400">Стиль влияет на генерацию аватара и общение. После выбора автоматически создаётся имя.</p>
            <div className="grid grid-cols-2 gap-3">
              {STYLES.map((s) => (
                <button key={s} onClick={() => handleStyleSelect(s)}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all relative ${style === s ? "border-red-600 bg-red-900/30 text-white" : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800"}`}>
                  {s}
                  {style === s && isGeneratingName && (
                    <span className="absolute top-1 right-1"><Loader2 size={12} className="animate-spin text-red-400" /></span>
                  )}
                </button>
              ))}
            </div>

            {/* Generated name preview */}
            <AnimatePresence>
              {(generatedName || isGeneratingName) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-neutral-900 border border-neutral-700 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Имя духа</p>
                    {isGeneratingName ? (
                      <div className="flex items-center gap-2 text-neutral-400">
                        <Loader2 size={14} className="animate-spin" />
                        <span className="text-sm">Призываем имя...</span>
                      </div>
                    ) : (
                      <p className="text-xl font-black text-red-400">{generatedName}</p>
                    )}
                  </div>
                  {!isGeneratingName && generatedName && (
                    <button
                      onClick={handleRegenerateName}
                      className="p-2 rounded-xl border border-neutral-700 hover:border-red-600 hover:bg-red-900/20 text-neutral-400 hover:text-red-400 transition-all"
                      title="Перегенерировать имя"
                    >
                      <RefreshCw size={16} />
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              disabled={!style || isGeneratingName}
              onClick={() => setStep(3)}
              className="w-full mt-2 py-4 bg-white text-black rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingName ? <><Loader2 size={16} className="animate-spin" /> Создаём имя...</> : <>Далее <ArrowRight size={18} /></>}
            </button>
          </motion.div>
        )}

        {/* STEP 3: Wishes + Avatar generation */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h3 className="text-xl font-bold text-white">Особые приметы</h3>
            <p className="text-xs text-neutral-400">Выбери до 4 пожеланий для внешности.</p>
            <div className="flex flex-wrap gap-2">
              {WISHES_OPTIONS.map((w) => {
                const isSelected = wishes.includes(w);
                const isDisabled = !isSelected && wishes.length >= 4;
                return (
                  <button key={w} disabled={isDisabled} onClick={() => toggleWish(w)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${isSelected ? "border-red-500 bg-red-900/40 text-red-200" : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700"} ${isDisabled ? "opacity-30 cursor-not-allowed" : ""}`}>
                    {w}
                  </button>
                );
              })}
            </div>

            {/* Avatar section */}
            <div className="pt-2">
              <h3 className="text-lg font-bold text-white mb-3">Аватар</h3>

              {/* Avatar preview */}
              <AnimatePresence mode="wait">
                {currentAvatarPreview ? (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative mb-4"
                  >
                    <img
                      src={currentAvatarPreview}
                      alt="Аватар"
                      className="w-full max-h-64 object-cover rounded-2xl border-2 border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                    />
                    {!selectedDefaultImage && (
                      <div className="absolute top-2 right-2 bg-green-900/80 border border-green-600 rounded-lg px-2 py-1 flex items-center gap-1">
                        <CheckCircle size={12} className="text-green-400" />
                        <span className="text-xs text-green-400">В галерее</span>
                      </div>
                    )}
                  </motion.div>
                ) : isGeneratingAvatar ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full h-48 rounded-2xl border-2 border-neutral-700 flex flex-col items-center justify-center gap-3 bg-neutral-900/50 mb-4"
                  >
                    <Loader2 size={32} className="animate-spin text-red-500" />
                    <p className="text-sm text-neutral-400">
                      {avatarStep === "generating" && "Генерируем облик..."}
                      {avatarStep === "sending_tg" && "Отправляем в Telegram..."}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Generate button */}
              {!selectedDefaultImage && (
                <button
                  onClick={handleGenerateAvatar}
                  disabled={isGeneratingAvatar}
                  className="w-full py-3 border border-red-700 bg-red-900/20 hover:bg-red-900/40 text-red-300 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait mb-4"
                >
                  {isGeneratingAvatar ? (
                    <><Loader2 size={16} className="animate-spin" />
                      {avatarStep === "generating" ? "Генерируем..." : "Отправляем в Telegram..."}
                    </>
                  ) : (
                    <><Sparkles size={16} /> {generatedAvatarUrl ? "Перегенерировать аватар" : "Сгенерировать аватар ИИ"}</>
                  )}
                </button>
              )}

              {/* Or choose default */}
              <p className="text-xs text-neutral-500 mb-3 text-center">— или выбери готовый —</p>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                <div
                  onClick={() => setSelectedDefaultImage(null)}
                  className={`min-w-[80px] h-[80px] rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer snap-center transition-all flex-shrink-0 ${selectedDefaultImage === null && !generatedAvatarUrl ? "border-red-500 bg-red-900/20" : "border-neutral-700 bg-neutral-900 hover:border-neutral-500"}`}
                >
                  <Sparkles size={18} className="text-neutral-400" />
                  <span className="text-xs mt-1 text-neutral-500">ИИ</span>
                </div>
                {DEFAULT_GALLERY_IMAGES.map((img, idx) => (
                  <div key={idx} onClick={() => setSelectedDefaultImage(img)}
                    className={`min-w-[80px] h-[80px] rounded-xl border-2 overflow-hidden cursor-pointer snap-center transition-all flex-shrink-0 ${selectedDefaultImage === img ? "border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)]" : "border-neutral-700 hover:border-neutral-500"}`}>
                    <img src={img} alt={`Default ${idx}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {/* Name display on step 3 */}
            {generatedName && (
              <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3 flex items-center justify-between">
                <span className="text-neutral-400 text-sm">Имя:</span>
                <span className="text-red-400 font-bold">{generatedName}</span>
                <button onClick={handleRegenerateName} disabled={isGeneratingName} className="text-neutral-600 hover:text-neutral-400 transition-colors ml-2">
                  <RefreshCw size={14} className={isGeneratingName ? "animate-spin" : ""} />
                </button>
              </div>
            )}

            <div className="pt-4">
              <button
                disabled={!canFinish || isSaving}
                onClick={handleFinish}
                className="w-full py-4 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(220,38,38,0.4)] disabled:opacity-70 disabled:cursor-wait lightning-btn"
              >
                {isSaving ? (
                  <><Loader2 className="animate-spin" size={20} />Создаём персонажа...</>
                ) : (
                  <><CheckCircle size={20} />НАЧАТЬ ИГРУ</>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
