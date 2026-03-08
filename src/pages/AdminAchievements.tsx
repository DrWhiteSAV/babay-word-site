import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy, Plus, Trash2, Save, Loader2, Info, ChevronDown, ChevronUp, RefreshCw,
  ToggleLeft, ToggleRight
} from "lucide-react";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";

interface Achievement {
  id: string;
  key: string;
  title: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  condition_type: string;
  condition_value: number | null;
  reward_fear: number | null;
  reward_watermelons: number | null;
  created_at: string;
}

const CONDITION_TYPES = [
  { value: "fear", label: "Очки Страха", unit: "очков страха", desc: "Игрок набирает указанное кол-во страха" },
  { value: "watermelons", label: "Арбузы", unit: "арбузов", desc: "Игрок собирает указанное кол-во арбузов" },
  { value: "telekinesis", label: "Уровень Телекинеза", unit: "уровень", desc: "Игрок прокачивает телекинез до нужного уровня" },
  { value: "boss_level", label: "Уровень Босса", unit: "уровень", desc: "Игрок побеждает боссов до указанного уровня" },
  { value: "friends", label: "Количество Друзей", unit: "друзей", desc: "Игрок добавляет указанное кол-во друзей" },
  { value: "total_clicks", label: "Всего Кликов", unit: "кликов", desc: "Суммарное количество кликов по боссу" },
  { value: "manual", label: "Ручная активация", unit: "", desc: "Выдаётся только вручную администратором" },
];

const EMOJI_OPTIONS = ["🏆", "👑", "💀", "⚡", "🔥", "🌙", "🎯", "👻", "🦇", "💎", "🥇", "🌊", "🕸", "⭐", "🎭", "🔮", "🧠", "💪"];

const EMPTY_FORM = {
  key: "",
  title: "",
  description: "",
  icon: "🏆",
  is_active: true,
  condition_type: "fear",
  condition_value: 100,
  reward_fear: 0,
  reward_watermelons: 0,
};

function calcProgress(condType: string, condValue: number): string {
  const cond = CONDITION_TYPES.find(c => c.value === condType);
  if (!cond) return "";
  if (condType === "manual") return "Ручная активация";
  return `Нужно: ${condValue} ${cond.unit}`;
}

