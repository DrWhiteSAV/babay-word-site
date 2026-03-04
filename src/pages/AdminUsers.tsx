import { useState } from "react";
import { motion } from "motion/react";
import { Users, Save, Key, Plus, Trash2 } from "lucide-react";
import Header from "../components/Header";
import { usePlayerStore } from "../store/playerStore";
import { DEFAULT_USERS } from "../config/defaultSettings";

type Role = "Супер-Бабай" | "Ад-Бабай" | "Бабай";

const ROLE_COLORS: Record<Role, string> = {
  "Супер-Бабай": "text-red-400 bg-red-900/30 border-red-900/50",
  "Ад-Бабай": "text-orange-400 bg-orange-900/30 border-orange-900/50",
  "Бабай": "text-neutral-300 bg-neutral-800/50 border-neutral-700",
};

const ROLE_ACCESS: Record<Role, { access: string; pages: string }> = {
  "Супер-Бабай": { access: "Полный доступ + добавление Ад-Бабаев", pages: "Все разделы админки и игры" },
  "Ад-Бабай": { access: "Полный доступ (кроме добавления Ад-Бабаев)", pages: "Все разделы кроме управления ролями" },
  "Бабай": { access: "Обычный пользователь", pages: "Только игровые страницы" },
};

interface UserEntry {
  id: string;
  name: string;
  role: Role;
  fear?: number;
  watermelons?: number;
  energy?: number;
  gender?: string;
  style?: string;
}

export default function AdminUsers() {
  const { character, fear, watermelons, energy } = usePlayerStore();

  const [users, setUsers] = useState<UserEntry[]>([
    {
      id: DEFAULT_USERS[0].id,
      name: character?.name || DEFAULT_USERS[0].name,
      role: DEFAULT_USERS[0].role,
      fear,
      watermelons,
      energy,
      gender: character?.gender,
      style: character?.style,
    },
  ]);

  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>("Бабай");
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");

  const handleRoleChange = (id: string, role: Role) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
  };

  const handleAddUser = () => {
    if (!newId.trim()) return;
    if (users.find(u => u.id === newId.trim())) {
      alert("Пользователь с таким ID уже существует");
      return;
    }
    setUsers(prev => [...prev, { id: newId.trim(), name: newName || "Неизвестный", role: newRole }]);
    setNewId("");
    setNewName("");
    setNewRole("Бабай");
  };

  const handleDelete = (id: string) => {
    if (confirm(`Удалить пользователя ${id}?`)) {
      setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    alert("Пользователи и роли сохранены!");
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container">
        <div className="fog-layer"></div>
        <div className="fog-layer-2"></div>
      </div>

      <Header
        title={<><Users size={20} /> Пользователи</>}
        backUrl="/admin"
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${activeTab === "users" ? "bg-red-900/30 border-red-700 text-red-400" : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800"}`}
          >
            Профили
          </button>
          <button
            onClick={() => setActiveTab("roles")}
            className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${activeTab === "roles" ? "bg-red-900/30 border-red-700 text-red-400" : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800"}`}
          >
            Уровни доступа
          </button>
        </div>

        {/* Roles legend */}
        {activeTab === "roles" && (
          <div className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-800 text-xs text-neutral-400 space-y-1.5">
            <p className="font-bold text-neutral-300 mb-2">Иерархия ролей:</p>
            <div className="flex items-start gap-2"><span className="text-red-400 font-bold w-28 shrink-0">Супер-Бабай:</span><span>{ROLE_ACCESS["Супер-Бабай"].access}</span></div>
            <div className="flex items-start gap-2"><span className="text-orange-400 font-bold w-28 shrink-0">Ад-Бабай:</span><span>{ROLE_ACCESS["Ад-Бабай"].access}</span></div>
            <div className="flex items-start gap-2"><span className="text-neutral-300 font-bold w-28 shrink-0">Бабай:</span><span>{ROLE_ACCESS["Бабай"].access}</span></div>
          </div>
        )}

        {/* Users table */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-400">
              <thead className="text-[10px] text-neutral-500 uppercase bg-neutral-900/50 border-b border-neutral-800">
                <tr>
                  <th className="px-3 py-3">ID</th>
                  <th className="px-3 py-3">Имя</th>
                  {activeTab === "users" && <>
                    <th className="px-3 py-3">Пол/Стиль</th>
                    <th className="px-3 py-3">Страх</th>
                    <th className="px-3 py-3">Арбузы</th>
                    <th className="px-3 py-3">Энергия</th>
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
                  <tr key={user.id} className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors">
                    <td className="px-3 py-2 font-mono text-white flex items-center gap-1.5">
                      <Key size={11} className="text-red-500 shrink-0" />
                      {user.id}
                    </td>
                    <td className="px-3 py-2 font-bold text-white">{user.name}</td>
                    {activeTab === "users" && <>
                      <td className="px-3 py-2 text-neutral-400">{user.gender || "-"} / {user.style || "-"}</td>
                      <td className="px-3 py-2 text-red-400">{user.fear ?? "-"}</td>
                      <td className="px-3 py-2 text-green-400">{user.watermelons ?? "-"}</td>
                      <td className="px-3 py-2 text-blue-400">{user.energy ?? "-"}</td>
                    </>}
                    <td className="px-3 py-2">
                      <select
                        className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-white focus:border-red-500 outline-none transition-colors text-xs"
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                      >
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
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-1 text-neutral-700 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add user */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2">
            <Plus size={14} /> Добавить пользователя
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Telegram ID"
              value={newId}
              onChange={e => setNewId(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:border-red-500 outline-none"
            />
            <input
              type="text"
              placeholder="Имя"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:border-red-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value as Role)}
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs focus:border-red-500 outline-none"
            >
              <option value="Супер-Бабай">Супер-Бабай</option>
              <option value="Ад-Бабай">Ад-Бабай</option>
              <option value="Бабай">Бабай</option>
            </select>
            <button
              onClick={handleAddUser}
              className="px-4 py-2 bg-red-900/50 hover:bg-red-800 text-white rounded-lg text-xs font-bold border border-red-700 transition-colors flex items-center gap-1"
            >
              <Plus size={12} /> Добавить
            </button>
          </div>
        </div>

        <button
          onClick={handleSave}
          className={`w-full font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 border mb-6 ${saved ? "bg-green-900/50 border-green-700 text-green-400" : "bg-red-900/80 hover:bg-red-800 text-white border-red-700"}`}
        >
          <Save size={18} />
          {saved ? "Сохранено!" : "Сохранить изменения"}
        </button>
      </div>
    </motion.div>
  );
}
