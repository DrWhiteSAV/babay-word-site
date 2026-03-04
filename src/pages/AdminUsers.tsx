import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Users, Save, Key, Plus, Trash2, Loader2 } from "lucide-react";
import Header from "../components/Header";
import { DEFAULT_USERS } from "../config/defaultSettings";
import { supabase } from "../integrations/supabase/client";

type Role = "Супер-Бабай" | "Ад-Бабай" | "Бабай";

const ROLE_COLORS: Record<Role, string> = {
  "Супер-Бабай": "text-red-400 bg-red-900/30 border-red-900/50",
  "Ад-Бабай": "text-orange-400 bg-orange-900/30 border-orange-900/50",
  "Бабай": "text-neutral-300 bg-neutral-800/50 border-neutral-700",
};

const ROLE_ACCESS: Record<Role, { access: string; pages: string }> = {
  "Супер-Бабай": { access: "Полный доступ + добавление Ад-Бабаев", pages: "Все разделы" },
  "Ад-Бабай": { access: "Полный доступ (кроме ролей)", pages: "Все разделы кроме ролей" },
  "Бабай": { access: "Обычный пользователь", pages: "Только игра" },
};

interface UserEntry {
  id: string;
  telegram_id: string;
  name: string;
  role: Role;
  username?: string;
  photo_url?: string;
  fear?: number;
  watermelons?: number;
  energy?: number;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>("Бабай");
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("telegram_id, first_name, last_name, username, photo_url, role");
      const { data: stats } = await supabase
        .from("player_stats")
        .select("telegram_id, fear, watermelons, energy");

