import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore, Gender, Style } from "../store/playerStore";
import { DEFAULT_GALLERY_IMAGES } from "../config/defaultSettings";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, ArrowRight, Sparkles, RefreshCw, CheckCircle } from "lucide-react";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";

// Use hardcoded project URL to avoid undefined env vars in Lovable preview
const SUPABASE_URL = "https://psuvnvqvspqibsezcrny.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzdXZudnF2c3BxaWJzZXpjcm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDI5NTIsImV4cCI6MjA4NzU3ODk1Mn0.VHI6Kefzbz6Hc8TpLI5_JRXAyPJ-y4oeE3Bkh16jFRU";

const STYLES: Style[] = [
  "Фотореализм", "Хоррор", "Стимпанк", "Киберпанк", "Аниме",
  "Постсоветский", "Русская сказка", "2D мультфильм", "Фентези деревня",
];

const WISHES_OPTIONS = [
  "Длинные когти", "Светящиеся глаза", "Треснувшие рога", "Огромные зубы",
  "Лысина", "Борода до колен", "Много глаз", "Щупальца вместо рук",
];

const FALLBACK_AVATAR = "https://i.ibb.co/BVgY7XrT/babai.png";

// Direct ProTalk call — bypasses browser checks, always works
async function callProtalk(
  type: "text" | "image",
  prompt: string,
  telegramId?: number,
): Promise<{ text?: string; imageUrl?: string | null }> {
  console.log(`[ProTalk] type=${type}, tgId=${telegramId}, prompt="${prompt.substring(0, 100)}..."`);
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/protalk-ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ type, prompt, telegramId }),
  });
  console.log(`[ProTalk] response status: ${resp.status}`);
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`protalk-ai ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  console.log(`[ProTalk] success=${data.success}, text="${(data.text || "").substring(0, 80)}", imageUrl=${data.imageUrl}`);
  return data;
}

export default function CharacterCreate() {
  const navigate = useNavigate();
  const { setCharacter, addFear, addEnergy } = usePlayerStore();
  const { profile } = useTelegram();

  const [gender, setGender] = useState<Gender | null>(null);
  const [style, setStyle] = useState<Style | null>(null);
  const [wishes, setWishes] = useState<string[]>([]);
  const [selectedDefaultImage, setSelectedDefaultImage] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const [generatedName, setGeneratedName] = useState<string>("");
  const [generatedLore, setGeneratedLore] = useState<string>("");
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string>("");

  // Lock flags — once generated, cannot re-generate
  const [nameLocked, setNameLocked] = useState(false);
  const [loreLocked, setLoreLocked] = useState(false);
  const [avatarLocked, setAvatarLocked] = useState(false);
  const [nameHasDuplicate, setNameHasDuplicate] = useState(false);

  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [isGeneratingLore, setIsGeneratingLore] = useState(false);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState<"idle" | "generating" | "uploading" | "sending_tg" | "done">("idle");
  const [isSaving, setIsSaving] = useState(false);

  // tgId can be 0 (Lovable dev) — we pass it anyway so ProTalk always gets called
  const tgId = profile?.telegram_id;

  const toggleWish = (wish: string) => {
    if (wishes.includes(wish)) setWishes(wishes.filter((w) => w !== wish));
    else if (wishes.length < 4) setWishes([...wishes, wish]);
  };

  // Check if name already exists in DB, return unique name (add number suffix if needed)
  const ensureUniqueName = async (baseName: string): Promise<{ finalName: string; isDuplicate: boolean }> => {
    try {
      const { data } = await supabase
        .from("player_stats")
        .select("character_name")
        .ilike("character_name", `${baseName}%`);
      const existing = (data || []).map(r => r.character_name?.toLowerCase());
      if (!existing.includes(baseName.toLowerCase())) {
        return { finalName: baseName, isDuplicate: false };
      }
      // Find next available number
      let i = 2;
      while (existing.includes(`${baseName.toLowerCase()}${i}`)) i++;
      return { finalName: `${baseName}${i}`, isDuplicate: true };
    } catch {
      return { finalName: baseName, isDuplicate: false };
    }
  };

  // STEP 1: Gender selected → generate name immediately (LOCKED after first generation)
  const handleGenderSelect = async (g: Gender) => {
    if (nameLocked) return; // Already generated, don't redo
    setGender(g);
    setStep(2);
    setIsGeneratingName(true);
    try {
      const genderDesc = g === "Бабай" ? "мужской" : "женский";
      const prompt = `Придумай одно уникальное, жутковатое и немного абсурдное имя для славянского духа. Пол: ${genderDesc}. Формат: необычное имя + прилагательное. Например: "Дзяка Мокрая", "Журон Подвальный", "Хрыпач Чердачный", "Кряхта Ржавая". Для ${genderDesc} рода используй соответствующее окончание прилагательного. Запрещены слова: "Бабай", "Дух", "Леший". Верни ТОЛЬКО имя (2 слова), без пояснений, кавычек, нумерации.`;
      const data = await callProtalk("text", prompt, tgId);
      const raw = data.text || "";
      const cleaned = raw.split("\n")[0]
        .replace(/^[\d]+[.)]\s*/, "")
        .replace(/^[-*•]\s*/, "")
        .replace(/["""«»]/g, "")
        .trim();
      const baseName = cleaned && !/пижам/i.test(cleaned) ? cleaned : (g === "Бабай" ? "Бурьяник Лунный" : "Тьмарица Сырая");
      const { finalName, isDuplicate } = await ensureUniqueName(baseName);
      setGeneratedName(finalName);
      setNameHasDuplicate(isDuplicate);
      setNameLocked(true); // Lock after first generation
    } catch (e) {
      console.error("[Create] name gen error:", e);
      setGeneratedName(g === "Бабай" ? "Бурьяник Лунный" : "Тьмарица Сырая");
      setNameLocked(true);
    } finally {
      setIsGeneratingName(false);
    }
  };

  // Only allow regeneration if name contains a number (was a duplicate)
  const handleRegenerateName = async () => {
    if (!gender || isGeneratingName || !nameHasDuplicate) return;
    setIsGeneratingName(true);
    try {
      const genderDesc = gender === "Бабай" ? "мужской" : "женский";
      const prompt = `Придумай одно уникальное имя для славянского духа. Пол: ${genderDesc}. Формат: необычное имя + прилагательное. Для ${genderDesc} рода используй правильное окончание. Запрещены слова: "Бабай", "Дух", "Леший". Верни ТОЛЬКО имя (2 слова).`;
      const data = await callProtalk("text", prompt, tgId);
      const raw = data.text || "";
      const cleaned = raw.split("\n")[0]
        .replace(/^[\d]+[.)]\s*/, "")
        .replace(/^[-*•]\s*/, "")
        .replace(/["""«»]/g, "")
        .trim();
      if (cleaned) {
        const { finalName, isDuplicate } = await ensureUniqueName(cleaned);
        setGeneratedName(finalName);
        setNameHasDuplicate(isDuplicate);
      }
    } catch (e) {
      console.error("[Create] name regen error:", e);
    } finally {
      setIsGeneratingName(false);
    }
  };

  // STEP 2: Style selected → generate lore (LOCKED after first generation)
  const handleStyleSelect = async (s: Style) => {
    setStyle(s);
    if (!gender || loreLocked) return; // Lock after first style selection
    setIsGeneratingLore(true);
    try {
      const name = generatedName || (gender === "Бабай" ? "Бурьяник" : "Тьмарица");
      const genderDesc = gender === "Бабай" ? "мужской" : "женский";
      const prompt = `Напиши короткую историю происхождения (3-4 предложения) для славянского духа по имени ${name} (пол: ${genderDesc}), визуальный стиль мира: ${s}. Объясни, откуда взялось такое странное имя. Упомяни длинный язык и телекинез. История должна быть атмосферной, жуткой и немного абсурдной. Верни только текст истории без заголовков.`;
      const data = await callProtalk("text", prompt, tgId);
      const lore = (data.text || "").trim();
      setGeneratedLore(lore);
      setLoreLocked(true); // Lock after first generation
    } catch (e) {
      console.error("[Create] lore gen error:", e);
      setGeneratedLore("");
      setLoreLocked(true);
    } finally {
      setIsGeneratingLore(false);
    }
  };

  // STEP 3: Generate avatar (LOCKED after first successful generation)
  const handleGenerateAvatar = async () => {
    if (!gender || !style || isGeneratingAvatar || avatarLocked) return;
    setIsGeneratingAvatar(true);
    setAvatarStatus("generating");
    setGeneratedAvatarUrl("");
    setSelectedDefaultImage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });

    const name = generatedName || "Бабай";
    const wishesStr = wishes.length > 0 ? wishes.join(", ") : "обычная внешность";
    const loreSnippet = generatedLore ? ` Лор персонажа: ${generatedLore.substring(0, 200)}.` : "";
    const genderDesc = gender === "Бабай" ? "мужской" : "женский";
    const prompt = `Нарисуй горизонтальный детализированный портрет славянского духа-пугала по имени ${name} (пол: ${genderDesc}). Внешность: страшная но смешная, длинный язык больше метра, безумный взгляд. Особые приметы: ${wishesStr}. Художественный стиль: ${style}.${loreSnippet} Горизонтальная ориентация. Высокое качество, атмосферный портрет, тёмный фон.`;

    try {
      const data = await callProtalk("image", prompt, tgId);
      const rawUrl = data.imageUrl || null;

      if (!rawUrl || !rawUrl.startsWith("http")) {
        setAvatarStatus("idle");
        return;
      }

      setAvatarStatus("uploading");
      const galResp = await fetch(`${SUPABASE_URL}/functions/v1/save-to-gallery`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          imageUrl: rawUrl,
          telegramId: tgId,
          label: `[avatars] Аватар: ${name}`,
          prompt,
          lore: generatedLore || null,
        }),
      });

      const galData = await galResp.json();
      const finalUrl = galData.storage_url || galData.gallery_item?.image_url || rawUrl;
      setGeneratedAvatarUrl(finalUrl);
      setAvatarStatus("done");
      setAvatarLocked(true); // Lock after successful generation
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

    setCharacter({
      name,
      gender,
      style,
      wishes,
      avatarUrl: finalUrl,
      telekinesisLevel: 1,
      lore: generatedLore || undefined,
    });

    if (tgId) {
      try {
        const storeState = usePlayerStore.getState();
        const { data: existingStats } = await supabase
          .from("player_stats")
          .select("custom_settings")
          .eq("telegram_id", tgId)
          .maybeSingle();

        const existingCustomSettings =
          existingStats?.custom_settings && typeof existingStats.custom_settings === "object"
            ? (existingStats.custom_settings as Record<string, unknown>)
            : {};

        await supabase.from("player_stats").upsert(
          {
            telegram_id: tgId,
            fear: storeState.fear,
            energy: storeState.energy,
            watermelons: storeState.watermelons,
            boss_level: storeState.bossLevel,
            telekinesis_level: 1,
            character_name: name,
            character_gender: gender,
            character_style: style,
            avatar_url: finalUrl,
            lore: generatedLore || null,
            custom_settings: {
              ...existingCustomSettings,
              buttonSize: storeState.settings.buttonSize,
              fontFamily: storeState.settings.fontFamily,
              fontSize: storeState.settings.fontSize,
              fontBrightness: storeState.settings.fontBrightness,
              theme: storeState.settings.theme,
              musicVolume: storeState.settings.musicVolume,
              ttsEnabled: storeState.settings.ttsEnabled,
              wishes,
              inventory: storeState.inventory,
            },
          },
          { onConflict: "telegram_id" }
        );
      } catch (e) {
        console.error("[Create] initial save error:", e);
      }
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

        {/* STEP 1: Gender → triggers name generation */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h3 className="text-xl font-bold text-white">Кто ты?</h3>
            <p className="text-xs text-neutral-400">Выбери пол — и сразу будет придумано имя твоего духа</p>
            <div className="grid grid-cols-2 gap-4">
              {(["Бабай", "Бабайка"] as Gender[]).map((g) => (
                <button
                  key={g}
                  onClick={() => handleGenderSelect(g)}
                  disabled={isGeneratingName}
                  className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all ${gender === g ? "border-red-600 bg-red-900/20" : "border-neutral-800 bg-neutral-900 hover:border-neutral-600"} disabled:opacity-60`}
                >
                  <div className="text-4xl">{g === "Бабай" ? "👴" : "👵"}</div>
                  <span className="font-bold text-lg">{g}</span>
                  <span className="text-xs text-neutral-500 text-center">{g === "Бабай" ? "Мужской дух" : "Женский дух"}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* STEP 2: Show generated name + Style selector → triggers lore */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

            {/* Name card */}
            <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-4">
              <p className="text-xs text-neutral-500 mb-1">Имя духа</p>
              {isGeneratingName ? (
                <div className="flex items-center gap-2 text-neutral-400">
                  <Loader2 size={16} className="animate-spin text-red-400" />
                  <span className="text-sm">Призываем имя из тьмы...</span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-black text-red-400">{generatedName}</p>
                    {nameHasDuplicate && <p className="text-xs text-yellow-500 mt-1">Имя уже занято — добавлен номер</p>}
                  </div>
                  {/* Only show regenerate if name has a duplicate number */}
                  {nameHasDuplicate && (
                    <button
                      onClick={handleRegenerateName}
                      disabled={isGeneratingName}
                      className="p-2 rounded-xl border border-neutral-700 hover:border-red-600 hover:bg-red-900/20 text-neutral-400 hover:text-red-400 transition-all disabled:opacity-40"
                      title="Перегенерировать имя (занято)"
                    >
                      <RefreshCw size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>

            <h3 className="text-xl font-bold text-white">Выбери стиль</h3>
            <p className="text-xs text-neutral-400">После выбора стиля появится история твоего духа</p>
            <div className="grid grid-cols-2 gap-3">
              {STYLES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStyleSelect(s)}
                  disabled={isGeneratingName || isGeneratingLore}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all relative ${style === s ? "border-red-600 bg-red-900/30 text-white" : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800"} disabled:opacity-60`}
                >
                  {s}
                  {style === s && isGeneratingLore && (
                    <span className="absolute top-1 right-1"><Loader2 size={12} className="animate-spin text-red-400" /></span>
                  )}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {(generatedLore || isGeneratingLore) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-neutral-900/80 border border-red-900/40 rounded-2xl p-4"
                >
                  <p className="text-xs text-red-400/70 mb-2 uppercase tracking-wider">История духа</p>
                  {isGeneratingLore ? (
                    <div className="flex items-center gap-2 text-neutral-400">
                      <Loader2 size={14} className="animate-spin text-red-400" />
                      <span className="text-sm">Пишем легенду...</span>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-300 leading-relaxed">{generatedLore}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              disabled={!style || isGeneratingName || isGeneratingLore}
              onClick={() => setStep(3)}
              className="w-full py-4 bg-white text-black rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingLore
                ? <><Loader2 size={16} className="animate-spin" /> Создаём историю...</>
                : <>Далее <ArrowRight size={18} /></>
              }
            </button>
          </motion.div>
        )}

        {/* STEP 3: Wishes + Avatar generation */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-900/30 flex items-center justify-center text-lg">
                  {gender === "Бабай" ? "👴" : "👵"}
                </div>
                <div>
                  <p className="font-bold text-red-400">{generatedName}</p>
                  <p className="text-xs text-neutral-500">{style} · {gender}</p>
                </div>
              </div>
            </div>

            <h3 className="text-xl font-bold text-white">Особые приметы</h3>
            <p className="text-xs text-neutral-400">Выбери до 4 — они войдут в аватар</p>
            <div className="flex flex-wrap gap-2">
              {WISHES_OPTIONS.map((w) => {
                const isSelected = wishes.includes(w);
                const isDisabled = !isSelected && wishes.length >= 4;
                return (
                  <button
                    key={w}
                    disabled={isDisabled}
                    onClick={() => toggleWish(w)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${isSelected ? "border-red-500 bg-red-900/40 text-red-200" : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700"} ${isDisabled ? "opacity-30 cursor-not-allowed" : ""}`}
                  >
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
                    <img
                      src={currentAvatarPreview}
                      alt="Аватар"
                      className="w-full max-h-72 object-cover rounded-2xl border-2 border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                    />
                    {!selectedDefaultImage && avatarStatus === "done" && (
                      <div className="absolute top-2 right-2 bg-green-900/80 border border-green-600 rounded-lg px-2 py-1 flex items-center gap-1">
                        <CheckCircle size={12} className="text-green-400" />
                        <span className="text-xs text-green-400">В Telegram и галерее</span>
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
                      {avatarStatus === "uploading" ? "Сохраняем в хранилище..." :
                       avatarStatus === "sending_tg" ? "Отправляем в Telegram..." :
                       "Генерируем облик через ProTalk..."}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {!selectedDefaultImage && !avatarLocked && (
                <button
                  onClick={handleGenerateAvatar}
                  disabled={isGeneratingAvatar}
                  className="w-full py-3 border border-red-700 bg-red-900/20 hover:bg-red-900/40 text-red-300 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait mb-4"
                >
                  {isGeneratingAvatar
                    ? <><Loader2 size={16} className="animate-spin" /> {avatarStatus === "uploading" ? "Сохраняем..." : "Генерируем..."}</>
                    : <><Sparkles size={16} /> Сгенерировать аватар ИИ</>
                  }
                </button>
              )}
              {avatarLocked && generatedAvatarUrl && (
                <div className="w-full py-2 text-center text-xs text-green-500 mb-4">
                  ✓ Аватар создан и сохранён. Повторная генерация недоступна.
                </div>
              )}

              <p className="text-xs text-neutral-500 mb-3 text-center">— или выбери готовый —</p>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                <div
                  onClick={() => setSelectedDefaultImage(null)}
                  className={`snap-start flex-shrink-0 w-20 h-20 rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${!selectedDefaultImage && !generatedAvatarUrl ? "border-red-600" : "border-neutral-700 hover:border-neutral-500"}`}
                >
                  <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-2xl">🤖</div>
                </div>
                {DEFAULT_GALLERY_IMAGES.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedDefaultImage(img)}
                    className={`snap-start flex-shrink-0 w-20 h-20 rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${selectedDefaultImage === img ? "border-red-600" : "border-neutral-700 hover:border-neutral-500"}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {generatedLore && (
              <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3">
                <p className="text-xs text-red-400/60 mb-1 uppercase tracking-wider">История</p>
                <p className="text-xs text-neutral-400 leading-relaxed line-clamp-3">{generatedLore}</p>
              </div>
            )}

            <button
              onClick={handleFinish}
              disabled={isSaving || (!generatedAvatarUrl && !selectedDefaultImage)}
              className="w-full py-4 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSaving
                ? <><Loader2 size={16} className="animate-spin" /> Сохраняем духа...</>
                : <>Войти в мир Бабаев <ArrowRight size={18} /></>
              }
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
