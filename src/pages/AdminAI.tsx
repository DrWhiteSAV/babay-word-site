import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Bot, Save, Settings2, Key, MessageSquare, Loader2 } from "lucide-react";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";

const DEFAULT_AI_SETTINGS = [
  {
    section_id: "chat",
    name: "Чат с ИИ (ДанИИл)",
    service: "gemini-3-flash-preview",
    prompt: "Ты ДанИИл, друг пользователя. Отвечай коротко, с юмором, иногда используй сленг. Имя бабая: {name}. Пол: {gender}. Стиль: {style}.",
  },
  {
    section_id: "avatar",
    name: "Генерация Аватаров",
    service: "gemini-2.5-flash-image",
    prompt: "A portrait of a Slavic cybernetic spirit named {name} ({gender}). They wear pajamas and have a spooky but funny appearance with a long tongue. Style: {style}. Additional wishes: {wishes}. High quality, detailed, atmospheric.",
  },
  {
    section_id: "avatar_shop",
    name: "Обновление Аватара после Покупки",
    service: "gemini-2.5-flash-image",
    prompt: "Update the appearance of a Slavic cybernetic spirit named {name} ({gender}), style: {style}. Current avatar: {avatar_url}. All previously purchased items worn: {inventory}. NEW item just purchased: {new_item}. Apply the new item visually to the existing character appearance. Wishes/features: {wishes}. High quality portrait, keep the character identity.",
  },
  {
    section_id: "names",
    name: "Генерация Имен",
    service: "gemini-3-flash-preview",
    prompt: "Сгенерируй уникальное, забавное имя для славянского кибернетического духа. Пол: {gender}. Стиль: {style}. Имя должно состоять из одного или двух слов. Верни только имя, без лишних слов.",
  },
  {
    section_id: "background",
    name: "Генерация Фонов (Игра/Хаб)",
    service: "gemini-2.5-flash-image",
    prompt: "Create an atmospheric horror game background in style {style}. Character name: {name}. Gender: {gender}. Fear level: {fear}. Telekinesis level: {telekinesis}. Boss level: {boss_level}. Watermelons: {watermelons}. Location: dark abandoned house, night, fog. No people, no text.",
  },
  {
    section_id: "boss",
    name: "Генерация Боссов",
    service: "gemini-2.5-flash-image",
    prompt: "A massive terrifying boss creature for a Slavic horror game. It is a corrupted spirit guardian for {name} ({gender}) to fight. Style: {style}. Boss level: {boss_level}. Fear power: {fear}. Inventory context: {inventory}. Epic, menacing, high quality.",
  },
  {
    section_id: "lore",
    name: "Генерация Лора персонажа",
    service: "gemini-3-flash-preview",
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

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container"><div className="fog-layer"></div><div className="fog-layer-2"></div></div>
      <Header title={<><Bot size={20} /> Настройки ИИ</>} backUrl="/admin" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-800 text-xs text-neutral-400">
          Настройки ИИ синхронизируются с базой данных при сохранении.
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
              <Settings2 className="text-red-500" size={20} />
              <h3 className="text-sm font-bold text-white">{s.name}</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold flex items-center gap-1"><Bot size={10} /> Модель ИИ</label>
                <select className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:border-red-500 outline-none"
                  value={s.service} onChange={e => update(idx, "service", e.target.value)}>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                  <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                  <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                  <option value="gemini-3.1-flash-image-preview">Gemini 3.1 Image</option>
                  <option value="gemini-2.5-flash-preview-tts">Gemini 2.5 TTS</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold flex items-center gap-1"><MessageSquare size={10} /> Системный Промпт</label>
                <textarea rows={5}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:border-red-500 outline-none resize-y"
                  placeholder="Используй макросы: {name}, {gender}, {style}..."
                  value={s.prompt} onChange={e => update(idx, "prompt", e.target.value)} />
                <p className="text-[9px] text-neutral-600">Макросы заменяются реальными данными пользователя при запросе</p>
              </div>
            </div>
          </div>
        ))}

        <button onClick={handleSave} disabled={saving}
          className={`w-full font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 border mb-6 ${saved ? "bg-green-900/50 border-green-700 text-green-400" : "bg-red-900/80 hover:bg-red-800 text-white border-red-700"}`}>
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saved ? "Сохранено!" : saving ? "Сохранение..." : "Сохранить настройки ИИ"}
        </button>
      </div>
    </motion.div>
  );
}
