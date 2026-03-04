import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Users, UserPlus, Zap, MessageSquare, Link, Copy, Plus, X, Trash2, Edit2, ChevronDown } from "lucide-react";
import Header from "../components/Header";
import { transliterate } from "../utils/transliterate";
import ProfilePopup from "../components/ProfilePopup";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";

export default function Friends() {
  const navigate = useNavigate();
  const location = useLocation();
  const { character, friends, groupChats, addFriend, toggleFriendAi, addEnergy, addFear, createGroupChat, globalBackgroundUrl, pageBackgrounds, deleteFriend, deleteGroupChat, updateGroupName } = usePlayerStore();
  const { profile } = useTelegram();
  const [newFriendName, setNewFriendName] = useState("");
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [showProfilePopup, setShowProfilePopup] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [referralCount, setReferralCount] = useState(0);
  const [referralFriends, setReferralFriends] = useState<Array<{first_name: string; username: string | null}>>([]);
  const [showReferralList, setShowReferralList] = useState(false);

  useEffect(() => {
    if (!character) return;
    const latinName = transliterate(character.name).replace(/\s+/g, "").toLowerCase();
    supabase
      .from("profiles")
      .select("first_name, username")
      .eq("referral_code", latinName)
      .then(({ data }) => {
        if (data) {
          setReferralCount(data.length);
          setReferralFriends(data);
        }
      });
  }, [character]);

  if (!character) {
    navigate("/");
    return null;
  }

  const latinName = transliterate(character.name).replace(/\s+/g, "").toLowerCase();
  const referralLink = `https://t.me/Bab_AIbot/app?startapp=${latinName}`;

  const handleAddFriend = () => {
    if (newFriendName.trim() && newFriendName !== character.name) {
      addFriend(newFriendName.trim());
      setNewFriendName("");
    }
  };

  const handleCopyRef = () => {
    navigator.clipboard.writeText(referralLink);
    alert("Реферальная ссылка скопирована!");
  };


  const shareEnergy = (friendName: string) => {
    const { energy, useEnergy } = usePlayerStore.getState();
    if (energy >= 10) {
      useEnergy(10);
      alert(`Вы поделились 10 энергии с ${friendName}!`);
    } else {
      alert("Недостаточно энергии для отправки.");
    }
  };

  const handleCreateGroup = () => {
    if (newGroupName.trim() && selectedFriends.length > 0) {
      createGroupChat(newGroupName.trim(), selectedFriends);
      setNewGroupName("");
      setSelectedFriends([]);
      setShowGroupModal(false);
    }
  };

  const handleEditGroup = (id: string, currentName: string) => {
    setEditingGroupId(id);
    setEditGroupName(currentName);
  };

  const saveGroupName = () => {
    if (editingGroupId && editGroupName.trim()) {
      updateGroupName(editingGroupId, editGroupName.trim());
      setEditingGroupId(null);
      setEditGroupName("");
    }
  };

  const toggleFriendSelection = (name: string) => {
    setSelectedFriends(prev => 
      prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name]
    );
  };

  const getAvatarUrl = (name: string) => {
    if (name === "ДанИИл") return "https://picsum.photos/seed/danil/100/100";
    return `https://picsum.photos/seed/${name}/100/100`;
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
        title={<><Users size={20} /> Друзья</>}
        backUrl="/hub"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-8 relative z-10">
        <section className="bg-neutral-900/80 backdrop-blur-md p-6 rounded-2xl border border-neutral-800 space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2 text-white">
            <Link size={18} className="text-red-500" /> Реферальная программа
          </h2>
          <p className="text-sm text-neutral-400">
            Приглашайте друзей по ссылке и получайте бонусы: 100 <Zap size={12} className="inline text-yellow-500" /> и 100 <span className="text-red-500">Страха</span>.
          </p>
          {/* Referral counter */}
          <button
            onClick={() => setShowReferralList(!showReferralList)}
            className="w-full flex items-center justify-between bg-neutral-950 border border-neutral-800 hover:border-red-900/50 rounded-xl px-4 py-3 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm text-neutral-300">
              <Users size={16} className="text-red-500" /> Пришло по ссылке
            </span>
            <span className="font-black text-white text-lg">{referralCount}</span>
          </button>
          {/* Referral list */}
          {showReferralList && (
            <div className="space-y-2">
              {referralFriends.length === 0 ? (
                <p className="text-neutral-500 text-xs text-center py-2">Пока никто не пришёл по вашей ссылке</p>
              ) : referralFriends.map((f, i) => (
                <div key={i} className="flex items-center gap-3 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-red-400">
                    {f.first_name[0]}
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold">{f.first_name}</p>
                    {f.username && <p className="text-neutral-500 text-xs">@{f.username}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-500 truncate">
              {referralLink}
            </div>
            <button
              onClick={handleCopyRef}
              className="p-3 bg-red-700 hover:bg-red-600 text-white rounded-xl transition-colors flex items-center justify-center shrink-0"
            >
              <Copy size={16} />
            </button>
          </div>
        </section>


        <section className="bg-neutral-900/80 backdrop-blur-md p-6 rounded-2xl border border-neutral-800">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
            <UserPlus size={18} className="text-red-500" /> Добавить друга
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newFriendName}
              onChange={(e) => setNewFriendName(e.target.value)}
              placeholder="Имя Бабая..."
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-900 transition-colors"
            />
            <button
              onClick={handleAddFriend}
              disabled={!newFriendName.trim()}
              className="px-4 bg-red-700 hover:bg-red-600 rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center"
            >
              <UserPlus size={20} className="text-white" />
            </button>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Групповые чаты ({groupChats.length})</h2>
            <button 
              onClick={() => setShowGroupModal(true)}
              className="p-2 bg-red-900/30 text-red-500 hover:bg-red-900/50 rounded-xl transition-colors flex items-center gap-1 text-sm font-bold"
            >
              <Plus size={16} /> Создать
            </button>
          </div>
          {groupChats.length === 0 ? (
            <p className="text-center text-neutral-500 py-4">Нет групповых чатов.</p>
          ) : (
            <div className="space-y-3">
              {groupChats.map((chat) => (
                <div key={chat.id} className="bg-neutral-900/80 backdrop-blur-md p-4 rounded-xl border border-neutral-800 flex items-center justify-between">
                  {editingGroupId === chat.id ? (
                    <div className="flex-1 flex gap-2 mr-2">
                      <input
                        type="text"
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-red-900 text-white"
                        autoFocus
                      />
                      <button onClick={saveGroupName} className="text-green-500 text-sm font-bold">OK</button>
                      <button onClick={() => setEditingGroupId(null)} className="text-neutral-500 text-sm">Отмена</button>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white block">{chat.name}</span>
                        <button onClick={() => handleEditGroup(chat.id, chat.name)} className="text-neutral-500 hover:text-white">
                          <Edit2 size={12} />
                        </button>
                      </div>
                      <span className="text-xs text-neutral-500">{chat.members.length} участников</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => navigate("/chat", { state: { groupId: chat.id } })}
                      className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-blue-400 transition-colors"
                      title="Чат"
                    >
                      <MessageSquare size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm('Удалить группу?')) {
                          deleteGroupChat(chat.id);
                        }
                      }}
                      className="p-2 bg-neutral-800 hover:bg-red-900/50 rounded-lg text-red-500 transition-colors"
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-bold mb-4 text-white">Список друзей ({friends.length})</h2>
          {friends.length === 0 ? (
            <p className="text-center text-neutral-500 py-8">У вас пока нет друзей. Пригласите кого-нибудь!</p>
          ) : (
            <div className="space-y-3">
              {friends.map((friend) => (
                <div key={friend.name} className="bg-neutral-900/80 backdrop-blur-md p-4 rounded-xl border border-neutral-800 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => setShowProfilePopup(friend.name)}
                    >
                      <img src={getAvatarUrl(friend.name)} alt="avatar" className="w-10 h-10 rounded-full object-cover border border-neutral-700" />
                      <span className="font-bold text-white">{friend.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => shareEnergy(friend.name)}
                        className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-yellow-500 transition-colors"
                        title="Поделиться энергией"
                      >
                        <Zap size={16} />
                      </button>
                      <button 
                        onClick={() => navigate("/chat", { state: { friendName: friend.name } })}
                        className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-blue-400 transition-colors"
                        title="Чат"
                      >
                        <MessageSquare size={16} />
                      </button>
                      {friend.name !== "ДанИИл" && (
                        <button 
                          onClick={() => {
                            if (confirm(`Удалить ${friend.name} из друзей?`)) {
                              deleteFriend(friend.name);
                            }
                          }}
                          className="p-2 bg-neutral-800 hover:bg-red-900/50 rounded-lg text-red-500 transition-colors"
                          title="Удалить"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  {friend.name !== "ДанИИл" && (
                    <div className="flex items-center justify-between text-sm border-t border-neutral-800 pt-2">
                      <span className="text-neutral-400">ИИ-заместитель в чате:</span>
                      <button
                        onClick={() => toggleFriendAi(friend.name)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${friend.isAiEnabled ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-neutral-800 text-neutral-500 border border-neutral-700'}`}
                      >
                        {friend.isAiEnabled ? "ВКЛ" : "ВЫКЛ"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Create Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-sm w-full"
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider">Новая группа</h2>
              <button onClick={() => setShowGroupModal(false)} className="text-neutral-500 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Название группы..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-900 transition-colors mb-4 text-white"
            />

            <h3 className="text-sm font-bold text-neutral-400 mb-2">Выберите участников:</h3>
            <div className="max-h-48 overflow-y-auto space-y-2 mb-4 pr-2">
              {friends.filter(f => f.name !== "ДанИИл").map(friend => (
                <label key={friend.name} className="flex items-center gap-3 p-2 bg-neutral-800/50 rounded-xl cursor-pointer hover:bg-neutral-800">
                  <input 
                    type="checkbox" 
                    checked={selectedFriends.includes(friend.name)}
                    onChange={() => toggleFriendSelection(friend.name)}
                    className="accent-red-600 w-4 h-4"
                  />
                  <span className="text-white">{friend.name}</span>
                </label>
              ))}
            </div>

            <button
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim() || selectedFriends.length === 0}
              className="w-full py-3 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              Создать
            </button>
          </motion.div>
        </div>
      )}

      {showProfilePopup && (
        <ProfilePopup name={showProfilePopup} onClose={() => setShowProfilePopup(null)} />
      )}
    </motion.div>
  );
}
