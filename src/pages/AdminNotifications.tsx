import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Bell, Plus, Trash2, Send, Loader2, CheckCircle, RefreshCw } from "lucide-react";
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

const NOTIF_TYPES = [
  { value: 'broadcast', label: '📢 Рассылка всем' },
  { value: 'friend_added', label: '👥 Добавление в друзья' },
  { value: 'event_complete', label: '🎯 Выполнение эвента' },
  { value: 'achievement', label: '🏆 Достижение' },
  { value: 'chat_offline', label: '💬 Сообщение (оффлайн)' },
];

// AppScript trigger code for copy-paste
const APPSCRIPT_CODE = `// =====================================================
// Google AppScript trigger code for Babai events
// Run this as a time-based trigger (every hour or daily)
// =====================================================
const SUPABASE_URL = "https://psuvnvqvspqibsezcrny.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

function checkAndSendEventNotifications() {
  const url = SUPABASE_URL + "/functions/v1/send-notifications";
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + SUPABASE_ANON_KEY },
    payload: JSON.stringify({ type: "daily_reminder", trigger: "appscript" }),
  };
  const response = UrlFetchApp.fetch(url, options);
  Logger.log(response.getContentText());
}

// Add a trigger: Edit > Triggers > Add trigger
// Function: checkAndSendEventNotifications
// Event: Time-driven > Day timer > 9:00 AM
`;

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [showAppScript, setShowAppScript] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Form state
  const [form, setForm] = useState({
    type: 'broadcast',
    title: '',
    message: '',
    trigger_event: '',
    send_telegram: true,
    send_popup: true,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("admin_notifications").select("*").order("created_at", { ascending: false });
    setNotifications(data || []);
    setLoading(false);
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
    setForm({ type: 'broadcast', title: '', message: '', trigger_event: '', send_telegram: true, send_popup: true, is_active: true });
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
      const { data: users } = await supabase.from("profiles").select("telegram_id");
      if (!users) return;

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const results = await Promise.allSettled(
        users.slice(0, 50).map(u =>
          fetch(`${SUPABASE_URL}/functions/v1/send-telegram-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
            body: JSON.stringify({
              telegram_id: u.telegram_id,
              title: notif.title,
              message: notif.message,
            }),
          })
        )
      );
      const success = results.filter(r => r.status === 'fulfilled').length;
      alert(`Отправлено ${success}/${users.length} пользователям`);
    } finally {
      setSending(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container"><div className="fog-layer"></div><div className="fog-layer-2"></div></div>
      <Header title={<><Bell size={20} className="text-yellow-400" /> Конструктор уведомлений</>} backUrl="/admin" />

      <div className="flex-1 overflow-y-auto p-4 space-y-6 relative z-10">

        {/* Create form */}
        <section className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-2xl p-4 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Создать уведомление</h2>

          <div>
            <label className="text-xs text-neutral-400 mb-1 block">Тип</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
              {NOTIF_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-neutral-400 mb-1 block">Заголовок</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Заголовок уведомления..."
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-900" />
          </div>

          <div>
            <label className="text-xs text-neutral-400 mb-1 block">Сообщение</label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Текст уведомления... Можно использовать {name}, {fear}, {energy}"
              rows={3}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-900 resize-none" />
          </div>

          {form.type !== 'broadcast' && (
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Триггер (event_id или achievement_key)</label>
              <input value={form.trigger_event} onChange={e => setForm(f => ({ ...f, trigger_event: e.target.value }))}
                placeholder="event_id или ключ достижения..."
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-900" />
            </div>
          )}

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
            Создать
          </button>
        </section>

        {/* AppScript section */}
        <section className="bg-neutral-900/80 backdrop-blur-md border border-yellow-900/30 rounded-2xl p-4 space-y-3">
          <button onClick={() => setShowAppScript(!showAppScript)}
            className="w-full flex items-center justify-between text-left">
            <h2 className="text-sm font-bold text-yellow-400 uppercase tracking-wider">📋 Код Google AppScript</h2>
            <RefreshCw size={16} className="text-neutral-400" />
          </button>
          {showAppScript && (
            <>
              <p className="text-xs text-neutral-400">Вставьте этот код в Google AppScript и настройте триггер для автоматической рассылки ивентов.</p>
              <pre className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-[10px] text-green-400 overflow-x-auto whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                {APPSCRIPT_CODE}
              </pre>
              <button
                onClick={() => { navigator.clipboard.writeText(APPSCRIPT_CODE); setCopiedScript(true); setTimeout(() => setCopiedScript(false), 2000); }}
                className={`w-full py-2 rounded-xl text-sm font-bold transition-colors ${copiedScript ? 'bg-green-800 text-green-200' : 'bg-neutral-800 hover:bg-neutral-700 text-white'}`}
              >
                {copiedScript ? '✓ Скопировано' : '📋 Скопировать код'}
              </button>
            </>
          )}
        </section>

        {/* Notifications list */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Сохранённые уведомления</h2>
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
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 uppercase tracking-wider font-bold">
                          {NOTIF_TYPES.find(t => t.value === notif.type)?.label || notif.type}
                        </span>
                        {notif.send_telegram && <span className="text-[10px] text-blue-400">TG</span>}
                        {notif.send_popup && <span className="text-[10px] text-purple-400">Попап</span>}
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
      </div>
    </motion.div>
  );
}
