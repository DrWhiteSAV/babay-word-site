import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Save, Key, MessageSquare, Loader2, Image, Type, ChevronDown, ChevronUp, Info, Plus } from "lucide-react";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";

const DEFAULT_AI_SETTINGS = [
  {
    section_id: "chat",
    name: "Чат с ИИ (ДанИИл)",
    service: "protalk-text",
    prompt: "Ты ДанИИл, дух-начальник (ИИ), который контролирует Бабаев. Стиль: строгий, саркастичный, требует отчётов о выселении жильцов. Используй технический жаргон. Имя бабая: {name}. Пол: {gender}. Стиль мира: {style}. Лор: {lore}. Ответь коротко (1-2 предложения).",
    instruction: "Используется в чате с ДанИИлом — AI-другом Бабая. Контекст: игра в жанре Horror, персонаж управляет Бабаями. Макросы {name}, {gender}, {style}, {lore} подставляются автоматически.",
  },
  {
    section_id: "avatar",
    name: "Генерация Аватаров",
    service: "protalk-image",
    prompt: "Нарисуй горизонтальный детализированный портрет славянского духа-пугала по имени {name} (пол: {gender}). Внешность: страшная и смешная, длинный язык больше метра, безумный взгляд. Стиль: {style}. Особые приметы: {wishes}. Лор: {lore}. Высокое качество, атмосферный, горизонтальная ориентация. Тёмный фон.",
    instruction: "Вызывается при создании персонажа и ручной генерации аватарки. Промпт ДОЛЖЕН содержать {name}, {gender}, {style}, {wishes}. Ориентация всегда горизонтальная. Не упоминать пижамы.",
  },
  {
    section_id: "avatar_shop",
    name: "Обновление Аватара (Покупка)",
    service: "protalk-image",
    prompt: "Нарисуй обновлённый горизонтальный портрет славянского духа по имени {name} ({gender}), стиль: {style}. Лор: {lore}. Ранее купленные предметы: {inventory}. НОВЫЙ предмет: {new_item} — должен быть заметно виден на персонаже. Особые приметы: {wishes}. ОБЯЗАТЕЛЬНО горизонтальная ориентация (landscape, 16:9). Высокое качество. Тёмный фон.",
    instruction: "Вызывается после покупки предмета в магазине. Используй {new_item} — название только что купленного предмета, {inventory} — весь инвентарь. ОБЯЗАТЕЛЬНА горизонтальная ориентация (landscape). Не упоминать пижамы.",
  },
  {
    section_id: "names",
    name: "Генерация Имён",
    service: "protalk-text",
    prompt: "Придумай одно уникальное, жутковатое и немного абсурдное имя для славянского духа-Бабая. Пол: {gender}. Стиль: {style}. Формат: необычное имя + прилагательное. Например: 'Хрыпач Чердачный', 'Кряхта Ржавая'. Верни ТОЛЬКО имя (2 слова), без пояснений.",
    instruction: "Генерируется при создании персонажа. Верни ТОЛЬКО 2 слова. Макросы: {gender} (Бабай/Бабайка), {style}. Запрещены слова: Бабай, Дух, Леший, Пижама.",
  },
  {
    section_id: "background",
    name: "Генерация Фонов",
    service: "protalk-image",
    prompt: "Нарисуй горизонтальное атмосферное изображение: интерьер жуткого многоквартирного дома ночью. Тёмные коридоры, облупленные стены, мерцающий свет. Стиль: {style}. Уровень страха: {fear}. Уровень босса: {boss_level}. Без людей, без текста. Горизонтальная ориентация. Высокое качество.",
    instruction: "Генерируется как фон для игрового экрана. Всегда горизонтальная ориентация. Нет людей, нет текста. Макросы: {style}, {fear}, {boss_level}, {name}.",
  },
  {
    section_id: "boss",
    name: "Генерация Боссов",
    service: "protalk-image",
    prompt: "Нарисуй горизонтальное изображение огромного ужасающего босса для славянской игры ужасов. Противник: {name} ({gender}). Стиль: {style}. Уровень босса: {boss_level}. Сила страха: {fear}. Инвентарь игрока: {inventory}. Эпичный, детализированный, горизонтальная ориентация. Без текста.",
    instruction: "Генерируется при начале боя с боссом. Горизонтальная ориентация. Важно: уровень босса влияет на устрашающесть. Макросы: {boss_level}, {style}, {fear}, {inventory}.",
  },
  {
    section_id: "lore",
    name: "Генерация Лора персонажа",
    service: "protalk-text",
    prompt: "Напиши захватывающую историю (4-5 предложений) происхождения для Бабая по имени {name}, пол: {gender}, стиль: {style}. Страх: {fear}. Уровень телекинеза: {telekinesis}. Желания: {wishes}. Telegram: @{username}. Сделай историю атмосферной, жуткой и уникальной.",
    instruction: "Генерируется при создании персонажа и обновлении профиля. Результат сохраняется в поле lore и используется в других промптах ({lore}). Вернуть 4-5 предложений, без заголовков.",
  },
  {
    section_id: "scenario",
    name: "Игровые Сценарии",
    service: "protalk-text",
    prompt: "Ты — ведущий текстовой ролевой игры 'Бабай'. Игрок — славянский дух с длинным языком и телекинезом. Стиль: {style}. Этап: {stage}. Сложность: {difficulty}. Опиши ситуацию (2-3 предложения) и предложи 3 варианта действий. Только один правильный. Ответь строго JSON: {\"text\":\"...\",\"options\":[\"...\",\"...\",\"...\"],\"correctAnswer\":0,\"successText\":\"...\",\"failureText\":\"...\"}",
    instruction: "Генерируется для каждого хода игры. ВАЖНО: ответ должен быть валидным JSON с полями text, options (3 штуки), correctAnswer (0/1/2), successText, failureText. Макросы: {style}, {stage}, {difficulty}.",
  },
];

