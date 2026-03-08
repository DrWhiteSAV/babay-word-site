import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { motion, AnimatePresence } from "motion/react";
import { ShoppingCart, Skull, Loader2, X, Sparkles, Download, ExternalLink, RefreshCw } from "lucide-react";
import CurrencyModal, { CurrencyType } from "../components/CurrencyModal";
import Header from "../components/Header";
import { useTelegram } from "../context/TelegramContext";
import { supabase } from "../integrations/supabase/client";

const SUPABASE_URL = "https://psuvnvqvspqibsezcrny.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzdXZudnF2c3BxaWJzZXpjcm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDI5NTIsImV4cCI6MjA4NzU3ODk1Mn0.VHI6Kefzbz6Hc8TpLI5_JRXAyPJ-y4oeE3Bkh16jFRU";

const GENERATION_TIMEOUT_SEC = 120;

/**
 * Generates new avatar via ProTalk → saves to gallery (ImgBB + DB + Telegram DM).
 * Returns the final imgbb URL. The save-to-gallery EF handles:
 * - ImgBB upload, gallery DB insert (label=[avatars]), player_stats avatar_url update, Telegram photo send.
 */
async function generateAndSaveAvatar(
  character: any,
  allOwnedItems: string[],
  newItemName: string,
  telegramId: number,
): Promise<string | null> {
  const genderDesc = character.gender === "Бабайка" ? "женский" : "мужской";
  const wishesStr = (character.wishes || []).join(", ") || "обычная внешность";
  const loreSnippet = character.lore ? ` Лор: ${character.lore.substring(0, 150)}.` : "";
  const prompt = `Нарисуй обновлённый горизонтальный портрет славянского духа по имени ${character.name} (пол: ${genderDesc}). Стиль: ${character.style}. Особые приметы: ${wishesStr}.${loreSnippet} Ранее купленные предметы: ${allOwnedItems.slice(0, -1).join(", ") || "нет"}. НОВЫЙ предмет: ${newItemName} — должен быть заметно виден. Горизонтальная ориентация (landscape, 16:9). Высокое качество. Тёмный фон.`;

  // Step 1: Generate via ProTalk
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/protalk-ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ type: "image", prompt, telegramId }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const rawUrl = data.imageUrl;
  if (!rawUrl || !rawUrl.startsWith("http")) return null;

  // Step 2: save-to-gallery EF — uploads to ImgBB, inserts gallery row as [avatars],
  //          updates player_stats avatar_url, sends Telegram DM photo
  const galResp = await fetch(`${SUPABASE_URL}/functions/v1/save-to-gallery`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({
      imageUrl: rawUrl,
      telegramId,
      label: `[avatars] ${character.name}`,
      characterName: character.name,
      lore: character.lore || null,
      wishes: character.wishes || [],
      style: character.style || null,
      gender: character.gender || null,
      prompt,
    }),
  });

  if (!galResp.ok) return rawUrl;

  const galData = await galResp.json();
  const finalUrl = galData.gallery_item?.image_url || galData.storage_url;
  return finalUrl && finalUrl.startsWith("http") ? finalUrl : rawUrl;
}

