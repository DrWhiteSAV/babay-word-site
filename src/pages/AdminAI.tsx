import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Bot, Save, Settings2, Key, MessageSquare, Loader2, Image, Type } from "lucide-react";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";

const DEFAULT_AI_SETTINGS = [
  {
    section_id: "chat",
    name: "Чат с ИИ (ДанИИл)",
    service: "protalk-text",
    prompt: "Ты ДанИИл, друг пользователя. Отвечай коротко, с юмором, иногда используй сленг. Имя бабая: {name}. Пол: {gender}. Стиль: {style}.",
  },
  {
    section_id: "avatar",
    name: "Генерация Аватаров",
    service: "protalk-image",
    prompt: "Нарисуй портрет славянского кибернетического духа по имени {name} ({gender}). Наряд: пижама. Внешность: страшная и смешная, длинный язык больше метра. Стиль: {style}. Дополнительно: {wishes}. Высокое качество, детализированный, атмосферный.",
  },
  {
    section_id: "avatar_shop",
    name: "Обновление Аватара после Покупки",
    service: "protalk-image",
    prompt: "Обнови внешность славянского духа по имени {name} ({gender}), стиль: {style}. Текущий аватар: {avatar_url}. Ранее купленные предметы: {inventory}. НОВЫЙ предмет: {new_item}. Нарисуй обновлённый портрет с новым предметом. Особые приметы: {wishes}. Высокое качество.",
  },
  {
    section_id: "names",
    name: "Генерация Имен",
    service: "protalk-text",
    prompt: "Сгенерируй уникальное, забавное имя для славянского кибернетического духа. Пол: {gender}. Стиль: {style}. Имя должно состоять из одного или двух слов. Верни только имя, без лишних слов.",
  },
  {
    section_id: "background",
    name: "Генерация Фонов (Игра/Хаб)",
    service: "protalk-image",
    prompt: "Нарисуй атмосферный фон для игры ужасов в стиле {style}. Персонаж: {name} ({gender}). Уровень страха: {fear}. Телекинез: {telekinesis}. Уровень босса: {boss_level}. Арбузы: {watermelons}. Локация: тёмный заброшенный дом, ночь, туман. Без людей, без текста.",
  },
  {
    section_id: "boss",
    name: "Генерация Боссов",
    service: "protalk-image",
    prompt: "Нарисуй огромного ужасающего босса для славянской игры ужасов. Противник персонажа {name} ({gender}). Стиль: {style}. Уровень босса: {boss_level}. Сила страха: {fear}. Инвентарь: {inventory}. Эпичный, устрашающий, высокое качество.",
  },
  {
    section_id: "lore",
    name: "Генерация Лора персонажа",
    service: "protalk-text",
    prompt: "Напиши захватывающую историю (4-5 предложений) происхождения для Бабая по имени {name}, пол: {gender}, стиль: {style}. Страх: {fear}. Уровень телекинеза: {telekinesis}. Желания: {wishes}. Telegram: @{username}. Сделай историю атмосферной, жуткой и уникальной.",
  },
];

const MACRO_DOCS = [
  { macro: "{name}", desc: "Имя Бабая" },
  { macro: "{gender}", desc: "Пол (Бабай/Бабайка)" },
  { macro: "{style}", desc: "Стиль (Хоррор, Аниме...)" },
  { macro: "{fear}", desc: "Текущий страх" },
  { macro: "{energy}", desc: "Текущая энергия" },
  { macro: "{watermelons}", desc: "Арбузы" },
  { macro: "{telekinesis}", desc: "Уровень телекинеза" },
  { macro: "{boss_level}", desc: "Уровень босса" },
  { macro: "{stage}", desc: "Текущий этап игры" },
  { macro: "{lore}", desc: "История духа" },
  { macro: "{wishes}", desc: "Особые приметы (через запятую)" },
  { macro: "{inventory}", desc: "Все купленные предметы" },
  { macro: "{new_item}", desc: "Только что купленный предмет" },
  { macro: "{avatar_url}", desc: "URL текущей аватарки" },
  { macro: "{username}", desc: "Username в Telegram (@)" },
  { macro: "{first_name}", desc: "Имя в Telegram" },
  { macro: "{telegram_id}", desc: "Telegram ID пользователя" },
  { macro: "{button_size}", desc: "Размер кнопок" },
  { macro: "{font_family}", desc: "Шрифт интерфейса" },
  { macro: "{theme}", desc: "Тема оформления" },
  { macro: "{total_clicks}", desc: "Всего кликов" },
  { macro: "{max_energy}", desc: "Максимальная энергия" },
  { macro: "{referral_count}", desc: "Кол-во приглашённых" },
  { macro: "{profile_url}", desc: "Ссылка профиля Telegram" },
];

