import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar, Plus, Trash2, Save, Loader2, Info, ChevronDown, ChevronUp,
  Zap, Skull, RefreshCw, ToggleLeft, ToggleRight
} from "lucide-react";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";

interface GameEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  icon: string | null;
  is_active: boolean;
  start_at: string | null;
  end_at: string | null;
  reward_fear: number | null;
  reward_watermelons: number | null;
  reward_energy: number | null;
  target: number;
  created_at: string;
}

const EVENT_TYPES = [
  { value: "daily", label: "📅 Ежедневный", desc: "Сбрасывается каждый день в полночь. Игрок выполняет за сутки." },
  { value: "weekly", label: "📆 Еженедельный", desc: "Сбрасывается раз в неделю. Более крупная награда." },
  { value: "global", label: "🌍 Глобальный", desc: "Длится указанный период. Все игроки участвуют одновременно." },
  { value: "story", label: "📖 Сюжетный", desc: "Разовый нарративный эвент. Не повторяется." },
];

const CONDITION_TYPES = [
  { value: "fear_total", label: "Накопить страх", unit: "очков страха" },
  { value: "clicks", label: "Кликнуть N раз", unit: "кликов" },
  { value: "boss_defeat", label: "Победить боссов", unit: "боссов" },
  { value: "watermelons", label: "Собрать арбузов", unit: "арбузов" },
  { value: "friends", label: "Добавить друзей", unit: "друзей" },
  { value: "telekinesis", label: "Прокачать телекинез", unit: "уровней" },
  { value: "manual", label: "Ручная активация", unit: "" },
];

const EMOJI_OPTIONS = ["🎃", "⚡", "🔥", "💀", "🌙", "🎯", "🏆", "👻", "🌊", "🕸", "🦇", "🌑", "☠️", "🎭", "🔮"];

const EMPTY_FORM = {
  title: "",
  description: "",
  event_type: "daily",
  icon: "🎃",
  is_active: true,
  start_at: "",
  end_at: "",
  reward_fear: 0,
  reward_watermelons: 0,
  reward_energy: 0,
  target: 1,
  condition_type: "fear_total",
  condition_value: 100,
};