export default function Shop() {
  const navigate = useNavigate();
  const location = useLocation();
  const { fear, watermelons, inventory, buyItem, upgradeTelekinesis, upgradeBossLevel, bossLevel, character, updateCharacter, settings, shopItems, bossItems, storeConfig } =
    usePlayerStore();
  const { profile } = useTelegram();
  const [isProcessing, setIsProcessing] = useState(false);
  const [infoModal, setInfoModal] = useState<{type: CurrencyType, y: number} | null>(null);
  const [selectedItem, setSelectedItem] = useState<{item: any, y: number} | null>(null);
  const [warningModal, setWarningModal] = useState<{ item: any, deficit: number, y: number } | null>(null);
  const [successEffect, setSuccessEffect] = useState<string | null>(null);

  // Avatar evolution popup
  const [avatarEvolvePopup, setAvatarEvolvePopup] = useState<{
    oldAvatar: string;
    newAvatar: string | null;
    isGenerating: boolean;
    itemName: string;
    progress: string;
    pendingItem: any | null; // kept for retry
    pendingInventory: string[];
  } | null>(null);

  // 120s countdown timer
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = () => {
    setCountdown(GENERATION_TIMEOUT_SEC);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(0);
  };

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const playSuccessSound = () => {
    try {
      const audio = new Audio("https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg");
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {}
  };

  const runAvatarGeneration = useCallback(async (item: any, allOwnedItems: string[]) => {
    if (!character || !profile?.telegram_id) return;

    setAvatarEvolvePopup(prev => prev ? { ...prev, isGenerating: true, progress: "Отправляю запрос к нейросети...", newAvatar: null } : null);
    startCountdown();

    try {
      const imgbbUrl = await generateAndSaveAvatar(
        character,
        allOwnedItems,
        item.name,
        profile.telegram_id,
      );

      stopCountdown();

      if (imgbbUrl) {
        // Update store + DB (save-to-gallery already updated DB, but sync store)
        updateCharacter({ avatarUrl: imgbbUrl });
        setAvatarEvolvePopup(prev => prev ? { ...prev, newAvatar: imgbbUrl, isGenerating: false, progress: "Готово!" } : null);
      } else {
        setAvatarEvolvePopup(prev => prev ? { ...prev, isGenerating: false, progress: "ИИ не вернул картинку" } : null);
      }
    } catch (e) {
      stopCountdown();
      console.error("[Shop] Avatar evolution error:", e);
      setAvatarEvolvePopup(prev => prev ? { ...prev, isGenerating: false, progress: "Ошибка генерации" } : null);
    }
  }, [character, profile]);

  const handleBuy = async (item: any) => {
    if (inventory.includes(item.id)) {
      alert("Уже куплено!");
      return;
    }

    if (item.currency === "watermelons" && watermelons < item.cost) {
      setWarningModal({ item, deficit: item.cost - watermelons, y: window.innerHeight / 2 });
      return;
    } else if (item.currency === "fear" && fear < item.cost) {
      setWarningModal({ item, deficit: item.cost - fear, y: window.innerHeight / 2 });
      return;
    }

    setIsProcessing(true);

    const success = buyItem(item.id, item.cost, item.currency);
    if (success && character && profile?.telegram_id) {
      // Save purchase to player_inventory immediately (before avatar generation)
      supabase.from("player_inventory").insert({
        telegram_id: profile.telegram_id,
        item_id: item.id,
      } as any).then(({ error }) => {
        if (error) console.warn("[Shop] inventory insert error:", error.message);
        else console.log("[Shop] ✅ item saved to player_inventory:", item.id);
      });
      playSuccessSound();
      setSuccessEffect(item.id);
      setTimeout(() => setSuccessEffect(null), 2000);
      setSelectedItem(null);

      const allOwnedItems = [...inventory, item.id]
        .map(id => [...shopItems, ...bossItems].find(i => i.id === id)?.name)
        .filter(Boolean) as string[];

      setAvatarEvolvePopup({
        oldAvatar: character.avatarUrl,
        newAvatar: null,
        isGenerating: true,
        itemName: item.name,
        progress: "Генерирую образ...",
        pendingItem: item,
        pendingInventory: allOwnedItems,
      });

      await runAvatarGeneration(item, allOwnedItems);
    }

    setIsProcessing(false);
  };

  const handleUpgrade = (e: React.MouseEvent) => {
    if (!character) return;
    const cost = storeConfig.telekinesisBaseCost * Math.pow(storeConfig.telekinesisCostMultiplier, character.telekinesisLevel - 1);
    if (fear < cost) {
      setWarningModal({ item: { name: "Телекинез", currency: "fear" }, deficit: cost - fear, y: e.clientY });
      return;
    }
    if (upgradeTelekinesis(cost)) {
      playSuccessSound();
      setSuccessEffect("telekinesis");
      setTimeout(() => setSuccessEffect(null), 2000);
    }
  };

  const handleUpgradeBoss = (e: React.MouseEvent) => {
    const cost = storeConfig.bossBaseCost * Math.pow(storeConfig.bossCostMultiplier, bossLevel - 1);
    if (watermelons < cost) {
      setWarningModal({ item: { name: "Усиление Босса", currency: "watermelons" }, deficit: cost - watermelons, y: e.clientY });
      return;
    }
    if (upgradeBossLevel(cost)) {
      playSuccessSound();
      setSuccessEffect("boss_level");
      setTimeout(() => setSuccessEffect(null), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col text-neutral-200 relative overflow-hidden"
    >
      <div className="fog-container">
        <div className="fog-layer"></div>
        <div className="fog-layer-2"></div>
      </div>

      <Header
        title={<><ShoppingCart size={20} /> Магазин</>}
        backUrl="/hub"
        onInfoClick={(type, e) => setInfoModal({type, y: e?.clientY || window.innerHeight / 2})}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-24">
        <div className="flex justify-center mb-6">
          <img src="https://i.ibb.co/pvJ73kxN/babai2.png" alt="Shop Logo" className="w-48 drop-shadow-[0_0_15px_rgba(220,38,38,0.4)]" />
        </div>

        {/* Upgrades */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-b border-neutral-800 pb-2">Способности и Улучшения</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={(e) => setSelectedItem({ item: { id: "telekinesis", name: "Телекинез", type: "Способность", icon: "🧠", description: `Увеличивает количество страха за правильные ответы. Бонус: +${character ? (character.telekinesisLevel - 1) * storeConfig.telekinesisRewardBonus : 0} страха.`, cost: storeConfig.telekinesisBaseCost * Math.pow(storeConfig.telekinesisCostMultiplier, (character?.telekinesisLevel || 1) - 1), currency: "fear", isUpgrade: true, action: handleUpgrade }, y: e.clientY })}
              className="bg-neutral-900 border border-neutral-800 hover:border-neutral-600 rounded-2xl p-4 flex flex-col items-center text-center gap-3 transition-colors cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-purple-900/30 flex items-center justify-center text-3xl border border-purple-500/30">🧠</div>
              <div className="flex-1">
                <h3 className="font-bold text-white leading-tight">Телекинез</h3>
                <p className="text-[10px] text-neutral-500 uppercase mt-1">Уровень: {character?.telekinesisLevel}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleUpgrade(e); }}
                className={`w-full py-2 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1 relative overflow-hidden ${successEffect === "telekinesis" ? "bg-green-500 text-white scale-105" : character && fear >= storeConfig.telekinesisBaseCost * Math.pow(storeConfig.telekinesisCostMultiplier, character.telekinesisLevel - 1) ? "bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50" : "bg-neutral-800 text-white border border-neutral-700"}`}
              >
                <Skull size={14} /> {character ? Math.floor(storeConfig.telekinesisBaseCost * Math.pow(storeConfig.telekinesisCostMultiplier, character.telekinesisLevel - 1)) : 0}
              </button>
            </div>

            <div
              onClick={(e) => setSelectedItem({ item: { id: "boss_level", name: "Усиление Босса", type: "Улучшение", icon: "👹", description: `Увеличивает здоровье босса и награду. Текущая награда: ${Math.floor(storeConfig.bossRewardBase * Math.pow(storeConfig.bossRewardMultiplier, bossLevel - 1))} арбузов.`, cost: storeConfig.bossBaseCost * Math.pow(storeConfig.bossCostMultiplier, bossLevel - 1), currency: "watermelons", isUpgrade: true, action: handleUpgradeBoss }, y: e.clientY })}
              className="bg-neutral-900 border border-neutral-800 hover:border-neutral-600 rounded-2xl p-4 flex flex-col items-center text-center gap-3 transition-colors cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-green-900/30 flex items-center justify-center text-3xl border border-green-500/30">👹</div>
              <div className="flex-1">
                <h3 className="font-bold text-white leading-tight">Усиление Босса</h3>
                <p className="text-[10px] text-neutral-500 uppercase mt-1">Уровень: {bossLevel}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleUpgradeBoss(e); }}
                className={`w-full py-2 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1 ${successEffect === "boss_level" ? "bg-green-500 text-white scale-105" : watermelons >= storeConfig.bossBaseCost * Math.pow(storeConfig.bossCostMultiplier, bossLevel - 1) ? "bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-900/50" : "bg-neutral-800 text-white border border-neutral-700"}`}
              >
                🍉 {Math.floor(storeConfig.bossBaseCost * Math.pow(storeConfig.bossCostMultiplier, bossLevel - 1))}
              </button>
            </div>
          </div>
        </section>

        {/* Items */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-b border-neutral-800 pb-2">Товары за Страх</h2>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
            {shopItems.map((item) => {
              const isOwned = inventory.includes(item.id);
              return (
                <div key={item.id} onClick={(e) => setSelectedItem({item, y: e.clientY})} className={`bg-neutral-900 border ${isOwned ? "border-green-900/50 opacity-70" : "border-neutral-800 hover:border-neutral-600"} rounded-2xl p-4 flex flex-col items-center text-center gap-3 transition-colors cursor-pointer`}>
                  <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center text-3xl shadow-inner relative">
                    {item.icon}
                    {successEffect === item.id && <motion.div initial={{ scale: 0, opacity: 1 }} animate={{ scale: 2, opacity: 0 }} transition={{ duration: 0.5 }} className="absolute inset-0 bg-green-500 rounded-2xl" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white leading-tight">{item.name}</h3>
                    <p className="text-[10px] text-neutral-500 uppercase mt-1">{item.type}</p>
                  </div>
                  <button
                    disabled={isOwned || isProcessing}
                    onClick={(e) => { e.stopPropagation(); handleBuy(item); }}
                    className={`w-full py-2 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-1 ${isOwned ? "bg-green-900/20 text-green-500 border border-green-900/30" : fear >= item.cost ? "bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50" : "bg-neutral-800 text-white border border-neutral-700"}`}
                  >
                    {isOwned ? "Куплено" : isProcessing ? <Loader2 size={14} className="animate-spin" /> : <><Skull size={14} /> {item.cost}</>}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Boss Items */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-b border-neutral-800 pb-2">Экипировка для Боссов</h2>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
            {bossItems.map((item) => {
              const isOwned = inventory.includes(item.id);
              return (
                <div key={item.id} onClick={(e) => setSelectedItem({item, y: e.clientY})} className={`bg-neutral-900 border ${isOwned ? "border-green-900/50 opacity-70" : "border-neutral-800 hover:border-neutral-600"} rounded-2xl p-4 flex flex-col items-center text-center gap-3 transition-colors cursor-pointer`}>
                  <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center text-3xl shadow-inner relative">
                    {item.icon}
                    {successEffect === item.id && <motion.div initial={{ scale: 0, opacity: 1 }} animate={{ scale: 2, opacity: 0 }} transition={{ duration: 0.5 }} className="absolute inset-0 bg-green-500 rounded-2xl" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white leading-tight">{item.name}</h3>
                    <p className="text-[10px] text-neutral-500 uppercase mt-1">{item.type}</p>
                  </div>
                  <button
                    disabled={isOwned || isProcessing}
                    onClick={(e) => { e.stopPropagation(); handleBuy(item); }}
                    className={`w-full py-2 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-1 ${isOwned ? "bg-green-900/20 text-green-500 border border-green-900/30" : watermelons >= item.cost ? "bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-900/50" : "bg-neutral-800 text-white border border-neutral-700"}`}
                  >
                    {isOwned ? "Куплено" : isProcessing ? <Loader2 size={14} className="animate-spin" /> : <>🍉 {item.cost}</>}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <CurrencyModal type={infoModal?.type || null} clickY={infoModal?.y} onClose={() => setInfoModal(null)} />

      {/* Item detail modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedItem(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }}
              animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
              exit={{ opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }}
              onClick={(e) => e.stopPropagation()}
              className="fixed bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-sm w-[90%] shadow-2xl"
              style={{ top: "50%", left: "50%" }}
            >
              <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 text-neutral-400 hover:text-white p-2 bg-neutral-800 rounded-full transition-colors"><X size={20} /></button>
              <div className="text-center mb-4">
                <div className="text-5xl mb-3">{selectedItem.item.icon}</div>
                <h3 className="text-xl font-black text-white">{selectedItem.item.name}</h3>
                <p className="text-xs text-neutral-500 uppercase tracking-wider mt-1">{selectedItem.item.type}</p>
              </div>
              <p className="text-sm text-neutral-400 mb-6 text-center leading-relaxed">{selectedItem.item.description}</p>
              <button
                onClick={() => {
                  if (selectedItem.item.isUpgrade && selectedItem.item.action) {
                    selectedItem.item.action({ clientY: selectedItem.y } as React.MouseEvent);
                    setSelectedItem(null);
                  } else {
                    handleBuy(selectedItem.item);
                  }
                }}
                disabled={inventory.includes(selectedItem.item.id) || isProcessing}
                className="w-full py-3 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {inventory.includes(selectedItem.item.id) ? "Уже куплено" : isProcessing ? <><Loader2 size={16} className="animate-spin" /> Обработка...</> : <>Купить за {selectedItem.item.currency === "watermelons" ? "🍉" : <Skull size={16} />} {Math.floor(selectedItem.item.cost)}</>}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Warning modal */}
      <AnimatePresence>
        {warningModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setWarningModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-neutral-900 border border-red-900/50 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-lg font-black text-red-500 mb-2">Недостаточно ресурсов</h3>
              <p className="text-sm text-neutral-400 mb-4">
                Для покупки «{warningModal.item.name}» не хватает{" "}
                <span className="font-bold text-white">{Math.ceil(warningModal.deficit)}</span>{" "}
                {warningModal.item.currency === "watermelons" ? "🍉 арбузов" : "💀 страха"}.
              </p>
              <button onClick={() => setWarningModal(null)} className="w-full py-3 bg-neutral-800 text-white rounded-xl font-bold">Понятно</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Avatar Evolution Popup — fullscreen with countdown timer and retry */}
      <AnimatePresence>
        {avatarEvolvePopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 shop-evolve-popup"
          >
            <h3 className="text-lg font-black text-purple-400 mb-2 flex items-center gap-2 shop-evolve-title">
              <Sparkles size={20} /> Эволюция аватара: {avatarEvolvePopup.itemName}
            </h3>
            <p className={`text-xs mb-4 ${avatarEvolvePopup.isGenerating ? "text-neutral-500 animate-pulse" : avatarEvolvePopup.newAvatar ? "text-green-400" : "text-red-400"}`}>
              {avatarEvolvePopup.progress}
            </p>

            {avatarEvolvePopup.isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-6">
                {/* Circular countdown */}
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(168,85,247,0.15)" strokeWidth="8" className="shop-evolve-ring-bg" />
                    <circle
                      cx="50" cy="50" r="44"
                      fill="none" stroke="rgba(168,85,247,0.8)" strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 44}`}
                      strokeDashoffset={`${2 * Math.PI * 44 * (1 - countdown / GENERATION_TIMEOUT_SEC)}`}
                      strokeLinecap="round"
                      className="transition-all duration-1000 shop-evolve-ring-stroke"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-purple-300 shop-evolve-timer">{countdown}</span>
                    <span className="text-xs text-neutral-500">сек</span>
                  </div>
                </div>
                <p className="text-neutral-400 text-sm text-center">Нейросеть рисует новый образ...</p>
              </div>
            ) : avatarEvolvePopup.newAvatar ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full">
                <img
                  src={avatarEvolvePopup.newAvatar}
                  alt="Новый аватар"
                  className="max-w-full max-h-[60vh] rounded-2xl shadow-[0_0_40px_rgba(168,85,247,0.5)] border-2 border-purple-500 object-contain"
                />
                <div className="flex gap-3 flex-wrap justify-center">
                  <a
                    href={avatarEvolvePopup.newAvatar}
                    download={`babai_avatar_${Date.now()}.jpg`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-purple-800 hover:bg-purple-700 text-white rounded-full text-sm font-bold"
                  >
                    <Download size={16} /> Скачать
                  </a>
                  <a
                    href={avatarEvolvePopup.newAvatar}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full text-sm font-bold"
                  >
                    <ExternalLink size={16} /> Открыть
                  </a>
                </div>
              </div>
            ) : (
              /* Failed state */
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <p className="text-neutral-500 text-sm text-center">ИИ не вернул картинку или случилась ошибка</p>
                {avatarEvolvePopup.pendingItem && (
                  <button
                    onClick={() => {
                      if (avatarEvolvePopup.pendingItem) {
                        runAvatarGeneration(avatarEvolvePopup.pendingItem, avatarEvolvePopup.pendingInventory);
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-3 bg-orange-700 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-colors"
                  >
                    <RefreshCw size={16} /> ИИ тупит, давай ещё раз?
                  </button>
                )}
              </div>
            )}

            {!avatarEvolvePopup.isGenerating && (
              <button
                onClick={() => setAvatarEvolvePopup(null)}
                className="mt-4 w-full max-w-sm py-3 bg-purple-800 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors"
              >
                {avatarEvolvePopup.newAvatar ? "Отлично!" : "Закрыть"}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