type AISetting = { section_id: string; name: string; service: string; prompt: string };

const SERVICE_OPTIONS = [
  { value: "protalk-text", label: "ProTalk — Текст", icon: "T", desc: "Генерация текста (чат, имена, лор, сценарии)" },
  { value: "protalk-image", label: "ProTalk — Картинка", icon: "I", desc: "Генерация изображений (аватары, фоны, боссы)" },
];

export default function AdminAI() {
  const [settings, setSettings] = useState<AISetting[]>(DEFAULT_AI_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    const { error } = await supabase.from("ai_settings").upsert(settings, { onConflict: "section_id" });
    setSaving(false);
    if (error) { alert("Ошибка: " + error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = (idx: number, field: keyof AISetting, value: string) => {
    setSettings(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const isImageService = (service: string) => service === "protalk-image";

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container"><div className="fog-layer"></div><div className="fog-layer-2"></div></div>
      <Header title={<><Bot size={20} /> Настройки ИИ (ProTalk)</>} backUrl="/admin" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ProTalk info banner */}
        <div className="bg-blue-950/40 border border-blue-800/60 rounded-xl p-3 flex items-start gap-3">
          <Bot size={18} className="text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-blue-300">Провайдер: ProTalk</p>
            <p className="text-[11px] text-blue-400/80 mt-0.5">
              Все запросы идут через бот-агрегатор ProTalk. Выбери тип генерации — текст или картинка — и настрой промпт с макросами.
            </p>
          </div>
        </div>

        {/* Macros Reference */}
        <details className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <summary className="px-4 py-3 text-xs font-bold text-neutral-400 cursor-pointer uppercase tracking-wider flex items-center gap-2">
            <Key size={12} /> Доступные макросы для промптов
          </summary>
          <div className="px-4 pb-4 grid grid-cols-2 gap-1.5">
            {MACRO_DOCS.map(({ macro, desc }) => (
              <div key={macro} className="flex items-start gap-2 bg-neutral-950 rounded-lg px-2 py-1.5">
                <code className="text-[10px] text-red-400 font-mono shrink-0">{macro}</code>
                <span className="text-[10px] text-neutral-500">{desc}</span>
              </div>
            ))}
          </div>
        </details>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-red-500" /></div>
        ) : settings.map((s, idx) => (
          <div key={s.section_id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3 border-b border-neutral-800 pb-3">
              {isImageService(s.service)
                ? <Image className="text-purple-400" size={20} />
                : <Type className="text-green-400" size={20} />
              }
              <h3 className="text-sm font-bold text-white">{s.name}</h3>
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold ${isImageService(s.service) ? "bg-purple-900/50 text-purple-300 border border-purple-700" : "bg-green-900/50 text-green-300 border border-green-700"}`}>
                {isImageService(s.service) ? "🖼 Картинка" : "💬 Текст"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Service selector */}
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold flex items-center gap-1">
                  <Bot size={10} /> Тип генерации (ProTalk)
                </label>
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
                      <div className="text-[11px] font-bold">{opt.label}</div>
                      <div className="text-[9px] opacity-70 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt */}
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold flex items-center gap-1">
                  <MessageSquare size={10} /> Промпт
                </label>
                <textarea
                  rows={5}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:border-red-500 outline-none resize-y"
                  placeholder="Используй макросы: {name}, {gender}, {style}..."
                  value={s.prompt}
                  onChange={e => update(idx, "prompt", e.target.value)}
                />
                <p className="text-[9px] text-neutral-600">Макросы заменяются реальными данными пользователя при запросе</p>
              </div>
            </div>
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
          {saved ? "Сохранено!" : saving ? "Сохранение..." : "Сохранить настройки ИИ"}
        </button>
      </div>
    </motion.div>
  );
}