export default function AdminEvents() {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("events").select("*").order("created_at", { ascending: false });
    setEvents(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    const payload: any = {
      title: form.title,
      description: form.description || null,
      event_type: form.event_type,
      icon: form.icon,
      is_active: form.is_active,
      start_at: form.start_at || null,
      end_at: form.end_at || null,
      reward_fear: form.reward_fear || 0,
      reward_watermelons: form.reward_watermelons || 0,
      reward_energy: form.reward_energy || 0,
      target: form.target || 1,
    };

    if (editId) {
      await supabase.from("events").update(payload).eq("id", editId);
    } else {
      await supabase.from("events").insert(payload);
    }

    setSaving(false);
    setForm(EMPTY_FORM);
    setShowForm(false);
    setEditId(null);
    load();
  };

  const handleEdit = (ev: GameEvent) => {
    setForm({
      title: ev.title,
      description: ev.description || "",
      event_type: ev.event_type,
      icon: ev.icon || "🎃",
      is_active: ev.is_active,
      start_at: ev.start_at ? ev.start_at.slice(0, 16) : "",
      end_at: ev.end_at ? ev.end_at.slice(0, 16) : "",
      reward_fear: ev.reward_fear || 0,
      reward_watermelons: ev.reward_watermelons || 0,
      reward_energy: ev.reward_energy || 0,
      target: ev.target || 1,
      condition_type: "manual",
      condition_value: 0,
    });
    setEditId(ev.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить эвент?")) return;
    await supabase.from("events").delete().eq("id", id);
    load();
  };

  const handleToggle = async (ev: GameEvent) => {
    await supabase.from("events").update({ is_active: !ev.is_active }).eq("id", ev.id);
    load();
  };

  const handleSyncTargets = async () => {
    setSyncing(true);
    try {
      for (const ev of events) {
        await supabase
          .from("player_events")
          .update({ target: ev.target || 1 })
          .eq("event_id", ev.id)
          .eq("status", "assigned");
      }
      alert("✅ Targets синхронизированы во всех player_events!");
    } catch (e) {
      console.error("Sync error:", e);
      alert("❌ Ошибка синхронизации");
    }
    setSyncing(false);
  };

  const upd = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  const selectedType = EVENT_TYPES.find(t => t.value === form.event_type);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container"><div className="fog-layer"></div><div className="fog-layer-2"></div></div>
      <Header title={<><Calendar size={20} className="text-orange-400" /> Конструктор Эвентов</>} backUrl="/admin" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">

        {/* Instruction */}
        <details className="bg-orange-950/30 border border-orange-900/40 rounded-xl overflow-hidden">
          <summary className="px-4 py-3 text-xs font-bold text-orange-300 cursor-pointer flex items-center gap-2">
            <Info size={13} /> Как работают эвенты — инструкция
          </summary>
          <div className="px-4 pb-4 space-y-2 text-[11px] text-neutral-300">
            <p>📅 <strong className="text-orange-300">Ежедневные</strong> — сбрасываются в полночь (UTC). Игрок получает 3 новых задания каждый день. Хранятся в таблице <code className="text-yellow-400">player_events</code>.</p>
            <p>🌍 <strong className="text-orange-300">Глобальные</strong> — длятся от <code>start_at</code> до <code>end_at</code>. Все активные пользователи участвуют автоматически.</p>
            <p>📖 <strong className="text-orange-300">Сюжетные</strong> — разовые, назначаются вручную через систему уведомлений.</p>
            <p>💡 <strong className="text-white">Награды</strong> — при завершении эвента начисляются автоматически через хук <code className="text-yellow-400">useAchievements</code>.</p>
            <p>⚙️ Эвент попадает в систему сразу после сохранения. Чтобы временно скрыть — переключи флаг <strong>Активен</strong>.</p>
            <p>🔔 Уведомления об эвентах настраивай в разделе <strong>Уведомления</strong> с триггером <code>event_complete</code>.</p>
          </div>
        </details>

        {/* Add button */}
        <button
          onClick={() => { setForm(EMPTY_FORM); setEditId(null); setShowForm(true); }}
          className="w-full py-3 bg-orange-900/50 hover:bg-orange-800/60 text-orange-300 border border-orange-900/50 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Создать новый эвент
        </button>

        {/* Sync targets button */}
        <button
          onClick={handleSyncTargets}
          disabled={syncing || events.length === 0}
          className="w-full py-3 bg-blue-900/50 hover:bg-blue-800/60 text-blue-300 border border-blue-900/50 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Синхронизировать target → player_events
        </button>

        {/* Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-4 space-y-4">
                <h3 className="text-sm font-bold text-white">{editId ? "Редактировать эвент" : "Новый эвент"}</h3>

                {/* Title + icon */}
                <div className="flex gap-2">
                  <div className="space-y-1 shrink-0">
                    <label className="text-[10px] text-neutral-500 uppercase font-bold">Иконка</label>
                    <div className="flex flex-wrap gap-1 w-[200px]">
                      {EMOJI_OPTIONS.map(e => (
                        <button key={e} onClick={() => upd("icon", e)}
                          className={`text-xl p-1 rounded-lg transition-all ${form.icon === e ? "bg-orange-800 scale-110" : "hover:bg-neutral-800"}`}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-neutral-500 uppercase font-bold">Название *</label>
                    <input value={form.title} onChange={e => upd("title", e.target.value)}
                      placeholder="Название эвента..."
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-500 uppercase font-bold">Описание</label>
                  <textarea value={form.description} onChange={e => upd("description", e.target.value)}
                    rows={3} placeholder="Что нужно сделать игроку..."
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 resize-none" />
                </div>

                {/* Type */}
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-500 uppercase font-bold">Тип эвента</label>
                  <div className="grid grid-cols-2 gap-2">
                    {EVENT_TYPES.map(t => (
                      <button key={t.value} onClick={() => upd("event_type", t.value)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${form.event_type === t.value ? "bg-orange-900/40 border-orange-600" : "bg-neutral-800 border-neutral-700 hover:border-neutral-600"}`}>
                        <p className="text-xs font-bold">{t.label}</p>
                        <p className="text-[9px] text-neutral-400 mt-0.5">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dates (for global/story) */}
                {(form.event_type === "global" || form.event_type === "story") && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500 uppercase font-bold">Начало</label>
                      <input type="datetime-local" value={form.start_at} onChange={e => upd("start_at", e.target.value)}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500 uppercase font-bold">Конец</label>
                      <input type="datetime-local" value={form.end_at} onChange={e => upd("end_at", e.target.value)}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500" />
                    </div>
                  </div>
                )}

                {/* Rewards */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-neutral-500 uppercase font-bold">Награды за выполнение</label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-neutral-800 rounded-xl p-2 space-y-1">
                      <p className="text-[10px] text-red-400 font-bold">💀 Страх</p>
                      <input type="number" min={0} value={form.reward_fear}
                        onChange={e => upd("reward_fear", parseInt(e.target.value) || 0)}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-red-500 text-center" />
                    </div>
                    <div className="bg-neutral-800 rounded-xl p-2 space-y-1">
                      <p className="text-[10px] text-green-400 font-bold">🍉 Арбузы</p>
                      <input type="number" min={0} value={form.reward_watermelons}
                        onChange={e => upd("reward_watermelons", parseInt(e.target.value) || 0)}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-green-500 text-center" />
                    </div>
                    <div className="bg-neutral-800 rounded-xl p-2 space-y-1">
                      <p className="text-[10px] text-yellow-400 font-bold">⚡ Энергия</p>
                      <input type="number" min={0} value={form.reward_energy}
                        onChange={e => upd("reward_energy", parseInt(e.target.value) || 0)}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-yellow-500 text-center" />
                    </div>
                  </div>
                </div>

                {/* Target (goal) */}
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-500 uppercase font-bold">🎯 Цель (target) — сколько нужно выполнить</label>
                  <input type="number" min={1} value={form.target}
                    onChange={e => upd("target", parseInt(e.target.value) || 1)}
                    placeholder="Например: 5, 1000, 1000000"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                  <p className="text-[9px] text-neutral-600">Для ежедневных — цель на игрока. Для глобальных — сумма по всем игрокам.</p>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <div onClick={() => upd("is_active", !form.is_active)}
                    className={`w-10 h-5 rounded-full flex items-center transition-colors ${form.is_active ? "bg-orange-600" : "bg-neutral-700"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-sm text-neutral-300">Эвент активен сразу после сохранения</span>
                </label>

                {/* Buttons */}
                <div className="flex gap-2">
                  <button onClick={() => { setShowForm(false); setEditId(null); }}
                    className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-sm transition-colors">
                    Отмена
                  </button>
                  <button onClick={handleSave} disabled={!form.title || saving}
                    className="flex-1 py-2.5 bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {editId ? "Обновить" : "Создать"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Events list */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Эвенты ({events.length})</h2>
          <button onClick={load} className="text-neutral-500 hover:text-white"><RefreshCw size={16} /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-orange-500" /></div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            <Calendar size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Нет эвентов. Создайте первый!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map(ev => {
              const typeInfo = EVENT_TYPES.find(t => t.value === ev.event_type);
              const isExpanded = expandedId === ev.id;
              return (
                <div key={ev.id} className={`bg-neutral-900 border rounded-2xl overflow-hidden transition-all ${ev.is_active ? "border-neutral-700" : "border-neutral-800 opacity-60"}`}>
                  <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-800/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : ev.id)}>
                    <span className="text-2xl">{ev.icon || "🎃"}</span>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-white text-sm">{ev.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-orange-400">{typeInfo?.label || ev.event_type}</span>
                        {!ev.is_active && <span className="text-[10px] text-neutral-500">Неактивен</span>}
                        <span className="text-[10px] text-blue-400">🎯 {ev.target || 1}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-neutral-500 shrink-0">
                      {(ev.reward_fear || 0) > 0 && <span className="text-red-400">💀{ev.reward_fear}</span>}
                      {(ev.reward_watermelons || 0) > 0 && <span className="text-green-400">🍉{ev.reward_watermelons}</span>}
                      {(ev.reward_energy || 0) > 0 && <span className="text-yellow-400">⚡{ev.reward_energy}</span>}
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-neutral-500 shrink-0" /> : <ChevronDown size={14} className="text-neutral-500 shrink-0" />}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4 border-t border-neutral-800 pt-3 space-y-3">
                          {ev.description && <p className="text-xs text-neutral-400">{ev.description}</p>}
                          {ev.start_at && <p className="text-[11px] text-neutral-500">📅 {new Date(ev.start_at).toLocaleString("ru")} — {ev.end_at ? new Date(ev.end_at).toLocaleString("ru") : "∞"}</p>}
                          <div className="flex gap-2">
                            <button onClick={() => handleToggle(ev)}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${ev.is_active ? "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-red-700 hover:text-red-400" : "bg-green-900/30 border-green-700/50 text-green-400"}`}>
                              {ev.is_active ? <><ToggleRight size={14} /> Деактивировать</> : <><ToggleLeft size={14} /> Активировать</>}
                            </button>
                            <button onClick={() => handleEdit(ev)} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-xs font-bold transition-colors">
                              Редакт.
                            </button>
                            <button onClick={() => handleDelete(ev.id)} className="px-3 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-xl text-xs transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