      if (profiles && profiles.length > 0) {
        const statsMap = new Map((stats || []).map(s => [s.telegram_id, s]));
        const mapped: UserEntry[] = profiles.map(p => {
          const s = statsMap.get(p.telegram_id);
          return {
            id: String(p.telegram_id),
            telegram_id: String(p.telegram_id),
            name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Неизвестный",
            role: (p.role as Role) || "Бабай",
            username: p.username || undefined,
            photo_url: p.photo_url || undefined,
            fear: s?.fear,
            watermelons: s?.watermelons,
            energy: s?.energy,
          };
        });
        setUsers(mapped);
      } else {
        // Fallback to defaults if no DB data
        setUsers(DEFAULT_USERS.map(u => ({ ...u, telegram_id: u.id })));
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleRoleChange = async (telegram_id: string, role: Role) => {
    setUsers(prev => prev.map(u => u.telegram_id === telegram_id ? { ...u, role } : u));
    await supabase.from("profiles").update({ role }).eq("telegram_id", Number(telegram_id));
  };

  const handleAddUser = () => {
    if (!newId.trim()) return;
    if (users.find(u => u.telegram_id === newId.trim())) { alert("Пользователь уже существует"); return; }
    setUsers(prev => [...prev, { id: newId.trim(), telegram_id: newId.trim(), name: newName || "Неизвестный", role: newRole }]);
    setNewId(""); setNewName(""); setNewRole("Бабай");
  };

  const handleDelete = async (telegram_id: string) => {
    if (confirm(`Удалить пользователя ${telegram_id}?`)) {
      setUsers(prev => prev.filter(u => u.telegram_id !== telegram_id));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    // Update all roles in DB
    const updates = users.map(u =>
      supabase.from("profiles").update({ role: u.role }).eq("telegram_id", Number(u.telegram_id))
    );
    await Promise.all(updates);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container"><div className="fog-layer"></div><div className="fog-layer-2"></div></div>
      <Header title={<><Users size={20} /> Пользователи</>} backUrl="/admin" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          {(["users", "roles"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${activeTab === tab ? "bg-red-900/30 border-red-700 text-red-400" : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800"}`}>
              {tab === "users" ? "Профили" : "Уровни доступа"}
            </button>
          ))}
        </div>

        {activeTab === "roles" && (
          <div className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-800 text-xs text-neutral-400 space-y-1.5">
            <p className="font-bold text-neutral-300 mb-2">Иерархия ролей:</p>
            {(Object.entries(ROLE_ACCESS) as [Role, typeof ROLE_ACCESS[Role]][]).map(([role, info]) => (
              <div key={role} className="flex items-start gap-2">
                <span className={`font-bold w-28 shrink-0 ${ROLE_COLORS[role].split(" ")[0]}`}>{role}:</span>
                <span>{info.access}</span>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-red-500" /></div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-400">
                <thead className="text-[10px] text-neutral-500 uppercase bg-neutral-900/50 border-b border-neutral-800">
                  <tr>
                    <th className="px-3 py-3">ID</th>
                    <th className="px-3 py-3">Имя</th>
                    {activeTab === "users" && <>
                      <th className="px-3 py-3">Username</th>
                      <th className="px-3 py-3">Страх</th>
                      <th className="px-3 py-3">🍉</th>
                      <th className="px-3 py-3">⚡</th>
                    </>}
                    <th className="px-3 py-3">Роль</th>
                    {activeTab === "roles" && <>
                      <th className="px-3 py-3">Права</th>
                      <th className="px-3 py-3">Разделы</th>
                    </>}
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.telegram_id} className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors">
                      <td className="px-3 py-2 font-mono text-white">
                        <div className="flex items-center gap-1.5"><Key size={11} className="text-red-500 shrink-0" />{user.telegram_id}</div>
                      </td>
                      <td className="px-3 py-2 font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          {user.photo_url && <img src={user.photo_url} className="w-5 h-5 rounded-full" alt="" />}
                          {user.name}
                        </div>
                      </td>
                      {activeTab === "users" && <>
                        <td className="px-3 py-2 text-neutral-400">{user.username ? `@${user.username}` : "—"}</td>
                        <td className="px-3 py-2 text-red-400">{user.fear ?? "—"}</td>
                        <td className="px-3 py-2 text-green-400">{user.watermelons ?? "—"}</td>
                        <td className="px-3 py-2 text-blue-400">{user.energy ?? "—"}</td>
                      </>}
                      <td className="px-3 py-2">
                        <select
                          className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-white focus:border-red-500 outline-none text-xs"
                          value={user.role}
                          onChange={e => handleRoleChange(user.telegram_id, e.target.value as Role)}>
                          <option value="Супер-Бабай">Супер-Бабай</option>
                          <option value="Ад-Бабай">Ад-Бабай</option>
                          <option value="Бабай">Бабай</option>
                        </select>
                      </td>
                      {activeTab === "roles" && <>
                        <td className="px-3 py-2 text-[10px]">{ROLE_ACCESS[user.role].access}</td>
                        <td className="px-3 py-2 text-[10px] text-neutral-500">{ROLE_ACCESS[user.role].pages}</td>
                      </>}
                      <td className="px-3 py-2">
                        <button onClick={() => handleDelete(user.telegram_id)} className="p-1 text-neutral-700 hover:text-red-500 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 text-xs text-neutral-600 border-t border-neutral-800">
              {users.length} пользователей в базе данных
            </div>
          </div>
        )}

        {/* Add user */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2"><Plus size={14} /> Добавить пользователя</h3>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Telegram ID" value={newId} onChange={e => setNewId(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:border-red-500 outline-none" />
            <input type="text" placeholder="Имя" value={newName} onChange={e => setNewName(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:border-red-500 outline-none" />
          </div>
          <div className="flex gap-2">
            <select value={newRole} onChange={e => setNewRole(e.target.value as Role)}
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:border-red-500 outline-none">
              <option value="Супер-Бабай">Супер-Бабай</option>
              <option value="Ад-Бабай">Ад-Бабай</option>
              <option value="Бабай">Бабай</option>
            </select>
            <button onClick={handleAddUser}
              className="px-4 py-2 bg-red-900/50 hover:bg-red-800 text-white rounded-lg text-xs font-bold border border-red-700 transition-colors flex items-center gap-1">
              <Plus size={12} /> Добавить
            </button>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className={`w-full font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 border mb-6 ${saved ? "bg-green-900/50 border-green-700 text-green-400" : "bg-red-900/80 hover:bg-red-800 text-white border-red-700"}`}>
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saved ? "Сохранено!" : saving ? "Сохранение..." : "Сохранить изменения"}
        </button>
      </div>
    </motion.div>
  );
}
