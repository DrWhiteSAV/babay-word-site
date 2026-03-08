import { useState, useEffect, useRef, ChangeEvent, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Send, ImagePlus, X, Users, Reply, Check, CheckCheck, RefreshCw, AlertTriangle, Edit2 } from "lucide-react";
import { generateFriendChat } from "../services/ai";
import ProfilePopup from "../components/ProfilePopup";
import Header from "../components/Header";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";
import { useFriendOnlineStatus } from "../hooks/useOnlinePresence";
import { pushNotification } from "../components/NotificationPopup";

const AI_REPLY_TIMEOUT = 20;

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

  useEffect(() => {
    return () => { if (aiIntervalRef.current) clearInterval(aiIntervalRef.current); };
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
      if (aiResolvedRef.current && isRetry === false) return;
      stopAiCountdown();
      aiResolvedRef.current = true;
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
      if (aiResolvedRef.current) setIsAiTyping(false);
    }
  }, [character, profile?.telegram_id, startAiCountdown, stopAiCountdown]);

  const handleRetryAi = useCallback(() => {
    if (!pendingRetry) return;
    setAiTimedOut(false);
    const recentMessages = messages.slice(-10).map(m => ({ sender: m.sender, text: m.text }));
    doAiReply(pendingRetry.userMessage, pendingRetry.imageToSend, pendingRetry.replyToMsgId, pendingRetry.responder, recentMessages, true);
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
          if (data.url) { setSelectedImage(data.url); return; }
        } catch (e) {
          console.warn("[Chat] ImgBB upload failed:", e);
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
        setPendingRetry({ userMessage, imageToSend, replyToMsgId: newMsg.id, responder: responders[0], recentMessages });
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

      {/* Header */}
      <Header
        title={
          <div className="flex items-center gap-2">
            <MessageSquare size={20} />
            <span className="truncate max-w-[140px]">{chatTitle}</span>
            {friend && (
              <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${isFriendOnline ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' : 'bg-neutral-600'}`} />
            )}
            {group && (
              <button onClick={() => setShowMembersModal(true)} className="ml-1 p-1 rounded-lg text-neutral-400 hover:text-white">
                <Users size={16} />
              </button>
            )}
          </div>
        }
        backUrl="/friends"
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 relative z-10">
        {messages.length === 0 && (
          <p className="text-center text-neutral-500 py-12 text-sm">Начните общение с {chatTitle}!</p>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.sender === "user" || msg.sender_telegram_id === profile?.telegram_id;
          const repliedMsg = msg.replyTo ? messages.find(m => m.id === msg.replyTo) : null;
          const isRead = !!msg.read_at;
          const showAvatar = !isUser && (i === 0 || messages[i - 1]?.sender !== msg.sender);
          const timeStr = msg.created_at
            ? new Date(msg.created_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })
            : "";

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={`flex ${isUser ? "justify-end" : "justify-start"} items-end gap-2`}
            >
              {/* Incoming avatar */}
              {!isUser && (
                <div className="w-7 h-7 flex-shrink-0 mb-0.5">
                  {showAvatar ? (
                    <img
                      src={getAvatarUrl(msg.sender)}
                      alt="av"
                      className="w-7 h-7 rounded-full object-cover border border-white/10 cursor-pointer shadow-md"
                      onClick={() => setShowProfilePopup(msg.sender)}
                    />
                  ) : null}
                </div>
              )}

              <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[78%]`}>
                {/* Sender name (group only) */}
                {group && !isUser && showAvatar && (
                  <span
                    className="text-[10px] text-neutral-400 mb-1 ml-1 cursor-pointer hover:text-white transition-colors"
                    onClick={() => setShowProfilePopup(msg.sender)}
                  >{msg.sender}</span>
                )}

                <div className="flex items-end gap-1.5 group/msg">
                  {/* Reply button on hover (outgoing) */}
                  {isUser && (
                    <button
                      onClick={() => setReplyToMsg(msg)}
                      className="opacity-0 group-hover/msg:opacity-100 p-1 text-neutral-500 hover:text-white transition-all"
                    >
                      <Reply size={13} />
                    </button>
                  )}

                  {/* Bubble */}
                  <div className={`px-3.5 py-2.5 ${isUser ? "chat-bubble-out" : "chat-bubble-in"}`}>
                    {/* Reply quote */}
                    {repliedMsg && (
                      <div className="chat-reply-quote mb-2 px-2 py-1">
                        <span className="text-[10px] font-semibold opacity-60 block mb-0.5">
                          {repliedMsg.sender === "user" ? character?.name : repliedMsg.sender}
                        </span>
                        <span className="text-xs opacity-70 line-clamp-1">{repliedMsg.text || "Фото"}</span>
                      </div>
                    )}

                    {/* Image */}
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="attachment" className="w-full max-w-[200px] rounded-xl mb-2 object-contain" />
                    )}

                    {/* Text */}
                    {msg.text && (
                      <p className="text-sm leading-relaxed">
                        {msg.text.split(' ').map((word, idx) =>
                          word.startsWith('@')
                            ? <span key={idx} className="text-blue-300 font-semibold">{word} </span>
                            : word + ' '
                        )}
                      </p>
                    )}

                    {/* Time + read status */}
                    <div className={`flex items-center gap-1 mt-1 ${isUser ? "justify-end" : "justify-start"}`}>
                      <span className="text-[10px] opacity-40">{timeStr}</span>
                      {isUser && (
                        isRead
                          ? <CheckCheck size={11} className="opacity-60 text-blue-300" />
                          : <Check size={11} className="opacity-40" />
                      )}
                    </div>
                  </div>

                  {/* Reply button (incoming) */}
                  {!isUser && (
                    <button
                      onClick={() => setReplyToMsg(msg)}
                      className="opacity-0 group-hover/msg:opacity-100 p-1 text-neutral-500 hover:text-white transition-all"
                    >
                      <Reply size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* User avatar */}
              {isUser && (
                <div className="w-7 h-7 flex-shrink-0 mb-0.5">
                  <img
                    src={getAvatarUrl("user")}
                    alt="me"
                    className="w-7 h-7 rounded-full object-cover border border-white/10 cursor-pointer shadow-md"
                    onClick={() => setShowProfilePopup("user")}
                  />
                </div>
              )}
            </motion.div>
          );
        })}

        {/* AI Typing */}
        {isAiTyping && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start items-end gap-2"
          >
            <img src={getAvatarUrl(friend?.name || "ДанИИл")} alt="ai" className="w-7 h-7 rounded-full object-cover border border-white/10" />
            <div className="chat-bubble-typing px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
              {aiCountdown > 0 && (
                <span className="text-[10px] font-mono text-red-400 ml-1 opacity-70">{aiCountdown}с</span>
              )}
            </div>
          </motion.div>
        )}

        {/* AI Timeout */}
        <AnimatePresence>
          {aiTimedOut && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-start"
            >
              <div className="chat-timeout-glass px-4 py-3 max-w-[85%] space-y-2">
                <div className="flex items-center gap-2 text-yellow-400 text-xs font-semibold">
                  <AlertTriangle size={13} />
                  <span>ИИ не отвечает...</span>
                </div>
                <button
                  onClick={handleRetryAi}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-yellow-300 text-xs font-bold bg-yellow-600/20 border border-yellow-600/30 hover:bg-yellow-600/35 transition-all"
                >
                  <RefreshCw size={11} /> Повторить
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={chatEndRef} />
      </div>

      {/* Mentions autocomplete */}
      <AnimatePresence>
        {showMentions && group && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-20 left-4 right-4 z-30 chat-input-glass border border-white/10 rounded-2xl overflow-hidden"
          >
            {group.members
              .filter(m => m.toLowerCase().includes(mentionFilter))
              .map(name => (
                <button
                  key={name}
                  onClick={() => insertMention(name)}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/10 transition-colors text-sm text-white flex items-center gap-2"
                >
                  <img src={getAvatarUrl(name)} alt="" className="w-6 h-6 rounded-full" />
                  @{name}
                </button>
              ))
            }
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="chat-input-glass p-3 relative z-20">
        {/* Reply preview */}
        {replyToMsg && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="chat-reply-glass mb-2 px-3 py-2 flex items-center justify-between"
          >
            <div className="min-w-0">
              <span className="text-[10px] text-red-400 font-semibold block">
                Ответ: {replyToMsg.sender === "user" ? character?.name : replyToMsg.sender}
              </span>
              <span className="text-xs text-neutral-300 line-clamp-1">{replyToMsg.text || "Фото"}</span>
            </div>
            <button onClick={() => setReplyToMsg(null)} className="text-neutral-500 hover:text-white ml-3 flex-shrink-0">
              <X size={14} />
            </button>
          </motion.div>
        )}

        {/* Image preview */}
        {selectedImage && (
          <div className="mb-2 relative inline-block">
            <img src={selectedImage} alt="preview" className="h-16 rounded-xl border border-white/10 object-cover" />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-500 border border-white/20"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Input row */}
        <div className="flex items-center gap-2">
          <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl text-neutral-400 hover:text-white transition-colors flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <ImagePlus size={18} />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={`Написать ${chatTitle}...`}
            className="chat-input-field flex-1 rounded-2xl px-4 py-2.5 text-sm"
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() && !selectedImage}
            className="chat-send-btn p-2.5 rounded-xl flex-shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Members Modal */}
      {showMembersModal && group && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(180deg, rgba(30,30,40,0.95), rgba(20,20,30,0.98))",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex justify-between items-center p-5 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">Участники</h2>
              <button onClick={() => setShowMembersModal(false)} className="text-neutral-500 hover:text-white"><X size={22} /></button>
            </div>
            <div className="max-h-64 overflow-y-auto p-4 space-y-2">
              {friends.filter(f => f.name !== "ДанИИл").map(f => (
                <label key={f.name} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={selectedFriends.includes(f.name)}
                    onChange={() => setSelectedFriends(prev => prev.includes(f.name) ? prev.filter(n => n !== f.name) : [...prev, f.name])}
                    className="accent-red-600 w-4 h-4"
                  />
                  <img src={getAvatarUrl(f.name)} alt="" className="w-8 h-8 rounded-full border border-white/10" />
                  <span className="text-white font-medium text-sm">{f.name}</span>
                  {f.isAiEnabled && <span className="ml-auto text-[10px] text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">ИИ</span>}
                </label>
              ))}
            </div>
            <div className="p-4 border-t border-white/10">
              <button
                onClick={handleUpdateMembers}
                className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all"
                style={{
                  background: "linear-gradient(135deg, rgba(220,38,38,0.8), rgba(190,18,60,0.7))",
                  border: "1px solid rgba(255,120,120,0.3)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 3px 12px rgba(220,38,38,0.3)",
                }}
              >
                Сохранить
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showProfilePopup && (
        <ProfilePopup name={showProfilePopup} onClose={() => setShowProfilePopup(null)} />
      )}
    </motion.div>
  );
}
