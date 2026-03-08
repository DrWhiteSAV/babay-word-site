import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore, Gender, Style } from "../store/playerStore";
import { DEFAULT_GALLERY_IMAGES } from "../config/defaultSettings";
import { generateCharacterName, generateAvatar, generateLore } from "../services/ai";
import { motion } from "motion/react";
import { Loader2, ArrowRight, UserPlus, Sparkles } from "lucide-react";
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
  const { setCharacter, updateCharacter, addFear, addEnergy, globalBackgroundUrl, pageBackgrounds } = usePlayerStore();
  const { profile } = useTelegram();

  const [gender, setGender] = useState<Gender | null>(null);
  const [style, setStyle] = useState<Style | null>(null);
  const [wishes, setWishes] = useState<string[]>([]);
  const [selectedDefaultImage, setSelectedDefaultImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [step, setStep] = useState(1);

  const toggleWish = (wish: string) => {
    if (wishes.includes(wish)) {
      setWishes(wishes.filter((w) => w !== wish));
    } else if (wishes.length < 4) {
      setWishes([...wishes, wish]);
    }
  };

  const handleGenerate = async () => {
    if (!gender || !style) return;
    setIsGenerating(true);
    try {
      setGenerationStep("Призыв имени...");
      const name = await generateCharacterName(gender, style);

      let avatarUrl = selectedDefaultImage;
      let avatarPrompt: string | undefined;

      if (!avatarUrl) {
        setGenerationStep("Генерация облика...");
        const result = await generateAvatar(gender, style, wishes, { name });
        avatarUrl = result.url;
        avatarPrompt = result.prompt;
      }

      const finalUrl = avatarUrl || "https://picsum.photos/id/874/1920/1080";

      setCharacter({
        name,
        gender,
        style,
        wishes,
        avatarUrl: finalUrl,
        telekinesisLevel: 1,
      });

      // Save avatar to gallery via Telegram bot
      if (profile?.telegram_id && !selectedDefaultImage) {
        saveImageToGallery(finalUrl, profile.telegram_id, `Аватар: ${name}`, avatarPrompt).catch(console.error);
      }

      // Generate lore in background
      setGenerationStep("Записываем историю духа...");
      generateLore(name, gender, style, {
        wishes: wishes.join(", "),
        username: profile?.username || "",
        first_name: profile?.first_name || "",
      }).then(async (lore) => {
        if (lore) {
          updateCharacter({ lore });
          // Save lore to player_stats
          if (profile?.telegram_id) {
            await supabase.from("player_stats")
              .update({ lore })
              .eq("telegram_id", profile.telegram_id);
          }
        }
      }).catch(console.error);

      // Handle referral bonus for the new user
      if (profile?.referral_code && profile.telegram_id) {
        const { data: inviterStats } = await supabase
          .from("player_stats")
          .select("telekinesis_level, fear, energy")
          .eq("telegram_id", (
            await supabase.from("profiles")
              .select("telegram_id")
              .eq("username", profile.referral_code)
              .single()
          ).data?.telegram_id ?? -1)
          .single();

        // Give new user bonus (base 100, no multiplier needed for newcomer)
        addFear(100);
        addEnergy(100);

        // Give inviter bonus (multiplied by their telekinesis level)
        const inviterTelekinesis = inviterStats?.telekinesis_level || 1;
        const bonus = 100 * Math.max(1, inviterTelekinesis);
        // Find inviter's telegram_id to update their stats
        const { data: inviterProfile } = await supabase
          .from("profiles")
          .select("telegram_id")
          .eq("username", profile.referral_code)
          .single();

        if (inviterProfile?.telegram_id) {
          await supabase.from("player_stats").update({
            fear: (inviterStats?.fear || 0) + bonus,
            energy: (inviterStats?.energy || 0) + bonus,
          }).eq("telegram_id", inviterProfile.telegram_id);
        }
      }

      navigate("/hub");
    } catch (error) {
      console.error(error);
      setIsGenerating(false);
    }
  };

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

      {isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-transparent backdrop-blur-sm"
        >
          <motion.img
            animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            src="https://i.ibb.co/BVgY7XrT/babai.png"
            alt="Loading"
            className="w-64 mb-8 drop-shadow-[0_0_20px_rgba(220,38,38,0.6)]"
          />
          <p className="text-lg uppercase tracking-widest text-red-500 animate-pulse font-bold">
            Призыв духа...
          </p>
          {generationStep && (
            <p className="text-sm text-neutral-400 mt-2">{generationStep}</p>
          )}
        </motion.div>
      )}

      <div className="mb-8">
        <h2 className="text-3xl font-black text-red-600 uppercase tracking-tighter" style={{ fontFamily: "'Playfair Display', serif" }}>
          Создание Духа
        </h2>
        <p className="text-neutral-500 text-sm mt-1">Шаг {step} из 3</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
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

        {step === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h3 className="text-xl font-bold text-white">Выбери стиль</h3>
            <p className="text-xs text-neutral-400">Стиль выбирается 1 раз и навсегда. Влияет на генерацию и общение.</p>
            <div className="grid grid-cols-2 gap-3">
              {STYLES.map((s) => (
                <button key={s} onClick={() => setStyle(s)}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${style === s ? "border-red-600 bg-red-900/30 text-white" : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800"}`}>
                  {s}
                </button>
              ))}
            </div>
            <button disabled={!style} onClick={() => setStep(3)}
              className="w-full mt-6 py-4 bg-white text-black rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              Далее <ArrowRight size={18} />
            </button>
          </motion.div>
        )}

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

            <div className="pt-6">
              <h3 className="text-xl font-bold text-white mb-4">Начальный Аватар</h3>
              <p className="text-xs text-neutral-400 mb-4">Выберите готовый или оставьте пустым для ИИ-генерации.</p>
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                <div
                  onClick={() => setSelectedDefaultImage(null)}
                  className={`min-w-[100px] h-[100px] rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer snap-center transition-all ${selectedDefaultImage === null ? "border-red-500 bg-red-900/20" : "border-neutral-700 bg-neutral-900 hover:border-neutral-500"}`}
                >
                  <Sparkles size={24} className={selectedDefaultImage === null ? "text-red-400" : "text-neutral-500"} />
                  <span className={`text-xs mt-2 font-bold ${selectedDefaultImage === null ? "text-red-400" : "text-neutral-500"}`}>ИИ Генерация</span>
                </div>
                {DEFAULT_GALLERY_IMAGES.map((img, idx) => (
                  <div key={idx} onClick={() => setSelectedDefaultImage(img)}
                    className={`min-w-[100px] h-[100px] rounded-2xl border-2 overflow-hidden cursor-pointer snap-center transition-all ${selectedDefaultImage === img ? "border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)]" : "border-neutral-700 hover:border-neutral-500"}`}>
                    <img src={img} alt={`Default ${idx}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-8">
              <button disabled={isGenerating} onClick={handleGenerate}
                className="w-full py-4 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(220,38,38,0.4)] disabled:opacity-70 disabled:cursor-wait lightning-btn">
                {isGenerating ? (
                  <><Loader2 className="animate-spin" size={20} />{selectedDefaultImage ? "СОЗДАНИЕ ПЕРСОНАЖА..." : "ПРИЗЫВ ДУХА..."}</>
                ) : (
                  <><Sparkles size={20} />{selectedDefaultImage ? "ВЫБРАТЬ И НАЧАТЬ" : "СГЕНЕРИРОВАТЬ И НАЧАТЬ"}</>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
