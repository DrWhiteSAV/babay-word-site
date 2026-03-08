import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell, Plus, Trash2, Send, Loader2, RefreshCw, ChevronDown, ChevronUp,
  Sparkles, History, CheckCircle2, XCircle, Clock, AlertTriangle
} from "lucide-react";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  trigger_event: string | null;
  is_active: boolean;
  send_telegram: boolean;
  send_popup: boolean;
  created_at: string;
}

interface SendHistoryItem {
  id: string;
  notification_id: string | null;
  telegram_id: number;
  title: string;
  message: string;
  status: string; // sent, failed, blocked
  error_message: string | null;
  sent_at: string;
  profiles?: { first_name: string; username: string | null };
}

interface TriggerOption {
  value: string;
  label: string;
  group: string;
}

const NOTIF_TYPES = [
  { value: 'broadcast', label: '📢 Рассылка всем' },
  { value: 'friend_added', label: '👥 Добавление в друзья' },
  { value: 'event_complete', label: '🎯 Выполнение эвента' },
  { value: 'achievement', label: '🏆 Достижение' },
  { value: 'chat_offline', label: '💬 Сообщение (оффлайн)' },
];

// Available macros for notification messages
const MACROS = [
  { macro: '{name}', desc: 'Имя персонажа (бабая)' },
  { macro: '{first_name}', desc: 'Имя пользователя в Telegram' },
  { macro: '{username}', desc: 'Username в Telegram' },
  { macro: '{fear}', desc: 'Очки страха' },
  { macro: '{watermelons}', desc: 'Кол-во арбузов' },
  { macro: '{energy}', desc: 'Текущая энергия' },
  { macro: '{boss_level}', desc: 'Уровень босса' },
  { macro: '{telekinesis}', desc: 'Уровень телекинеза' },
  { macro: '{event_title}', desc: 'Название эвента' },
  { macro: '{achievement_title}', desc: 'Название достижения' },
  { macro: '{reward}', desc: 'Описание награды' },
  { macro: '{lore}', desc: 'История персонажа' },
];

// Pre-written notification templates
const DEFAULT_MESSAGES: Record<string, { title: string; message: string }> = {
  broadcast: {
    title: '👻 Привет от Бабая!',
    message: 'Привет, {first_name}! Твой бабай {name} скучает и ждёт тебя. Сейчас у тебя {fear} страха и {energy} энергии. Заходи — нас ждут новые приключения! 🎃',
  },
  friend_added: {
    title: '👥 Новый друг-Бабай!',
    message: 'Привет, {first_name}! К тебе добавился новый Бабай-коллега. Вместе выселять жильцов гораздо веселее! Загляни в раздел Друзья 👻',
  },
  event_complete: {
    title: '🎯 Эвент завершён!',
    message: 'Молодец, {first_name}! Твой бабай {name} выполнил эвент «{event_title}». Забери награду {reward} прямо сейчас! ⚡',
  },
  achievement: {
    title: '🏆 Достижение разблокировано!',
    message: 'Поздравляем, {first_name}! Бабай {name} разблокировал достижение «{achievement_title}»! Твой уровень страха теперь {fear}. Так держать! 👑',
  },
  chat_offline: {
    title: '💬 Новое сообщение!',
    message: 'Привет, {first_name}! Пока ты был оффлайн, тебе написали в чат. Твой бабай {name} ждёт — загляни и ответь! 💌',
  },
};

// Расчёт оптимального интервала триггера
// Supabase free tier: 500K row reads/month ≈ 16K/day
// 1 check = ~3 queries (events, player_events, profiles)
// At 5min interval: 288 checks/day = 864 queries/day ✓ safe
// Google AppScript: 6 min minimum trigger interval
// Conclusion: Every 30 min is safe and covers most use cases
const TRIGGER_CALCULATION = `/* 
  📊 Расчёт оптимального интервала триггера:
  
  Supabase free tier лимиты:
  • 500K запросов строк/месяц ≈ 16,666/день
  
  1 проверка = 3 запроса (эвенты, прогресс, профили)
  • Каждые 5 мин: 288 проверок × 3 = 864 запроса/день ✅
  • Каждые 30 мин: 48 проверок × 3 = 144 запроса/день ✅✅ (рекомендуется)
  • Каждые 60 мин: 24 проверок × 3 = 72 запроса/день ✅✅✅
  
  Google AppScript лимиты:
  • Минимальный интервал: 1 минута
  • Максимальное время выполнения: 6 мин/запуск
  
  ✅ Рекомендация: Каждые 30 минут — безопасно для обоих сервисов
*/`;

