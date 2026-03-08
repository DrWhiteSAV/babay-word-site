import { useState, useEffect, useRef, ChangeEvent, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Send, ImagePlus, X, Users, Settings, Reply, Check, CheckCheck, RefreshCw, AlertTriangle } from "lucide-react";
import { generateFriendChat } from "../services/ai";
import ProfilePopup from "../components/ProfilePopup";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";
import { useFriendOnlineStatus } from "../hooks/useOnlinePresence";
import { pushNotification } from "../components/NotificationPopup";

const AI_REPLY_TIMEOUT = 20; // seconds

interface Message {
  id: string;
  sender: string;
  text: string;
  imageUrl?: string;
  replyTo?: string;
  sender_telegram_id?: number;
  read_at?: string | null;
  created_at?: string;
}

// Pending retry context
interface PendingRetry {
  userMessage: string;
  imageToSend: string | null;
  replyToMsgId: string | null;
  responder: string;
  recentMessages: { sender: string; text: string }[];
}

export default function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { character, friends, groupChats, updateGroupMembers } = usePlayerStore();
  const { profile } = useTelegram();
  const friendName = location.state?.friendName;
  const groupId = location.state?.groupId;
  const friend = friends.find(f => f.name === friendName);
  const group = groupChats.find(g => g.id === groupId);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState<string | null>(null);
  const [replyToMsg, setReplyToMsg] = useState<Message | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>(group?.members || []);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  // AI timeout state
  const [aiCountdown, setAiCountdown] = useState(0);
  const [aiTimedOut, setAiTimedOut] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<PendingRetry | null>(null);
  const aiIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const aiResolvedRef = useRef(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatKey = groupId
    ? `group_${groupId}`
    : profile?.telegram_id && friend
    ? [profile.telegram_id, friendName].sort().join('_')
    : null;

  const [friendTelegramId, setFriendTelegramId] = useState<number | null>(null);
  useEffect(() => {
    if (!friendName) return;
    supabase.from("player_stats").select("telegram_id").ilike("character_name", friendName).single()
      .then(({ data }) => { if (data) setFriendTelegramId(data.telegram_id); });
  }, [friendName]);

  const onlineMap = useFriendOnlineStatus(friendTelegramId ? [friendTelegramId] : []);
  const isFriendOnline = friendTelegramId ? onlineMap[friendTelegramId] : false;

  useEffect(() => {
    if (!character || (!friendName && !groupId)) navigate("/friends");
  }, [character, friendName, groupId, navigate]);

  useEffect(() => {
    if (!chatKey) return;
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_key", chatKey)
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) {
        setMessages(data.map(m => ({
          id: m.id,
          sender: m.role === 'user' ? 'user' : m.friend_name,
          text: m.content,
          sender_telegram_id: (m as any).sender_telegram_id,
          read_at: (m as any).read_at,
          created_at: m.created_at,
        })));
      }
    };
    load();

    const channel = supabase.channel(`chat_${chatKey}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `chat_key=eq.${chatKey}` },
        (payload) => {
          const m = payload.new as any;
          const msg: Message = {
            id: m.id,
            sender: m.role === 'user' ? (m.sender_telegram_id === profile?.telegram_id ? 'user' : m.friend_name) : m.friend_name,
            text: m.content,
            sender_telegram_id: m.sender_telegram_id,
            read_at: m.read_at,
            created_at: m.created_at,
          };
          setMessages(prev => {
            if (prev.some(p => p.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (m.sender_telegram_id !== profile?.telegram_id) {
            pushNotification({
              type: 'chat',
              title: `💬 Новое сообщение`,
              message: `${m.friend_name}: ${m.content.slice(0, 80)}`,
            });
          }
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatKey, profile?.telegram_id]);

  useEffect(() => {
    if (!chatKey || !profile?.telegram_id || messages.length === 0) return;
    const unread = messages.filter(m => m.sender_telegram_id !== profile.telegram_id && !m.read_at);
    if (unread.length > 0) {
      setUnreadCount(0);
      const ids = unread.map(m => m.id);
      supabase.from("chat_messages").update({ read_at: new Date().toISOString() } as any)
        .in("id", ids).then(() => {
          setMessages(prev => prev.map(m => ids.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m));
        });
    }
  }, [messages.length, chatKey, profile?.telegram_id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
    };
  }, []);

  const startAiCountdown = useCallback(() => {
    if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
    aiResolvedRef.current = false;
    setAiTimedOut(false);
    setAiCountdown(AI_REPLY_TIMEOUT);
    let remaining = AI_REPLY_TIMEOUT;
    aiIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setAiCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(aiIntervalRef.current!);
        if (!aiResolvedRef.current) {
          setAiTimedOut(true);
          setIsAiTyping(false);
          setAiCountdown(0);
        }
      }
    }, 1000);
  }, []);

  const stopAiCountdown = useCallback(() => {
    if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
    aiResolvedRef.current = true;
    setAiCountdown(0);
  }, []);

  const saveMessageToDB = async (msg: Message, role: string, senderName: string) => {
    if (!chatKey) return;
    await supabase.from("chat_messages").insert({
      telegram_id: profile?.telegram_id || 0,
      content: msg.text || '',
      role,
      friend_name: senderName,
      chat_key: chatKey,
      sender_telegram_id: role === 'user' ? profile?.telegram_id : null,
    } as any);
  };

  const doAiReply = useCallback(async (
    userMessage: string,
    imageToSend: string | null,
    replyToMsgId: string | null,
    responder: string,
    recentMessages: { sender: string; text: string }[],
    isRetry = false,
  ) => {
    setIsAiTyping(true);
    setAiTimedOut(false);
    if (!isRetry) setPendingRetry(null);

    startAiCountdown();

    try {
      const responseText = await generateFriendChat(
        userMessage, responder, character!, character?.style || "Обычная",
        recentMessages, imageToSend || undefined, profile?.telegram_id
      );

      if (aiResolvedRef.current && isRetry === false) {
        // timed out before we got here
        return;
      }

      stopAiCountdown();
      aiResolvedRef.current = true;

      // Validate: must be non-empty string
      if (!responseText || typeof responseText !== "string" || responseText.trim().length === 0) {
        setAiTimedOut(true);
        setIsAiTyping(false);
        setPendingRetry({ userMessage, imageToSend, replyToMsgId, responder, recentMessages });
        return;
      }

      const aiMsg: Message = { id: Date.now().toString(), sender: responder, text: responseText, replyTo: replyToMsgId || undefined };
      setMessages(prev => [...prev, aiMsg]);
      await saveMessageToDB(aiMsg, 'assistant', responder);
      setPendingRetry(null);
    } catch (e) {
      stopAiCountdown();
      aiResolvedRef.current = true;
      setAiTimedOut(true);
      setPendingRetry({ userMessage, imageToSend, replyToMsgId, responder, recentMessages });
    } finally {
      if (aiResolvedRef.current) {
        setIsAiTyping(false);
      }
    }
  }, [character, profile?.telegram_id, startAiCountdown, stopAiCountdown]);

  const handleRetryAi = useCallback(() => {
    if (!pendingRetry) return;
    setAiTimedOut(false);
    const recentMessages = messages.slice(-10).map(m => ({ sender: m.sender, text: m.text }));
    doAiReply(
      pendingRetry.userMessage,
      pendingRetry.imageToSend,
      pendingRetry.replyToMsgId,
      pendingRetry.responder,
      recentMessages,
      true,
    );
  }, [pendingRetry, messages, doAiReply]);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          const SUPABASE_URL = "https://psuvnvqvspqibsezcrny.supabase.co";
          const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzdXZudnF2c3BxaWJzZXpjcm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDI5NTIsImV4cCI6MjA4NzU3ODk1Mn0.VHI6Kefzbz6Hc8TpLI5_JRXAyPJ-y4oeE3Bkh16jFRU";
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/upload-to-imgbb`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
            body: JSON.stringify({ imageBase64: base64 }),
          });
          const data = await resp.json();
          if (data.url) {
            setSelectedImage(data.url);
            return;
          }
        } catch (e) {
          console.warn("[Chat] ImgBB upload failed, using base64 fallback:", e);
        }
        setSelectedImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || (!friend && !group)) return;

    const userMessage = input.trim();
    const imageToSend = selectedImage;
    const currentReplyTo = replyToMsg?.id;

    const newMsg: Message = { id: Date.now().toString(), sender: "user", text: userMessage, imageUrl: imageToSend || undefined, replyTo: currentReplyTo };
    setMessages(prev => [...prev, newMsg]);
    setInput("");
    setSelectedImage(null);
    setReplyToMsg(null);
    setShowMentions(false);

    await saveMessageToDB(newMsg, 'user', character?.name || 'user');

    const shouldUseAI = friend?.isAiEnabled && (!friendTelegramId || !isFriendOnline);

    if (shouldUseAI) {
      const recentMessages = messages.slice(-10).map(m => ({ sender: m.sender, text: m.text }));
      setPendingRetry({ userMessage, imageToSend, replyToMsgId: newMsg.id, responder: friend!.name, recentMessages });
      await doAiReply(userMessage, imageToSend, newMsg.id, friend!.name, recentMessages);
    } else if (group) {
      const aiMembers = group.members.filter(m => friends.find(f => f.name === m)?.isAiEnabled);
      const mentionedAIs = aiMembers.filter(m => userMessage.includes(`@${m}`));
      let responders = mentionedAIs;
      if (responders.length === 0 && currentReplyTo) {
        const repliedMsg = messages.find(m => m.id === currentReplyTo);
        if (repliedMsg && aiMembers.includes(repliedMsg.sender)) responders = [repliedMsg.sender];
      }
      if (responders.length === 0 && aiMembers.length > 0 && Math.random() > 0.8) {
        responders = [aiMembers[Math.floor(Math.random() * aiMembers.length)]];
      }
      if (responders.length > 0) {
        const recentMessages = messages.slice(-10).map(m => ({ sender: m.sender, text: m.text }));
        const firstResponder = responders[0];
        setPendingRetry({ userMessage, imageToSend, replyToMsgId: newMsg.id, responder: firstResponder, recentMessages });
        for (const responder of responders) {
          await doAiReply(userMessage, imageToSend, newMsg.id, responder, recentMessages);
        }
      }
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    if (group) {
      const lastWord = val.split(" ").pop();
      if (lastWord?.startsWith("@")) {
        setShowMentions(true);
        setMentionFilter(lastWord.slice(1).toLowerCase());
      } else setShowMentions(false);
    }
  };

  const insertMention = (name: string) => {
    const words = input.split(" ");
    words.pop();
    setInput([...words, `@${name} `].join(" ").trimStart());
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleUpdateMembers = () => {
    if (group) { updateGroupMembers(group.id, selectedFriends); setShowMembersModal(false); }
  };

  const getAvatarUrl = (sender: string) => {
    if (sender === "user") return character?.avatarUrl || "https://i.ibb.co/BVgY7XrT/babai.png";
    if (sender === "ДанИИл") return "https://i.ibb.co/rKGSq544/image.png";
    return `https://picsum.photos/seed/${sender}/100/100`;
  };

  if (!friend && !group) return null;
  const chatTitle = friend ? friend.name : group?.name;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col bg-transparent text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container"><div className="fog-layer"></div><div className="fog-layer-2"></div></div>

      <Header
        title={
          <div className="flex items-center gap-2">
            <MessageSquare size={20} />
            <span className="truncate max-w-[140px]">{chatTitle}</span>
            {friend && (
              <span className={`inline-block w-2 h-2 rounded-full ${isFriendOnline ? 'bg-green-400' : 'bg-neutral-600'}`} />
            )}
            {group && (
              <button onClick={() => setShowMembersModal(true)} className="ml-1 p-1 bg-neutral-800 rounded-lg hover:bg-neutral-700 text-neutral-400">
                <Users size={16} />
              </button>
            )}
          </div>
        }
        backUrl="/friends"
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10">
        {messages.length === 0 && (
          <p className="text-center text-neutral-500 py-8">Начните общение в чате {chatTitle}!</p>
        )}
        {messages.map((msg) => {
          const isUser = msg.sender === "user" || msg.sender_telegram_id === profile?.telegram_id;
          const repliedMsg = msg.replyTo ? messages.find(m => m.id === msg.replyTo) : null;
          const isRead = !!msg.read_at;

          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
              <div className="flex items-center gap-2 mb-1 cursor-pointer" onClick={() => setShowProfilePopup(isUser ? "user" : msg.sender)}>
                {!isUser && <img src={getAvatarUrl(msg.sender)} alt="avatar" className="w-6 h-6 rounded-full object-cover border border-neutral-700" />}
                <span className="text-xs text-neutral-500">{isUser ? character?.name : msg.sender}</span>
                {isUser && <img src={getAvatarUrl("user")} alt="avatar" className="w-6 h-6 rounded-full object-cover border border-neutral-700" />}
              </div>
              <div className="flex items-end gap-1 group/msg">
                {isUser && group && (
                  <button onClick={() => setReplyToMsg(msg)} className="opacity-0 group-hover/msg:opacity-100 p-1 text-neutral-500 hover:text-white transition-opacity">
                    <Reply size={14} />
                  </button>
                )}
                <div className={`max-w-[80%] p-3 rounded-2xl ${isUser ? "bg-red-900 text-white rounded-tr-sm" : "bg-neutral-800 text-neutral-200 rounded-tl-sm"}`}>
                  {repliedMsg && (
                    <div className="mb-2 p-2 bg-black/20 rounded-lg border-l-2 border-white/30 text-xs text-neutral-300">
                      <span className="font-bold opacity-70 block mb-1">{repliedMsg.sender === "user" ? character?.name : repliedMsg.sender}</span>
                      <span className="line-clamp-1">{repliedMsg.text || "Фото"}</span>
                    </div>
                  )}
                  {msg.imageUrl && <img src={msg.imageUrl} alt="attachment" className="w-full max-w-[200px] rounded-lg mb-2 object-contain" />}
                  {msg.text && (
                    <p className="text-sm">
                      {msg.text.split(' ').map((word, idx) =>
                        word.startsWith('@') ? <span key={idx} className="text-blue-400 font-bold">{word} </span> : word + ' '
                      )}
                    </p>
                  )}
                </div>
                {isUser && (
                  <span className="text-neutral-600 mb-1">
                    {isRead ? <CheckCheck size={12} className="text-blue-400" /> : <Check size={12} />}
                  </span>
                )}
                {!isUser && group && (
                  <button onClick={() => setReplyToMsg(msg)} className="opacity-0 group-hover/msg:opacity-100 p-1 text-neutral-500 hover:text-white transition-opacity">
                    <Reply size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* AI typing indicator with countdown */}
        {isAiTyping && (
          <div className="flex justify-start items-end gap-2">
            <div className="max-w-[80%] p-3 rounded-2xl bg-neutral-800 text-neutral-400 rounded-tl-sm flex items-center gap-2">
              <span className="animate-bounce">.</span><span className="animate-bounce delay-100">.</span><span className="animate-bounce delay-200">.</span>
              {aiCountdown > 0 && (
                <span className="text-xs font-mono text-red-400 ml-1 bg-red-900/30 px-1.5 py-0.5 rounded">
                  {aiCountdown}с
                </span>
              )}
            </div>
          </div>
        )}

        {/* AI timeout retry */}
        {aiTimedOut && !isAiTyping && pendingRetry && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="max-w-[85%] p-3 rounded-2xl bg-yellow-900/20 border border-yellow-600/40 rounded-tl-sm space-y-2">
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertTriangle size={14} />
                <span className="text-xs font-bold">ИИ тупит, Давай ещё раз?</span>
              </div>
              <button
                onClick={handleRetryAi}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/20 border border-yellow-600/50 text-yellow-300 rounded-xl text-xs font-bold hover:bg-yellow-600/30 transition-all"
              >
                <RefreshCw size={12} /> Повторить
              </button>
            </div>
          </motion.div>
        )}

        <div ref={chatEndRef} />
      </div>

      <div className="p-4 bg-neutral-900 border-t border-neutral-800 relative z-20">
        {replyToMsg && (
          <div className="mb-2 flex items-center justify-between bg-neutral-800 p-2 rounded-lg border-l-2 border-red-500">
            <div className="flex-1 min-w-0">
              <span className="text-xs text-red-400 font-bold block">Ответ {replyToMsg.sender === "user" ? character?.name : replyToMsg.sender}</span>
              <span className="text-sm text-neutral-300 truncate block">{replyToMsg.text || "Фото"}</span>
            </div>
            <button onClick={() => setReplyToMsg(null)} className="text-neutral-500 hover:text-white p-1"><X size={16} /></button>
          </div>
        )}
        {selectedImage && (
          <div className="mb-2 relative inline-block">
            <img src={selectedImage} alt="preview" className="h-20 rounded-lg border border-neutral-700" />
            <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-500"><X size={14} /></button>
          </div>
        )}
        {showMentions && group && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden shadow-xl max-h-40 overflow-y-auto">
            {group.members.filter(m => m.toLowerCase().includes(mentionFilter)).map(m => (
              <button key={m} onClick={() => insertMention(m)} className="w-full text-left px-4 py-2 hover:bg-neutral-700 text-white text-sm flex items-center gap-2">
                <img src={getAvatarUrl(m)} alt="" className="w-6 h-6 rounded-full" />{m}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-3 items-center">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-neutral-500 hover:text-white transition-colors flex-shrink-0">
            <ImagePlus size={20} />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={`Написать ${chatTitle}...`}
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-600"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() && !selectedImage}
            className="p-3 bg-red-700 hover:bg-red-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-white rounded-xl transition-colors flex-shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Profile popup */}
      <AnimatePresence>
        {showProfilePopup && (
          <ProfilePopup
            name={showProfilePopup === "user" ? (character?.name || "Ты") : showProfilePopup}
            onClose={() => setShowProfilePopup(null)}
          />
        )}
      </AnimatePresence>

      {/* Group members modal */}
      <AnimatePresence>
        {showMembersModal && group && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 z-50 flex items-end"
            onClick={() => setShowMembersModal(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={e => e.stopPropagation()}
              className="w-full bg-neutral-900 rounded-t-3xl p-6 space-y-4 max-h-[70vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Settings size={18} /> Участники группы</h3>
                <button onClick={() => setShowMembersModal(false)} className="text-neutral-500"><X size={20} /></button>
              </div>
              <div className="space-y-2">
                {friends.map(f => (
                  <label key={f.name} className="flex items-center gap-3 p-3 bg-neutral-800 rounded-xl cursor-pointer hover:bg-neutral-700">
                    <input
                      type="checkbox"
                      checked={selectedFriends.includes(f.name)}
                      onChange={e => {
                        if (e.target.checked) setSelectedFriends(prev => [...prev, f.name]);
                        else setSelectedFriends(prev => prev.filter(n => n !== f.name));
                      }}
                      className="w-4 h-4 accent-red-600"
                    />
                    <img src={getAvatarUrl(f.name)} alt="" className="w-8 h-8 rounded-full" />
                    <span className="text-white font-medium">{f.name}</span>
                    {f.isAiEnabled && <span className="ml-auto text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">ИИ</span>}
                  </label>
                ))}
              </div>
              <button
                onClick={handleUpdateMembers}
                className="w-full py-3 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold transition-colors"
              >
                Сохранить состав
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