const MACRO_DOCS = [
  { macro: "{name}", desc: "Имя Бабая", cat: "Персонаж" },
  { macro: "{gender}", desc: "Пол (Бабай/Бабайка)", cat: "Персонаж" },
  { macro: "{style}", desc: "Стиль (Хоррор, Аниме...)", cat: "Персонаж" },
  { macro: "{lore}", desc: "История духа", cat: "Персонаж" },
  { macro: "{wishes}", desc: "Особые приметы", cat: "Персонаж" },
  { macro: "{username}", desc: "Username в Telegram (@)", cat: "Персонаж" },
  { macro: "{fear}", desc: "Текущий страх", cat: "Статы" },
  { macro: "{energy}", desc: "Текущая энергия", cat: "Статы" },
  { macro: "{watermelons}", desc: "Арбузы", cat: "Статы" },
  { macro: "{telekinesis}", desc: "Уровень телекинеза", cat: "Статы" },
  { macro: "{boss_level}", desc: "Уровень босса", cat: "Статы" },
  { macro: "{total_clicks}", desc: "Всего кликов", cat: "Статы" },
  { macro: "{max_energy}", desc: "Максимальная энергия", cat: "Статы" },
  { macro: "{inventory}", desc: "Все купленные предметы", cat: "Магазин" },
  { macro: "{new_item}", desc: "Только что купленный предмет", cat: "Магазин" },
  { macro: "{avatar_url}", desc: "URL текущей аватарки", cat: "Медиа" },
  { macro: "{stage}", desc: "Текущий этап игры", cat: "Игра" },
  { macro: "{difficulty}", desc: "Сложность этапа", cat: "Игра" },
  { macro: "{first_name}", desc: "Имя в Telegram", cat: "Telegram" },
  { macro: "{telegram_id}", desc: "Telegram ID пользователя", cat: "Telegram" },
];

const SERVICE_OPTIONS = [
  { value: "protalk-text", label: "ProTalk — Текст", icon: "💬", desc: "Чат, имена, лор, сценарии" },
  { value: "protalk-image", label: "ProTalk — Картинка", icon: "🖼", desc: "Аватары, фоны, боссы" },
];

type AISetting = { section_id: string; name: string; service: string; prompt: string; instruction?: string };

