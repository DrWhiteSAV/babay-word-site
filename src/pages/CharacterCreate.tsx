import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore, Gender, Style } from "../store/playerStore";
import { DEFAULT_GALLERY_IMAGES } from "../config/defaultSettings";
import { generateCharacterName, generateLore } from "../services/ai";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, ArrowRight, Sparkles, RefreshCw, CheckCircle } from "lucide-react";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const STYLES: Style[] = [
  "Фотореализм", "Хоррор", "Стимпанк", "Киберпанк", "Аниме",
  "Постсоветский", "Русская сказка", "2D мультфильм", "Фентези деревня",
];

const WISHES_OPTIONS = [
  "Длинные когти", "Светящиеся глаза", "Рваная пижама", "Огромные зубы",
  "Лысина", "Борода до колен", "Много глаз", "Щупальца вместо рук",
];

const FALLBACK_AVATAR = "https://i.ibb.co/BVgY7XrT/babai.png";

export default function CharacterCreate() {
  const navigate = useNavigate();
  const { setCharacter, updateCharacter, addFear, addEnergy } = usePlayerStore();
  const { profile } = useTelegram();

  const [gender, setGender] = useState<Gender | null>(null);
  const [style, setStyle] = useState<Style | null>(null);
  const [wishes, setWishes] = useState<string[]>([]);
  const [selectedDefaultImage, setSelectedDefaultImage] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const [generatedName, setGeneratedName] = useState<string>("");
  const [generatedLore, setGeneratedLore] = useState<string>("");
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string>("");

  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState<"idle" | "generating" | "sending_tg" | "done">("idle");
  const [isSaving, setIsSaving] = useState(false);

  const tgId = profile?.telegram_id;

  const toggleWish = (wish: string) => {
    if (wishes.includes(wish)) setWishes(wishes.filter((w) => w !== wish));
    else if (wishes.length < 4) setWishes([...wishes, wish]);
  };

  // Step 2: selecting style triggers name + lore generation
  const handleStyleSelect = async (s: Style) => {
    setStyle(s);
    if (!gender) return;
    setIsGeneratingName(true);
    try {
      console.log(`[Create] generating name: gender=${gender}, style=${s}, tgId=${tgId}`);
      const name = await generateCharacterName(gender, s, tgId);
      console.log(`[Create] name generated: "${name}"`);
      setGeneratedName(name);

      // Generate lore in background
      generateLore(name, gender, s, {}, tgId).then((lore) => {
        if (lore) {
          console.log(`[Create] lore generated len=${lore.length}`);
          setGeneratedLore(lore);
        }
      }).catch(console.error);
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

  // Step 3: generate avatar directly via edge function fetch
  const handleGenerateAvatar = async () => {
    if (!gender || !style || isGeneratingAvatar) return;
    setIsGeneratingAvatar(true);
    setAvatarStatus("generating");

    const name = generatedName || "Бабай";
    const wishesStr = wishes.length > 0 ? wishes.join(", ") : "нет особых пожеланий";

    // Build prompt directly
    const prompt = `Нарисуй портрет славянского кибернетического духа по имени ${name} (${gender}). Наряд: пижама. Внешность: страшная и смешная, длинный язык больше метра. Стиль: ${style}. Особые приметы: ${wishesStr}. Высокое качество, детализированный, атмосферный.`;

    console.log(`[Create] avatar fetch start: tgId=${tgId}, prompt="${prompt.substring(0, 80)}..."`);

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/protalk-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ type: "image", prompt, telegramId: tgId }),
      });

      console.log(`[Create] avatar fetch status: ${resp.status}`);

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`protalk-ai ${resp.status}: ${errText}`);
      }

      const data = await resp.json();
      console.log(`[Create] avatar response: success=${data.success}, imageUrl=${data.imageUrl}`);

      const rawUrl: string | null = data.imageUrl || null;

      if (rawUrl && rawUrl.startsWith("http")) {
        // Try to save to gallery via Telegram for stable URL
        if (tgId) {
          setAvatarStatus("sending_tg");
          try {
            const galResp = await fetch(`${SUPABASE_URL}/functions/v1/save-to-gallery`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({ imageUrl: rawUrl, telegramId: tgId, label: `Аватар: ${name}`, prompt }),
            });
            const galData = await galResp.json();
            console.log(`[Create] gallery save: success=${galData.success}, url=${galData.gallery_item?.image_url}`);
            if (galData.success && galData.gallery_item?.image_url) {
              setGeneratedAvatarUrl(galData.gallery_item.image_url);
            } else {
              setGeneratedAvatarUrl(rawUrl);
            }
          } catch (galErr) {
            console.warn("[Create] gallery save failed, using raw url:", galErr);
            setGeneratedAvatarUrl(rawUrl);
          }
        } else {
          setGeneratedAvatarUrl(rawUrl);
        }
        setAvatarStatus("done");
      } else {
        console.warn("[Create] no valid imageUrl from ProTalk, using fallback");
        setGeneratedAvatarUrl("");
        setAvatarStatus("idle");
      }
    } catch (e) {
      console.error("[Create] avatar generation failed:", e);
      setAvatarStatus("idle");
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const handleFinish = async () => {
    if (!gender || !style) return;
    setIsSaving(true);

    const name = generatedName || "Безымянный";
    const finalUrl = selectedDefaultImage || generatedAvatarUrl || FALLBACK_AVATAR;

    setCharacter({ name, gender, style, wishes, avatarUrl: finalUrl, telekinesisLevel: 1 });
    if (generatedLore) updateCharacter({ lore: generatedLore });

    // Persist lore if available
    if (tgId && generatedLore) {
      supabase.from("player_stats").update({ lore: generatedLore }).eq("telegram_id", tgId).then();
    }

    // Referral bonus
    if (profile?.referral_code && tgId) {
      try {
        const { data: inviterProfile } = await supabase
          .from("profiles").select("telegram_id")
          .eq("username", profile.referral_code).single();
        if (inviterProfile?.telegram_id) {
          const { data: inviterStats } = await supabase
            .from("player_stats").select("telekinesis_level, fear, energy")
            .eq("telegram_id", inviterProfile.telegram_id).single();
          addFear(100);
          addEnergy(100);
          const bonus = 100 * Math.max(1, inviterStats?.telekinesis_level || 1);
          await supabase.from("player_stats").update({
            fear: (inviterStats?.fear || 0) + bonus,
            energy: (inviterStats?.energy || 0) + bonus,
          }).eq("telegram_id", inviterProfile.telegram_id);
        }
      } catch (e) {
        console.error("[Create] referral error:", e);
      }
    }

    setIsSaving(false);
    navigate("/hub");
  };

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
              {(["Бабай", "Бабайка"] as Gender[]).map((g) => (
                <button key={g} onClick={() => { setGender(g); setStep(2); }}
                  className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all ${gender === g ? "border-red-600 bg-red-900/20" : "border-neutral-800 bg-neutral-900 hover:border-neutral-600"}`}>
                  <div className="text-4xl">{g === "Бабай" ? "👴" : "👵"}</div>
                  <span className="font-bold text-lg">{g}</span>
                  <span className="text-xs text-neutral-500 text-center">{g === "Бабай" ? "Мужской дух" : "Женский дух"}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* STEP 2: Style → auto-generates name+lore */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h3 className="text-xl font-bold text-white">Выбери стиль</h3>
            <p className="text-xs text-neutral-400">После выбора стиля автоматически создаётся имя и история. Затем перейдёшь к выбору внешности.</p>
            <div className="grid grid-cols-2 gap-3">
              {STYLES.map((s) => (
                <button key={s} onClick={() => handleStyleSelect(s)}
                  disabled={isGeneratingName}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all relative ${style === s ? "border-red-600 bg-red-900/30 text-white" : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800"} disabled:opacity-60`}>
                  {s}
                  {style === s && isGeneratingName && (
                    <span className="absolute top-1 right-1"><Loader2 size={12} className="animate-spin text-red-400" /></span>
                  )}
                </button>
              ))}
            </div>

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
                    <button onClick={handleRegenerateName}
                      className="p-2 rounded-xl border border-neutral-700 hover:border-red-600 hover:bg-red-900/20 text-neutral-400 hover:text-red-400 transition-all">
                      <RefreshCw size={16} />
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              disabled={!style || isGeneratingName}
              onClick={() => setStep(3)}
              className="w-full py-4 bg-white text-black rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingName
                ? <><Loader2 size={16} className="animate-spin" /> Создаём имя...</>
                : <>Далее <ArrowRight size={18} /></>
              }
            </button>
          </motion.div>
        )}

        {/* STEP 3: Wishes + Avatar */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h3 className="text-xl font-bold text-white">Особые приметы</h3>
            <p className="text-xs text-neutral-400">Выбери до 4 пожеланий для внешности, затем сгенерируй аватар.</p>
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

              <AnimatePresence mode="wait">
                {currentAvatarPreview ? (
                  <motion.div key="preview" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative mb-4">
                    <img src={currentAvatarPreview} alt="Аватар"
                      className="w-full max-h-64 object-cover rounded-2xl border-2 border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.4)]" />
                    {!selectedDefaultImage && avatarStatus === "done" && (
                      <div className="absolute top-2 right-2 bg-green-900/80 border border-green-600 rounded-lg px-2 py-1 flex items-center gap-1">
                        <CheckCircle size={12} className="text-green-400" />
                        <span className="text-xs text-green-400">В галерее</span>
                      </div>
                    )}
                  </motion.div>
                ) : isGeneratingAvatar ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="w-full h-48 rounded-2xl border-2 border-neutral-700 flex flex-col items-center justify-center gap-3 bg-neutral-900/50 mb-4">
                    <Loader2 size={32} className="animate-spin text-red-500" />
                    <p className="text-sm text-neutral-400">
                      {avatarStatus === "sending_tg" ? "Отправляем в Telegram..." : "Генерируем облик..."}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {!selectedDefaultImage && (
                <button onClick={handleGenerateAvatar} disabled={isGeneratingAvatar}
                  className="w-full py-3 border border-red-700 bg-red-900/20 hover:bg-red-900/40 text-red-300 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait mb-4">
                  {isGeneratingAvatar
                    ? <><Loader2 size={16} className="animate-spin" /> {avatarStatus === "sending_tg" ? "Отправляем в Telegram..." : "Генерируем..."}</>
                    : <><Sparkles size={16} /> {generatedAvatarUrl ? "Перегенерировать аватар" : "Сгенерировать аватар ИИ"}</>
                  }
                </button>
              )}

              <p className="text-xs text-neutral-500 mb-3 text-center">— или выбери готовый —</p>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                <div onClick={() => setSelectedDefaultImage(null)}
                  className={`min-w-[80px] h-[80px] rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer snap-center transition-all flex-shrink-0 ${selectedDefaultImage === null && !generatedAvatarUrl ? "border-red-500 bg-red-900/20" : "border-neutral-700 bg-neutral-900 hover:border-neutral-500"}`}>
                  <Sparkles size={18} className="text-neutral-400" />
                  <span className="text-xs mt-1 text-neutral-500">ИИ</span>
                </div>
                {DEFAULT_GALLERY_IMAGES.map((img, idx) => (
                  <div key={idx} onClick={() => setSelectedDefaultImage(img)}
                    className={`min-w-[80px] h-[80px] rounded-xl border-2 overflow-hidden cursor-pointer snap-center transition-all flex-shrink-0 ${selectedDefaultImage === img ? "border-red-500 shadow-[0_0_10px_rgba(220,38,38,0.4)]" : "border-neutral-700 hover:border-neutral-500"}`}>
                    <img src={img} alt={`Аватар ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            <button
              disabled={!gender || !style || isSaving}
              onClick={handleFinish}
              className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {isSaving
                ? <><Loader2 size={16} className="animate-spin" /> Сохраняем...</>
                : <>Призвать духа <Sparkles size={18} /></>
              }
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