function buildAppScriptCode(anonKey: string) {
  return `${TRIGGER_CALCULATION}

const SUPABASE_URL = "https://psuvnvqvspqibsezcrny.supabase.co";
const SUPABASE_ANON_KEY = "${anonKey}";

function checkAndSendNotifications() {
  const url = SUPABASE_URL + "/functions/v1/send-notifications";
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + SUPABASE_ANON_KEY },
    payload: JSON.stringify({ type: "daily_reminder", trigger: "appscript" }),
    muteHttpExceptions: true,
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    Logger.log("✅ Результат: " + JSON.stringify(result));
    
    // Логировать в таблицу (опционально)
    SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName("Logs")
      ?.appendRow([new Date(), JSON.stringify(result)]);
  } catch (e) {
    Logger.log("❌ Ошибка: " + e.toString());
  }
}

// Как настроить триггер:
// 1. Откройте редактор: https://script.google.com
// 2. Вставьте этот код
// 3. Нажмите "Триггеры" (⏰) в левом меню
// 4. "+ Добавить триггер" → checkAndSendNotifications
// 5. Тип: По времени → Каждые 30 минут
// 6. Сохраните — готово!
`;
}

const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzdXZudnF2c3BxaWJzZXpjcm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDI5NTIsImV4cCI6MjA4NzU3ODk1Mn0.VHI6Kefzbz6Hc8TpLI5_JRXAyPJ-y4oeE3Bkh16jFRU";

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [showAppScript, setShowAppScript] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SendHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [triggerOptions, setTriggerOptions] = useState<TriggerOption[]>([]);
  const [aiImproving, setAiImproving] = useState(false);
  const [showMacros, setShowMacros] = useState(false);

  const [form, setForm] = useState({
    type: 'broadcast',
    title: DEFAULT_MESSAGES.broadcast.title,
    message: DEFAULT_MESSAGES.broadcast.message,
    trigger_event: '',
    send_telegram: true,
    send_popup: true,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); loadTriggers(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("admin_notifications").select("*").order("created_at", { ascending: false });
    setNotifications(data || []);
    setLoading(false);
  };

  const loadTriggers = async () => {
    const [eventsRes, achievementsRes] = await Promise.all([
      supabase.from("events").select("id, title, event_type").eq("is_active", true),
      supabase.from("achievements").select("key, title").eq("is_active", true),
    ]);

    const options: TriggerOption[] = [];
    (eventsRes.data || []).forEach((e: any) => {
      options.push({ value: e.id, label: `${e.event_type === 'daily' ? '📅' : '🌍'} ${e.title}`, group: e.event_type === 'daily' ? 'Ежедневные эвенты' : 'Глобальные эвенты' });
    });
    (achievementsRes.data || []).forEach((a: any) => {
      options.push({ value: a.key, label: `🏆 ${a.title}`, group: 'Достижения' });
    });
    setTriggerOptions(options);
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    const { data } = await (supabase as any)
      .from("notification_send_history")
      .select("*, profiles(first_name, username)")
      .order("sent_at", { ascending: false })
      .limit(100);
    setHistory(data || []);
    setHistoryLoading(false);
  };

  const handleTypeChange = (type: string) => {
    const def = DEFAULT_MESSAGES[type] || { title: '', message: '' };
    setForm(f => ({ ...f, type, title: def.title, message: def.message, trigger_event: '' }));
  };

  const insertMacro = (macro: string) => {
    setForm(f => ({ ...f, message: f.message + macro }));
  };

  const handleAiImprove = async () => {
    if (!form.message) return;
    setAiImproving(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyCUCb8uYbhPOJSqKw4TtZrCkdLyVlDDbiE";
      const prompt = `Улучши этот текст уведомления для мобильного приложения "Бабай" (игра про славянских кибер-духов в пижамах). Сделай его более живым, атмосферным, с юмором. Сохрани все макросы вида {macro} без изменений. Верни только улучшенный текст, без объяснений.

Тип уведомления: ${NOTIF_TYPES.find(t => t.value === form.type)?.label}
Оригинальный текст:
${form.message}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const data = await res.json();
      const improved = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (improved) setForm(f => ({ ...f, message: improved }));
    } catch (e) {
      console.error('AI improve error:', e);
    } finally {
      setAiImproving(false);
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.message) return;
    setSaving(true);
    await (supabase as any).from("admin_notifications").insert({
      type: form.type,
      title: form.title,
      message: form.message,
      trigger_event: form.trigger_event || null,
      send_telegram: form.send_telegram,
      send_popup: form.send_popup,
      is_active: form.is_active,
    });
    const def = DEFAULT_MESSAGES[form.type] || { title: '', message: '' };
    setForm(f => ({ ...f, title: def.title, message: def.message, trigger_event: '' }));
    setSaving(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from("admin_notifications").delete().eq("id", id);
    load();
  };

  const handleSendBroadcast = async (notif: AdminNotification) => {
    setSending(notif.id);
    try {
      // Load profiles + player_stats for full macro substitution
      const [profilesRes, statsRes] = await Promise.all([
        (supabase as any)
          .from("profiles")
          .select("telegram_id, first_name, username, telegram_blocked")
          .eq("telegram_blocked", false)
          .limit(500),
        (supabase as any)
          .from("player_stats")
          .select("telegram_id, character_name, fear, watermelons, energy, boss_level, telekinesis_level, lore")
          .limit(500),
      ]);

      const users = profilesRes.data || [];
      if (!users.length) return;

      // Build stats map
      const statsMap = new Map<number, Record<string, string>>(
        (statsRes.data || []).map((s: any) => [s.telegram_id, {
          name: s.character_name || '',
          fear: String(s.fear ?? 0),
          watermelons: String(s.watermelons ?? 0),
          energy: String(s.energy ?? 0),
          boss_level: String(s.boss_level ?? 1),
          telekinesis: String(s.telekinesis_level ?? 1),
          lore: s.lore || '',
        }])
      );

      const applyAllMacros = (text: string, user: any) => {
        const ps = statsMap.get(user.telegram_id) || {};
        return text
          .replace(/\{first_name\}/g, user.first_name || '')
          .replace(/\{username\}/g, user.username || '')
          .replace(/\{name\}/g, ps.name || user.first_name || '')
          .replace(/\{fear\}/g, ps.fear || '0')
          .replace(/\{watermelons\}/g, ps.watermelons || '0')
          .replace(/\{energy\}/g, ps.energy || '0')
          .replace(/\{boss_level\}/g, ps.boss_level || '1')
          .replace(/\{telekinesis\}/g, ps.telekinesis || '1')
          .replace(/\{lore\}/g, ps.lore || '');
      };

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      let sent = 0, failed = 0, blocked = 0;

      for (const user of users) {
        const personalizedTitle = applyAllMacros(notif.title, user);
        const personalizedMsg = applyAllMacros(notif.message, user);

        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/send-telegram-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
            body: JSON.stringify({ telegram_id: user.telegram_id, title: personalizedTitle, message: personalizedMsg }),
          });
          const result = await res.json();

          let status = 'sent';
          let errorMsg = null;

          if (!res.ok || result?.error) {
            const errStr = JSON.stringify(result);
            if (errStr.includes('bot was blocked') || errStr.includes('403')) {
              status = 'blocked';
              blocked++;
              // Mark user as blocked
              await (supabase as any).from("profiles").update({ telegram_blocked: true }).eq("telegram_id", user.telegram_id);
            } else {
              status = 'failed';
              failed++;
              errorMsg = result?.error || 'Unknown error';
            }
          } else {
            sent++;
          }

          await (supabase as any).from("notification_send_history").insert({
            notification_id: notif.id,
            telegram_id: user.telegram_id,
            title: personalizedTitle,
            message: personalizedMsg,
            status,
            error_message: errorMsg,
          });
        } catch (e) {
          failed++;
          await (supabase as any).from("notification_send_history").insert({
            notification_id: notif.id,
            telegram_id: user.telegram_id,
            title: personalizedTitle,
            message: personalizedMsg,
            status: 'failed',
            error_message: String(e),
          });
        }

        await new Promise(r => setTimeout(r, 50));
      }

      alert(`✅ Отправлено: ${sent}\n❌ Ошибок: ${failed}\n🚫 Заблокировано: ${blocked}`);
    } finally {
      setSending(null);
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'sent') return <CheckCircle2 size={14} className="text-green-400" />;
    if (status === 'blocked') return <AlertTriangle size={14} className="text-yellow-400" />;
    return <XCircle size={14} className="text-red-400" />;
  };

  const groupedTriggers = triggerOptions.reduce((acc, opt) => {
    if (!acc[opt.group]) acc[opt.group] = [];
    acc[opt.group].push(opt);
    return acc;
  }, {} as Record<string, TriggerOption[]>);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container"><div className="fog-layer"></div><div className="fog-layer-2"></div></div>
      <Header title={<><Bell size={20} className="text-yellow-400" /> Конструктор уведомлений</>} backUrl="/admin" />

      <div className="flex-1 overflow-y-auto p-4 space-y-5 relative z-10 pb-8">

        {/* Create form */}
        <section className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-2xl p-4 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Создать уведомление</h2>

          {/* Type */}
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">Тип</label>
            <select value={form.type} onChange={e => handleTypeChange(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
              {NOTIF_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Trigger — auto dropdown */}
          {form.type !== 'broadcast' && (
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Триггер (авто-список из БД)</label>
              <select value={form.trigger_event} onChange={e => setForm(f => ({ ...f, trigger_event: e.target.value }))}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
                <option value="">— Выберите триггер —</option>
                {Object.entries(groupedTriggers).map(([group, opts]) => (
                  <optgroup key={group} label={group}>
                    {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <p className="text-[10px] text-neutral-500 mt-1">Значение: {form.trigger_event || 'не выбран'}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">Заголовок</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Заголовок уведомления..."
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-900" />
          </div>

          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-neutral-400">Сообщение</label>
              <div className="flex gap-2">
                <button onClick={() => setShowMacros(!showMacros)}
                  className="text-[10px] text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
                  {'{}'} Макросы {showMacros ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </button>
                <button onClick={handleAiImprove} disabled={aiImproving || !form.message}
                  className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50">
                  {aiImproving ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                  Улучшить AI
                </button>
              </div>
            </div>
            <AnimatePresence>
              {showMacros && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-2">
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 grid grid-cols-2 gap-1.5">
                    {MACROS.map(m => (
                      <button key={m.macro} onClick={() => insertMacro(m.macro)}
                        className="text-left px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors group">
                        <span className="text-yellow-400 text-[11px] font-mono">{m.macro}</span>
                        <span className="text-neutral-500 text-[10px] block truncate">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Текст уведомления..."
              rows={4}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-900 resize-none" />
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.send_telegram} onChange={e => setForm(f => ({ ...f, send_telegram: e.target.checked }))} className="accent-red-600 w-4 h-4" />
              <span className="text-sm text-neutral-300">Telegram</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.send_popup} onChange={e => setForm(f => ({ ...f, send_popup: e.target.checked }))} className="accent-red-600 w-4 h-4" />
              <span className="text-sm text-neutral-300">Попап</span>
            </label>
          </div>

          <button onClick={handleSave} disabled={!form.title || !form.message || saving}
            className="w-full py-3 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Сохранить уведомление
          </button>
        </section>

        {/* AppScript section */}
        <section className="bg-neutral-900/80 backdrop-blur-md border border-yellow-900/30 rounded-2xl p-4 space-y-3">
          <button onClick={() => setShowAppScript(!showAppScript)}
            className="w-full flex items-center justify-between text-left">
            <h2 className="text-sm font-bold text-yellow-400 uppercase tracking-wider">📋 Код Google AppScript</h2>
            {showAppScript ? <ChevronUp size={16} className="text-neutral-400" /> : <ChevronDown size={16} className="text-neutral-400" />}
          </button>
          <AnimatePresence>
            {showAppScript && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-3">
                <div className="bg-yellow-950/30 border border-yellow-900/40 rounded-xl p-3">
                  <p className="text-xs text-yellow-300 font-bold mb-1">📊 Расчёт нагрузки</p>
                  <p className="text-[11px] text-neutral-300">Рекомендуемый интервал: <strong className="text-green-400">каждые 30 минут</strong></p>
                  <p className="text-[10px] text-neutral-500 mt-1">144 запроса/день — безопасно для Supabase free tier (лимит 16K/день) и Google AppScript</p>
                </div>
                <pre className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-[10px] text-green-400 overflow-x-auto whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                  {buildAppScriptCode(ANON_KEY)}
                </pre>
                <button
                  onClick={() => { navigator.clipboard.writeText(buildAppScriptCode(ANON_KEY)); setCopiedScript(true); setTimeout(() => setCopiedScript(false), 2000); }}
                  className={`w-full py-2 rounded-xl text-sm font-bold transition-colors ${copiedScript ? 'bg-green-800 text-green-200' : 'bg-neutral-800 hover:bg-neutral-700 text-white'}`}
                >
                  {copiedScript ? '✓ Скопировано' : '📋 Скопировать код'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Notifications list */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Сохранённые</h2>
            <button onClick={load} className="text-neutral-500 hover:text-white"><RefreshCw size={16} /></button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-red-500" /></div>
          ) : notifications.length === 0 ? (
            <p className="text-neutral-500 text-center py-4 text-sm">Нет уведомлений</p>
          ) : (
            <div className="space-y-3">
              {notifications.map(notif => (
                <div key={notif.id} className={`bg-neutral-900 border rounded-2xl p-4 ${notif.is_active ? 'border-neutral-700' : 'border-neutral-800 opacity-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 uppercase tracking-wider font-bold">
                          {NOTIF_TYPES.find(t => t.value === notif.type)?.label || notif.type}
                        </span>
                        {notif.send_telegram && <span className="text-[10px] text-blue-400">TG</span>}
                        {notif.send_popup && <span className="text-[10px] text-purple-400">Попап</span>}
                        {notif.trigger_event && (
                          <span className="text-[10px] text-yellow-500 truncate max-w-[120px]">⚡ {notif.trigger_event.slice(0, 20)}…</span>
                        )}
                      </div>
                      <p className="font-bold text-white text-sm">{notif.title}</p>
                      <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">{notif.message}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {notif.type === 'broadcast' && (
                        <button onClick={() => handleSendBroadcast(notif)} disabled={!!sending}
                          className="p-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-xl transition-colors disabled:opacity-50">
                          {sending === notif.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                      )}
                      <button onClick={() => handleDelete(notif.id)} className="p-2 bg-neutral-800 hover:bg-red-900/30 text-neutral-500 hover:text-red-400 rounded-xl transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Send history */}
        <section className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-2xl p-4 space-y-3">
          <button
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
            className="w-full flex items-center justify-between text-left">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <History size={16} className="text-blue-400" /> История отправки
            </h2>
            {showHistory ? <ChevronUp size={16} className="text-neutral-400" /> : <ChevronDown size={16} className="text-neutral-400" />}
          </button>

          <AnimatePresence>
            {showHistory && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                {historyLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin text-blue-400" /></div>
                ) : history.length === 0 ? (
                  <p className="text-neutral-500 text-center py-3 text-sm">История пуста</p>
                ) : (
                  <div className="space-y-2 mt-2 max-h-80 overflow-y-auto">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {(['sent', 'failed', 'blocked'] as const).map(s => {
                        const count = history.filter(h => h.status === s).length;
                        const colors = { sent: 'text-green-400 bg-green-900/20', failed: 'text-red-400 bg-red-900/20', blocked: 'text-yellow-400 bg-yellow-900/20' };
                        const labels = { sent: 'Отправлено', failed: 'Ошибка', blocked: 'Заблок.' };
                        return (
                          <div key={s} className={`${colors[s]} rounded-xl p-2 text-center`}>
                            <p className="text-lg font-bold">{count}</p>
                            <p className="text-[10px]">{labels[s]}</p>
                          </div>
                        );
                      })}
                    </div>

                    {history.map(h => (
                      <div key={h.id} className="flex items-center gap-3 bg-neutral-950 rounded-xl px-3 py-2">
                        {statusIcon(h.status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">{h.profiles?.first_name || `tg:${h.telegram_id}`}</p>
                          <p className="text-[10px] text-neutral-500 truncate">{h.title}</p>
                          {h.error_message && <p className="text-[10px] text-red-400 truncate">{h.error_message}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-[10px] font-bold ${h.status === 'sent' ? 'text-green-400' : h.status === 'blocked' ? 'text-yellow-400' : 'text-red-400'}`}>
                            {h.status === 'sent' ? '✓' : h.status === 'blocked' ? '🚫' : '✗'}
                          </span>
                          <p className="text-[10px] text-neutral-600">{new Date(h.sent_at).toLocaleTimeString('ru')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

      </div>
    </motion.div>
  );
}