export default function AdminAchievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => { load(); loadStats(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("achievements").select("*").order("created_at", { ascending: false });
    setAchievements(data || []);
    setLoading(false);
  };

  const loadStats = async () => {
    // Count how many players unlocked each achievement
    const { data } = await supabase.from("player_achievements").select("achievement_id");
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach(r => { counts[r.achievement_id] = (counts[r.achievement_id] || 0) + 1; });
      setStats(counts);
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.key) return;
    setSaving(true);

    const payload = {
      key: form.key.toLowerCase().replace(/\s+/g, "_"),
      title: form.title,
      description: form.description || null,
      icon: form.icon,
      is_active: form.is_active,
      condition_type: form.condition_type,
      condition_value: form.condition_value || null,
      reward_fear: form.reward_fear || 0,
      reward_watermelons: form.reward_watermelons || 0,
    };

    if (editId) {
      const { error } = await supabase.from("achievements").update(payload).eq("id", editId);
      if (error) alert("Ошибка: " + error.message);
    } else {
      const { error } = await supabase.from("achievements").insert(payload);
      if (error) alert("Ошибка: " + error.message);
    }

    setSaving(false);
    setForm(EMPTY_FORM);
    setShowForm(false);
    setEditId(null);
    load();
    loadStats();
  };

  const handleEdit = (ach: Achievement) => {
    setForm({
      key: ach.key,
      title: ach.title,
      description: ach.description || "",
      icon: ach.icon || "🏆",
      is_active: ach.is_active,
      condition_type: ach.condition_type,
      condition_value: ach.condition_value || 0,
      reward_fear: ach.reward_fear || 0,
      reward_watermelons: ach.reward_watermelons || 0,
    });
    setEditId(ach.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить достижение? Разблокировки у игроков сохранятся.")) return;
    await supabase.from("achievements").delete().eq("id", id);
    load();
  };

  const handleToggle = async (ach: Achievement) => {
    await supabase.from("achievements").update({ is_active: !ach.is_active }).eq("id", ach.id);
    load();
  };

  const upd = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));
  const selectedCond = CONDITION_TYPES.find(c => c.value === form.condition_type);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container"><div className="fog-layer"></div><div className="fog-layer-2"></div></div>
      <Header title={<><Trophy size={20} className="text-yellow-400" /> Конструктор Достижений</>} backUrl="/admin" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">

        {/* Instruction */}
        <details className="bg-yellow-950/30 border border-yellow-900/40 rounded-xl overflow-hidden">
          <summary className="px-4 py-3 text-xs font-bold text-yellow-300 cursor-pointer flex items-center gap-2">
            <Info size={13} /> Как работают достижения — инструкция
          </summary>
          <div className="px-4 pb-4 space-y-2 text-[11px] text-neutral-300">
            <p>🔑 <strong className="text-yellow-300">Ключ (key)</strong> — уникальный идентификатор достижения. Используется в коде и уведомлениях. Только латиница и подчёркивания.</p>
            <p>⚙️ <strong className="text-yellow-300">Условие</strong> — тип и значение. Например: <code className="text-yellow-400">fear = 1000</code> → достижение выдаётся когда игрок накопит 1000 страха.</p>
            <p>🔄 <strong className="text-yellow-300">Автопроверка</strong> — хук <code className="text-yellow-400">useAchievements</code> проверяет условия при каждом изменении статистики игрока.</p>
            <p>💰 <strong className="text-yellow-300">Награды</strong> — начисляются один раз при первом выполнении условия.</p>
            <p>📊 <strong className="text-yellow-300">Статистика</strong> — колонка "Выдано" показывает сколько игроков уже разблокировали это достижение.</p>
            <p>🏷 <strong className="text-yellow-300">Вкл/Выкл</strong> — если достижение выключено, оно не проверяется и не выдаётся игрокам.</p>
          </div>
        </details>

        {/* Progress summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">{achievements.length}</p>
            <p className="text-[10px] text-neutral-500">Всего</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{achievements.filter(a => a.is_active).length}</p>
            <p className="text-[10px] text-neutral-500">Активных</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{Object.values(stats).reduce((a, b) => a + b, 0)}</p>
            <p className="text-[10px] text-neutral-500">Разблокировок</p>
          </div>
        </div>

        {/* Add button */}
        <button
          onClick={() => { setForm(EMPTY_FORM); setEditId(null); setShowForm(true); }}
          className="w-full py-3 bg-yellow-900/40 hover:bg-yellow-800/50 text-yellow-300 border border-yellow-900/50 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Создать новое достижение
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
                <h3 className="text-sm font-bold text-white">{editId ? "Редактировать достижение" : "Новое достижение"}</h3>

                {/* Icon selection */}
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-500 uppercase font-bold">Иконка</label>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJI_OPTIONS.map(e => (
                      <button key={e} onClick={() => upd("icon", e)}
                        className={`text-xl p-1.5 rounded-lg transition-all ${form.icon === e ? "bg-yellow-800 scale-110" : "hover:bg-neutral-800"}`}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-500 uppercase font-bold">Название *</label>
                  <input value={form.title} onChange={e => upd("title", e.target.value)}
                    placeholder="Первая кровь..."
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500" />
                </div>

                {/* Key */}
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-500 uppercase font-bold">Ключ (key) *</label>
                  <input value={form.key}
                    onChange={e => upd("key", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                    placeholder="first_blood"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-yellow-500" />
                  <p className="text-[9px] text-neutral-600">Только латиница и подчёркивания. Уникальный идентификатор.</p>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-500 uppercase font-bold">Описание</label>
                  <textarea value={form.description} onChange={e => upd("description", e.target.value)}
                    rows={2} placeholder="Описание того, что нужно сделать..."
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500 resize-none" />
                </div>

                {/* Condition type */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-neutral-500 uppercase font-bold">Условие выдачи</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CONDITION_TYPES.map(c => (
                      <button key={c.value} onClick={() => upd("condition_type", c.value)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${form.condition_type === c.value ? "bg-yellow-900/40 border-yellow-600" : "bg-neutral-800 border-neutral-700 hover:border-neutral-600"}`}>
                        <p className="text-xs font-bold">{c.label}</p>
                        <p className="text-[9px] text-neutral-400 mt-0.5">{c.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Condition value + preview */}
                {form.condition_type !== "manual" && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-neutral-500 uppercase font-bold">
                      Целевое значение ({selectedCond?.unit || "единиц"})
                    </label>
                    <input type="number" min={1} value={form.condition_value}
                      onChange={e => upd("condition_value", parseInt(e.target.value) || 1)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500" />
                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-2">
                      <p className="text-[10px] text-neutral-400">
                        Превью: <span className="text-yellow-400">{form.icon} {form.title || "Название"}</span>
                        {" → "}{calcProgress(form.condition_type, form.condition_value)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Rewards */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-neutral-500 uppercase font-bold">Награды за разблокировку</label>
                  <div className="grid grid-cols-2 gap-2">
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
                  </div>
                </div>

                {/* Active */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <div onClick={() => upd("is_active", !form.is_active)}
                    className={`w-10 h-5 rounded-full flex items-center transition-colors ${form.is_active ? "bg-yellow-600" : "bg-neutral-700"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-sm text-neutral-300">Активно (проверяется для всех игроков)</span>
                </label>

                {/* Buttons */}
                <div className="flex gap-2">
                  <button onClick={() => { setShowForm(false); setEditId(null); }}
                    className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-sm transition-colors">
                    Отмена
                  </button>
                  <button onClick={handleSave} disabled={!form.title || !form.key || saving}
                    className="flex-1 py-2.5 bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {editId ? "Обновить" : "Создать"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* List header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Достижения ({achievements.length})</h2>
          <button onClick={() => { load(); loadStats(); }} className="text-neutral-500 hover:text-white"><RefreshCw size={16} /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-yellow-500" /></div>
        ) : achievements.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            <Trophy size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Нет достижений. Создайте первое!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {achievements.map(ach => {
              const condInfo = CONDITION_TYPES.find(c => c.value === ach.condition_type);
              const unlocked = stats[ach.id] || 0;
              const isExpanded = expandedId === ach.id;
              return (
                <div key={ach.id} className={`bg-neutral-900 border rounded-2xl overflow-hidden ${ach.is_active ? "border-neutral-700" : "border-neutral-800 opacity-60"}`}>
                  <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-800/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : ach.id)}>
                    <span className="text-2xl">{ach.icon || "🏆"}</span>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-white text-sm">{ach.title}</p>
                      <p className="text-[10px] text-neutral-500 mt-0.5">
                        {condInfo?.label || ach.condition_type}
                        {ach.condition_value ? ` · ${ach.condition_value} ${condInfo?.unit || ""}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-blue-400 font-bold">{unlocked}</p>
                      <p className="text-[9px] text-neutral-600">выдано</p>
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-neutral-500 shrink-0" /> : <ChevronDown size={14} className="text-neutral-500 shrink-0" />}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4 border-t border-neutral-800 pt-3 space-y-3">
                          {ach.description && <p className="text-xs text-neutral-400">{ach.description}</p>}
                          <div className="flex gap-2 text-[11px]">
                            <span className="bg-neutral-800 px-2 py-1 rounded-lg text-neutral-400 font-mono">key: {ach.key}</span>
                            {(ach.reward_fear || 0) > 0 && <span className="bg-red-900/30 px-2 py-1 rounded-lg text-red-400">💀+{ach.reward_fear}</span>}
                            {(ach.reward_watermelons || 0) > 0 && <span className="bg-green-900/30 px-2 py-1 rounded-lg text-green-400">🍉+{ach.reward_watermelons}</span>}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleToggle(ach)}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${ach.is_active ? "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-red-700 hover:text-red-400" : "bg-green-900/30 border-green-700/50 text-green-400"}`}>
                              {ach.is_active ? <><ToggleRight size={14} /> Деактивировать</> : <><ToggleLeft size={14} /> Активировать</>}
                            </button>
                            <button onClick={() => handleEdit(ach)} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-xs font-bold transition-colors">
                              Редакт.
                            </button>
                            <button onClick={() => handleDelete(ach.id)} className="px-3 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-xl text-xs transition-colors">
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
