import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { motion, AnimatePresence } from "motion/react";
import { User, Copy, Share2, Trophy, Camera, BookOpen, Loader2, Image as ImageIcon, Volume2, VolumeX, X, ShieldAlert, ExternalLink, MessageCircle, Users } from "lucide-react";
import * as htmlToImage from 'html-to-image';
import { generateLore } from "../services/geminiService";
import CurrencyModal, { CurrencyType } from "../components/CurrencyModal";
import Header from "../components/Header";
import { transliterate } from "../utils/transliterate";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";

const ROLE_COLORS: Record<string, string> = {
  "Супер-Бабай": "text-red-400 bg-red-900/20 border-red-800",
  "Ад-Бабай": "text-orange-400 bg-orange-900/20 border-orange-800",
  "Бабай": "text-neutral-300 bg-neutral-800/50 border-neutral-700",
};

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { character, fear, energy, watermelons, inventory, updateCharacter, gallery, addToGallery, settings, updateSettings, globalBackgroundUrl, pageBackgrounds, shopItems, bossItems } = usePlayerStore();
  const { profile } = useTelegram();
  const profileRef = useRef<HTMLDivElement>(null);
  const [isGeneratingLore, setIsGeneratingLore] = useState(false);
  const [infoModal, setInfoModal] = useState<CurrencyType>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [referralFriends, setReferralFriends] = useState<Array<{first_name: string; username: string | null; telegram_id: number}>>([]);
  const [showReferralPopup, setShowReferralPopup] = useState(false);
  const [invitedByProfile, setInvitedByProfile] = useState<{first_name: string; username: string | null} | null>(null);

  useEffect(() => {
    if (character && !character.lore && !isGeneratingLore) {
      generateCharacterLore();
    }
  }, [character]);

  // Ensure avatar is in gallery
  useEffect(() => {
    if (character?.avatarUrl && !gallery.includes(character.avatarUrl)) {
      addToGallery(character.avatarUrl);
    }
  }, [character?.avatarUrl]);

  // Load referral stats
  useEffect(() => {
    if (!profile) return;
    const loadReferrals = async () => {
      // Referrals are tracked by telegram_id (the referral_code field contains the inviter's telegram_id)
      const myTgIdStr = String(profile.telegram_id);
      const { data } = await supabase
        .from("profiles")
        .select("first_name, username, telegram_id")
        .eq("referral_code", myTgIdStr);
      if (data) {
        setReferralCount(data.length);
        setReferralFriends(data);
      }
      // Load who invited the current user: referral_code stores inviter's telegram_id
      if (profile.referral_code && /^\d+$/.test(profile.referral_code)) {
        const inviterTgId = parseInt(profile.referral_code, 10);
        const [{ data: inviterStats }, { data: inviterProf }] = await Promise.all([
          supabase.from("player_stats").select("character_name").eq("telegram_id", inviterTgId).single(),
          supabase.from("profiles").select("first_name, username").eq("telegram_id", inviterTgId).single(),
        ]);
        if (inviterProf) {
          setInvitedByProfile({
            first_name: inviterStats?.character_name || inviterProf.first_name,
            username: inviterProf.username,
          });
        }
      } else if (profile.referral_code) {
        // Legacy: referral_code was the babay name (transliterated) — keep backwards compat
        setInvitedByProfile({ first_name: profile.referral_code, username: null });
      }
    };
    loadReferrals();
  }, [profile]);

  // Wait for DB to load before redirecting — character is null until loadStats completes
  const { dbLoaded } = usePlayerStore();

  useEffect(() => {
    if (dbLoaded && !character) {
      navigate("/");
    }
  }, [dbLoaded, character]);

  if (!dbLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-500">
        <Loader2 size={28} className="animate-spin text-red-700" />
        <span className="text-sm">Загрузка профиля...</span>
      </div>
    );
  }

  if (!character) {
    return null;
  }

  const generateCharacterLore = async () => {
    setIsGeneratingLore(true);
    const lore = await generateLore(character.name, character.gender, character.style);
    updateCharacter({ lore });
    setIsGeneratingLore(false);
  };

  const referralLink = `https://t.me/Bab_AIbot/app?startapp=${profile?.telegram_id || ""}`;


  const inviteText = character
    ? `👻 Привет! Я — ${character.name}, бессмертный кибер-дух Бабай!\n\n🔥 Приглашаю тебя в игру «Бабай» — стань своим Бабаем, пугай жильцов и собирай арбузы!\n\n👇 Жми сюда:\n${referralLink}`
    : referralLink;

  const handleCopyRef = () => {
    navigator.clipboard.writeText(inviteText);
    alert("Приглашение скопировано!");
  };

  const takeScreenshot = async () => {
    if (profileRef.current) {
      try {
        const dataUrl = await htmlToImage.toPng(profileRef.current, {
          backgroundColor: '#0a0a0a',
          pixelRatio: 2,
        });
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `babai_${character.name}.png`;
        link.click();
      } catch (e) {
        console.error("Screenshot failed", e);
        alert("Не удалось сделать скриншот");
      }
    }
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
        title={<><User size={20} /> Профиль</>}
        backUrl="/hub"
        onInfoClick={(type, e) => setInfoModal(type)}
        rightContent={
          <div className="flex gap-4">
            {(profile?.role === "Супер-Бабай" || profile?.role === "Ад-Бабай") && (
              <div
                role="button"
                onClick={() => navigate("/admin")}
                className="p-2 cursor-pointer hover:bg-neutral-800 rounded-full transition-colors text-red-500"
                title="Админ-панель"
                style={{ clipPath: 'none' }}
              >
                <ShieldAlert size={20} />
              </div>
            )}
            {profile?.role === "Супер-Бабай" && (
            <div
              role="button"
              onClick={() => updateSettings({ ttsEnabled: !settings.ttsEnabled })}
              className={`p-2 rounded-full cursor-pointer transition-colors ${settings.ttsEnabled ? 'text-green-500 hover:bg-neutral-800' : 'text-neutral-500 hover:bg-neutral-800'}`}
              title={settings.ttsEnabled ? "Озвучка включена" : "Озвучка выключена"}
              style={{ clipPath: 'none' }}
            >
              {settings.ttsEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </div>
            )}
            <div
              role="button"
              onClick={() => navigate("/gallery")}
              className="p-2 cursor-pointer hover:bg-neutral-800 rounded-full transition-colors text-neutral-400"
              title="Галерея"
              style={{ clipPath: 'none' }}
            >
              <ImageIcon size={20} />
            </div>
            <div
              role="button"
              onClick={takeScreenshot}
              className="p-2 cursor-pointer hover:bg-neutral-800 rounded-full transition-colors text-red-500"
              title="Сделать скриншот"
              style={{ clipPath: 'none' }}
            >
              <Camera size={20} />
            </div>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-8" ref={profileRef}>
        {/* Telegram Profile Block */}
        {profile && (
          <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <div className="flex items-center gap-4">
              {profile.photo_url ? (
                <img
                  src={profile.photo_url}
                  alt={profile.first_name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-neutral-700 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-neutral-800 border-2 border-neutral-700 flex items-center justify-center shrink-0">
                  <MessageCircle size={24} className="text-neutral-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-base">
                    {profile.first_name}{profile.last_name ? ` ${profile.last_name}` : ""}
                  </span>
                  {profile.role && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_COLORS[profile.role] || ROLE_COLORS["Бабай"]}`}>
                      {profile.role}
                    </span>
                  )}
                </div>
                {profile.username && (
                  <p className="text-neutral-400 text-sm">@{profile.username}</p>
                )}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-[10px] text-neutral-600 font-mono">ID: {profile.telegram_id}</span>
                  {profile.profile_url && (
                    <a
                      href={profile.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink size={10} /> Telegram
                    </a>
                  )}
                </div>
                {profile.referral_code && (
                  <p className="text-[10px] text-neutral-500 mt-1">
                    👥 Пришёл по ссылке Бабая: <span className="text-neutral-300 font-mono">
                      {invitedByProfile ? `${invitedByProfile.first_name}${invitedByProfile.username ? ` @${invitedByProfile.username}` : ""}` : profile.referral_code}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Avatar & Info — hub-style horizontal card */}
        <section className="bg-neutral-900/70 backdrop-blur-sm border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="relative w-full aspect-[16/9] md:w-1/2 md:mx-auto">
            <img
              src={character.avatarUrl}
              alt={character.name}
              className="absolute inset-0 w-full h-full object-cover"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
            <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(220,38,38,0.25)] pointer-events-none" />
          </div>
          <div className="px-5 py-4 text-center">
            <h2
              className="text-3xl font-black text-white uppercase tracking-wider"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {character.name}
            </h2>
            <p className="text-red-500 text-sm mt-1 uppercase tracking-widest">
              {character.gender} • {character.style}
            </p>
            <div className="flex gap-2 mt-4 flex-wrap justify-center">
              {character.wishes.map((w, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-full text-xs text-neutral-400"
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-4">
          <div 
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-neutral-600 transition-colors"
            onClick={() => setInfoModal('fear')}
          >
            <span className="text-3xl font-black text-white">{fear}</span>
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">
              Страх
            </span>
          </div>
          <div 
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-neutral-600 transition-colors"
            onClick={() => setInfoModal('energy')}
          >
            <span className="text-3xl font-black text-white">{energy}</span>
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">
              Энергия
            </span>
          </div>
          <div 
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-neutral-600 transition-colors"
            onClick={() => setInfoModal('watermelons')}
          >
            <span className="text-3xl font-black text-white">{watermelons}</span>
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">
              Арбузы
            </span>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col items-center justify-center col-span-3">
            <span className="text-3xl font-black text-white">
              {character.telekinesisLevel}
            </span>
            <span className="text-xs text-neutral-500 uppercase tracking-widest mt-1">
              Уровень Телекинеза
            </span>
          </div>
        </section>

        {/* Gallery Link */}
        <section
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:border-neutral-600 transition-colors"
          onClick={() => navigate("/gallery")}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-red-500">
              <ImageIcon size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Галерея</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Аватары, фоны и боссы</p>
            </div>
          </div>
          <span className="text-xs text-red-500 font-bold">ОТКРЫТЬ →</span>
        </section>

        {/* Lore */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-b border-neutral-800 pb-2 flex items-center justify-between">
            <span className="flex items-center gap-2"><BookOpen size={18} /> История духа</span>
            {isGeneratingLore && <Loader2 size={16} className="animate-spin text-red-500" />}
          </h3>
          <div className="text-sm text-neutral-400 leading-relaxed font-serif italic space-y-3">
            {character.lore ? (
              character.lore.split('\n').map((paragraph, i) => (
                paragraph.trim() && <p key={i}>{paragraph}</p>
              ))
            ) : isGeneratingLore ? (
              <p className="animate-pulse">Дух вспоминает свое прошлое...</p>
            ) : (
              <p>История утеряна во мраке веков.</p>
            )}
          </div>
        </section>

        {/* Inventory — only show purchased items */}
        <section>
          <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-b border-neutral-800 pb-2 flex items-center gap-2">
            <Trophy size={18} /> Инвентарь ({inventory.length}/{shopItems.length + bossItems.length})
          </h3>
          {inventory.length === 0 ? (
            <p className="text-center text-neutral-500 py-6 text-sm">Нет купленных предметов</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[...shopItems, ...bossItems]
                .filter(item => inventory.includes(item.id))
                .map((item, i) => (
                  <motion.div
                    layout
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    key={item.id}
                    onClick={(e) => setSelectedItem({item, y: e.clientY})}
                    className="bg-neutral-900 border border-neutral-600 hover:border-red-500 rounded-xl p-3 flex flex-col items-center text-center gap-2 transition-colors cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl bg-neutral-800 flex items-center justify-center text-2xl">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-white line-clamp-1">{item.name}</h4>
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{item.type}</p>
                    </div>
                  </motion.div>
                ))}
            </div>
          )}
        </section>

        {/* Referral */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Share2 size={18} /> Пригласи друга
          </h3>

          {/* Bonus breakdown */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3">
              <div className="text-2xl font-black text-yellow-400">+{100 * Math.max(1, character.telekinesisLevel)}</div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">⚡ Энергии</div>
            </div>
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3">
              <div className="text-2xl font-black text-red-400">+{100 * Math.max(1, character.telekinesisLevel)}</div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">👻 Страха</div>
            </div>
          </div>
          {character.telekinesisLevel > 1 && (
            <p className="text-[11px] text-purple-400 text-center">✨ Твой телекинез ×{character.telekinesisLevel} умножает вознаграждение!</p>
          )}

          {/* Who invited me */}
          {profile?.referral_code && (
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-400 flex items-center gap-2">
              👤 Вас пригласил: <span className="text-neutral-200 font-bold">@{profile.referral_code}</span>
            </div>
          )}

          {/* Referral counter */}
          <button
            onClick={() => setShowReferralPopup(true)}
            className="w-full flex items-center justify-between bg-neutral-950 border border-neutral-800 hover:border-red-900/50 rounded-xl px-3 py-3 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm text-neutral-300">
              <Users size={16} className="text-red-500" /> Пришло по ссылке
            </span>
            <span className="font-black text-white text-lg">{referralCount}</span>
          </button>

          {/* Beautiful invite text */}
          <div className="bg-neutral-950 border border-neutral-700 rounded-xl p-4 text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap font-mono">
            {`👻 Привет! Я — ${character.name}, бессмертный дух Бабай!\n\n🔥 Приглашаю тебя в игру «Bab-AI» — создай своего Бабая, пугай жильцов и собирай арбузы!\n\n⚡ Зайди по моей ссылке и получи бонус: +100 страха и +100 энергии!\n\n👇 Жми сюда:\n${referralLink}`}
          </div>
          <button
            onClick={handleCopyRef}
            className="w-full py-3 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Copy size={16} /> Скопировать приглашение
          </button>
        </section>
      </div>

      <CurrencyModal type={infoModal} onClose={() => setInfoModal(null)} />

      {/* Referral Friends Popup */}
      <AnimatePresence>
        {showReferralPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowReferralPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-sm w-full max-h-[70vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Users size={18} className="text-red-500" /> Приглашённые ({referralCount})
                </h2>
                <button onClick={() => setShowReferralPopup(false)} className="text-neutral-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="overflow-y-auto space-y-2 flex-1">
                {referralFriends.length === 0 ? (
                  <p className="text-neutral-500 text-sm text-center py-4">Пока никто не пришёл по вашей ссылке</p>
                ) : referralFriends.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-sm font-bold text-red-400">
                      {f.first_name[0]}
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold">{f.first_name}</p>
                      {f.username && <p className="text-neutral-500 text-xs">@{f.username}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Item Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedItem(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center mt-4">
              <div className="w-24 h-24 rounded-3xl bg-neutral-800 flex items-center justify-center text-5xl mb-4 shadow-inner">
                {selectedItem.item.icon}
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-1 break-words">
                {selectedItem.item.name}
              </h3>
              <p className="text-xs text-neutral-500 uppercase tracking-widest mb-4">
                {selectedItem.item.type}
              </p>
              <p className="text-neutral-300 text-sm leading-relaxed break-words">
                {selectedItem.item.description}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