export default function AdminAI() {
  const [settings, setSettings] = useState<AISetting[]>(DEFAULT_AI_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);
  const [showMacrosFor, setShowMacrosFor] = useState<number | null>(null);
  const textAreaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("ai_settings").select("section_id, name, service, prompt");
      if (data && data.length > 0) {
        const merged = DEFAULT_AI_SETTINGS.map(def => {
          const found = data.find(d => d.section_id === def.section_id);
          return found ? { ...def, ...found } : def;
        });
        setSettings(merged);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const toSave = settings.map(({ section_id, name, service, prompt }) => ({ section_id, name, service, prompt }));
    const { error } = await supabase.from("ai_settings").upsert(toSave, { onConflict: "section_id" });
    setSaving(false);
    if (error) { alert("Ошибка: " + error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = (idx: number, field: keyof AISetting, value: string) => {
    setSettings(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const insertMacro = (idx: number, macro: string) => {
    const ta = textAreaRefs.current[idx];
    if (!ta) {
      update(idx, "prompt", settings[idx].prompt + macro);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newVal = settings[idx].prompt.slice(0, start) + macro + settings[idx].prompt.slice(end);
    update(idx, "prompt", newVal);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + macro.length, start + macro.length);
    }, 0);
  };

  const isImageService = (service: string) => service === "protalk-image";

  const macrosByCategory = MACRO_DOCS.reduce((acc, m) => {
    if (!acc[m.cat]) acc[m.cat] = [];
    acc[m.cat].push(m);
    return acc;
  }, {} as Record<string, typeof MACRO_DOCS>);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container"><div className="fog-layer"></div><div className="fog-layer-2"></div></div>
      <Header title={<><Bot size={20} /> Настройки ИИ (ProTalk)</>} backUrl="/admin" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">

        {/* Info banner */}
        <div className="bg-blue-950/40 border border-blue-800/60 rounded-xl p-3 flex items-start gap-3">
          <Bot size={18} className="text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-blue-300">Провайдер: ProTalk</p>
            <p className="text-[11px] text-blue-400/80 mt-0.5">
              Все запросы идут через ProTalk. Промпты загружаются из БД при каждом запросе. Макросы <code className="text-yellow-400">{"{macro}"}</code> заменяются реальными данными пользователя.
            </p>
          </div>
        </div>

        {/* Global macros reference */}
        <details className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <summary className="px-4 py-3 text-xs font-bold text-neutral-400 cursor-pointer uppercase tracking-wider flex items-center gap-2">
            <Key size={12} /> Все доступные макросы (справочник)
          </summary>
          <div className="px-4 pb-4 space-y-3">
            {Object.entries(macrosByCategory).map(([cat, macros]) => (
              <div key={cat}>
                <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-1.5">{cat}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {macros.map(({ macro, desc }) => (
                    <div key={macro} className="flex items-start gap-2 bg-neutral-950 rounded-lg px-2 py-1.5">
                      <code className="text-[10px] text-yellow-400 font-mono shrink-0">{macro}</code>
                      <span className="text-[10px] text-neutral-500">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-red-500" /></div>
        ) : settings.map((s, idx) => (
          <div key={s.section_id} className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
            {/* Header row */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-800/50 transition-colors"
              onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            >
              <span className="text-lg">{isImageService(s.service) ? "🖼" : "💬"}</span>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-white">{s.name}</p>
                <p className="text-[10px] text-neutral-500 truncate mt-0.5">{s.prompt.substring(0, 60)}…</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${isImageService(s.service) ? "bg-purple-900/50 text-purple-300" : "bg-green-900/50 text-green-300"}`}>
                {isImageService(s.service) ? "Картинка" : "Текст"}
              </span>
              {expandedIdx === idx ? <ChevronUp size={14} className="text-neutral-500 shrink-0" /> : <ChevronDown size={14} className="text-neutral-500 shrink-0" />}
            </button>

            <AnimatePresence>
              {expandedIdx === idx && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-4 border-t border-neutral-800 pt-4">

                    {/* Instruction block */}
                    {s.instruction && (
                      <div className="flex items-start gap-2 bg-yellow-950/30 border border-yellow-900/40 rounded-xl px-3 py-2">
                        <Info size={13} className="text-yellow-400 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-yellow-200/80">{s.instruction}</p>
                      </div>
                    )}

                    {/* Service selector */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Тип генерации</label>
                      <div className="grid grid-cols-2 gap-2">
                        {SERVICE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => update(idx, "service", opt.value)}
                            className={`p-2.5 rounded-xl border text-left transition-all ${
                              s.service === opt.value
                                ? opt.value === "protalk-image"
                                  ? "bg-purple-900/40 border-purple-600 text-purple-200"
                                  : "bg-green-900/40 border-green-600 text-green-200"
                                : "bg-neutral-950 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                            }`}
                          >
                            <div className="text-sm">{opt.icon} <span className="text-[11px] font-bold">{opt.label}</span></div>
                            <div className="text-[9px] opacity-70 mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Prompt textarea + macro inserter */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold flex items-center gap-1">
                          <MessageSquare size={10} /> Промпт
                        </label>
                        <button
                          onClick={() => setShowMacrosFor(showMacrosFor === idx ? null : idx)}
                          className="text-[10px] text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                        >
                          <Plus size={10} /> Вставить макрос
                        </button>
                      </div>

                      <AnimatePresence>
                        {showMacrosFor === idx && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 mb-2 space-y-2">
                              {Object.entries(macrosByCategory).map(([cat, macros]) => (
                                <div key={cat}>
                                  <p className="text-[9px] text-neutral-600 uppercase tracking-widest font-bold mb-1">{cat}</p>
                                  <div className="flex flex-wrap gap-1">
                                    {macros.map(({ macro, desc }) => (
                                      <button
                                        key={macro}
                                        onClick={() => { insertMacro(idx, macro); setShowMacrosFor(null); }}
                                        title={desc}
                                        className="text-[10px] font-mono bg-neutral-800 hover:bg-yellow-900/40 text-yellow-400 hover:text-yellow-300 px-2 py-0.5 rounded-md transition-colors"
                                      >
                                        {macro}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <textarea
                        ref={el => { textAreaRefs.current[idx] = el; }}
                        rows={6}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:border-red-500 outline-none resize-y font-mono"
                        placeholder="Промпт с макросами... нажми 'Вставить макрос' для добавления"
                        value={s.prompt}
                        onChange={e => update(idx, "prompt", e.target.value)}
                      />
                      <p className="text-[9px] text-neutral-600">Нажмите «Вставить макрос» чтобы добавить переменную в позицию курсора</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 border mb-6 ${
            saved
              ? "bg-green-900/50 border-green-700 text-green-400"
              : "bg-red-900/80 hover:bg-red-800 text-white border-red-700"
          }`}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saved ? "Сохранено!" : saving ? "Сохранение..." : "Сохранить все промпты"}
        </button>
      </div>
    </motion.div>
  );
}
