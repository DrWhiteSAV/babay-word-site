import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { motion, AnimatePresence } from "motion/react";
import { ShoppingCart, ArrowLeft, Skull, Zap, Loader2, X, Sparkles } from "lucide-react";
import { editAvatarWithItem } from "../services/geminiService";
import CurrencyModal, { CurrencyType } from "../components/CurrencyModal";
import Header from "../components/Header";

export default function Shop() {
  const navigate = useNavigate();
  const location = useLocation();
  const { fear, watermelons, inventory, buyItem, upgradeTelekinesis, upgradeBossLevel, bossLevel, character, updateCharacter, addToGallery, settings, shopItems, bossItems, storeConfig } =
    usePlayerStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [infoModal, setInfoModal] = useState<{type: CurrencyType, y: number} | null>(null);
  const [selectedItem, setSelectedItem] = useState<{item: any, y: number} | null>(null);
  const [warningModal, setWarningModal] = useState<{ item: any, deficit: number, y: number } | null>(null);
  const [successEffect, setSuccessEffect] = useState<string | null>(null);

  const playSuccessSound = () => {
    const hasInteracted = (navigator as any).userActivation ? (navigator as any).userActivation.hasBeenActive : true;
    if (!hasInteracted) return;
    const audio = new Audio("https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg");
    audio.volume = 0.5;
    audio.play().catch(e => console.log("Audio play failed:", e));
  };

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
    
    // Save current to gallery before changing
    if (character?.avatarUrl) {
      addToGallery(character.avatarUrl);
    }

    const success = buyItem(item.id, item.cost, item.currency);
    if (success && character) {
      playSuccessSound();
      setSuccessEffect(item.id);
      setTimeout(() => setSuccessEffect(null), 2000);

      // Edit avatar
      const allOwnedItems = [...inventory, item.id]
        .map(id => [...shopItems, ...bossItems].find(i => i.id === id)?.name)
        .filter(Boolean) as string[];
      
      const newAvatar = await editAvatarWithItem(character.avatarUrl, character, allOwnedItems, item.name);
      updateCharacter({ avatarUrl: newAvatar });
    }
    
    setIsProcessing(false);
  };

  const handleUpgrade = (e: React.MouseEvent) => {
    if (!character) return;
    const cost = storeConfig.telekinesisBaseCost * Math.pow(storeConfig.telekinesisCostMultiplier, character.telekinesisLevel - 1);
    if (fear < cost) {
      setWarningModal({ 
        item: { name: "Телекинез", currency: "fear" }, 
        deficit: cost - fear,
        y: e.clientY
      });
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
      setWarningModal({ 
        item: { name: "Усиление Босса", currency: "watermelons" }, 
        deficit: cost - watermelons,
        y: e.clientY
      });
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
        {/* Shop Logo */}
        <div className="flex justify-center mb-6">
          <img 
            src="https://i.ibb.co/pvJ73kxN/babai2.png" 
            alt="Shop Logo" 
            className="w-48 drop-shadow-[0_0_15px_rgba(220,38,38,0.4)]"
          />
        </div>

        {/* Upgrades */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-b border-neutral-800 pb-2">
            Способности и Улучшения
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div 
              onClick={(e) => setSelectedItem({
                item: {
                  id: "telekinesis",
                  name: "Телекинез",
                  type: "Способность",
                  icon: "🧠",
                  description: `Увеличивает количество получаемого страха за правильные ответы. Текущий бонус: +${character ? (character.telekinesisLevel - 1) * storeConfig.telekinesisRewardBonus : 0} страха.`,
                  cost: storeConfig.telekinesisBaseCost * Math.pow(storeConfig.telekinesisCostMultiplier, (character?.telekinesisLevel || 1) - 1),
                  currency: "fear",
                  isUpgrade: true,
                  action: handleUpgrade
                },
                y: e.clientY
              })}
              className="bg-neutral-900 border border-neutral-800 hover:border-neutral-600 rounded-2xl p-4 flex flex-col items-center text-center gap-3 transition-colors cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-purple-900/30 flex items-center justify-center text-3xl border border-purple-500/30 shadow-inner">
                🧠
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-white leading-tight">Телекинез</h3>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">Уровень: {character?.telekinesisLevel}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpgrade(e);
                }}
                className={`w-full py-2 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1 relative overflow-hidden ${
                  successEffect === "telekinesis" 
                    ? "bg-green-500 text-white border-green-400 scale-105 shadow-[0_0_20px_rgba(34,197,94,0.6)]"
                    : character && fear >= storeConfig.telekinesisBaseCost * Math.pow(storeConfig.telekinesisCostMultiplier, character.telekinesisLevel - 1)
                    ? "bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50"
                    : "bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700"
                }`}
              >
                {successEffect === "telekinesis" && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center bg-green-500"
                  >
                    <Sparkles size={18} className="text-white" />
                  </motion.div>
                )}
                <Skull size={14} />{" "}
                {character ? storeConfig.telekinesisBaseCost * Math.pow(storeConfig.telekinesisCostMultiplier, character.telekinesisLevel - 1) : 0}
              </button>
            </div>

            <div 
              onClick={(e) => setSelectedItem({
                item: {
                  id: "boss_level",
                  name: "Усиление Босса",
                  type: "Улучшение",
                  icon: "👹",
                  description: `Увеличивает здоровье босса и награду за его убийство. Текущая награда: ${storeConfig.bossRewardBase * Math.pow(storeConfig.bossRewardMultiplier, bossLevel - 1)} арбузов.`,
                  cost: storeConfig.bossBaseCost * Math.pow(storeConfig.bossCostMultiplier, bossLevel - 1),
                  currency: "watermelons",
                  isUpgrade: true,
                  action: handleUpgradeBoss
                },
                y: e.clientY
              })}
              className="bg-neutral-900 border border-neutral-800 hover:border-neutral-600 rounded-2xl p-4 flex flex-col items-center text-center gap-3 transition-colors cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-green-900/30 flex items-center justify-center text-3xl border border-green-500/30 shadow-inner">
                👹
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-white leading-tight">Усиление Босса</h3>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">Уровень: {bossLevel}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpgradeBoss(e);
                }}
                className={`w-full py-2 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1 relative overflow-hidden ${
                  successEffect === "boss_level"
                    ? "bg-green-500 text-white border-green-400 scale-105 shadow-[0_0_20px_rgba(34,197,94,0.6)]"
                    : watermelons >= storeConfig.bossBaseCost * Math.pow(storeConfig.bossCostMultiplier, bossLevel - 1)
                    ? "bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-900/50"
                    : "bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700"
                }`}
              >
                {successEffect === "boss_level" && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center bg-green-500"
                  >
                    <Sparkles size={18} className="text-white" />
                  </motion.div>
                )}
                🍉 {storeConfig.bossBaseCost * Math.pow(storeConfig.bossCostMultiplier, bossLevel - 1)}
              </button>
            </div>
          </div>
        </section>

        {/* Items */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-b border-neutral-800 pb-2">
            Товары за Страх
          </h2>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
            {shopItems.map((item) => {
              const isOwned = inventory.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={(e) => setSelectedItem({item, y: e.clientY})}
                  className={`bg-neutral-900 border ${isOwned ? "border-green-900/50 opacity-70" : "border-neutral-800 hover:border-neutral-600"} rounded-2xl p-4 flex flex-col items-center text-center gap-3 transition-colors cursor-pointer`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center text-3xl shadow-inner relative">
                    {item.icon}
                    {successEffect === item.id && (
                      <motion.div
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 2, opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 bg-green-500 rounded-2xl"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white leading-tight">{item.name}</h3>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">{item.type}</p>
                  </div>
                  <button
                    disabled={isOwned || isProcessing}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuy(item);
                    }}
                    className={`w-full py-2 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-1 ${
                      isOwned
                        ? "bg-green-900/20 text-green-500 border border-green-900/30"
                        : fear >= item.cost
                        ? "bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50"
                        : "bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700"
                    }`}
                  >
                    {isOwned ? (
                      "Куплено"
                    ) : isProcessing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>
                        <Skull size={14} /> {item.cost}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Boss Items */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-b border-neutral-800 pb-2">
            Экипировка для Боссов
          </h2>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
            {bossItems.map((item) => {
              const isOwned = inventory.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={(e) => setSelectedItem({item, y: e.clientY})}
                  className={`bg-neutral-900 border ${isOwned ? "border-green-900/50 opacity-70" : "border-neutral-800 hover:border-neutral-600"} rounded-2xl p-4 flex flex-col items-center text-center gap-3 transition-colors cursor-pointer`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center text-3xl shadow-inner relative">
                    {item.icon}
                    {successEffect === item.id && (
                      <motion.div
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 2, opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 bg-green-500 rounded-2xl"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white leading-tight">{item.name}</h3>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">{item.type}</p>
                  </div>
                  <button
                    disabled={isOwned || isProcessing}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuy(item);
                    }}
                    className={`w-full py-2 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-1 ${
                      isOwned
                        ? "bg-green-900/20 text-green-500 border border-green-900/30"
                        : watermelons >= item.cost
                        ? "bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-900/50"
                        : "bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700"
                    }`}
                  >
                    {isOwned ? (
                      "Куплено"
                    ) : isProcessing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>
                        🍉 {item.cost}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <CurrencyModal type={infoModal?.type || null} clickY={infoModal?.y} onClose={() => setInfoModal(null)} />

      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedItem(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }}
              animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
              exit={{ opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }}
              onClick={(e) => e.stopPropagation()}
              className="fixed bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-sm w-[90%] shadow-2xl"
              style={{ 
                top: settings.theme === 'cyberpunk' ? '50%' : (selectedItem.y ? Math.max(200, Math.min(selectedItem.y, window.innerHeight - 200)) : '50%'), 
                left: '50%' 
              }}
            >
              <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 text-neutral-400 hover:text-white p-2 bg-neutral-800 rounded-full transition-colors">
                <X size={20} />
              </button>
              
              <div className="flex flex-col items-center text-center gap-4 mt-2">
                <div className="w-24 h-24 rounded-2xl bg-neutral-800 flex items-center justify-center text-5xl border border-neutral-700/50 shadow-inner">
                  {selectedItem.item.icon}
                </div>
                
                <div>
                  <h2 className="text-2xl font-black text-white">{selectedItem.item.name}</h2>
                  <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest mt-1">{selectedItem.item.type}</p>
                </div>
                
                <p className="text-neutral-300 leading-relaxed text-sm bg-neutral-800/50 p-4 rounded-xl border border-neutral-700/30 w-full">
                  {selectedItem.item.description}
                </p>

                <button
                  disabled={(!selectedItem.item.isUpgrade && inventory.includes(selectedItem.item.id)) || isProcessing}
                  onClick={(e) => {
                    if (selectedItem.item.isUpgrade) {
                      selectedItem.item.action(e);
                      if (selectedItem.item.currency === "fear" && fear >= selectedItem.item.cost) setSelectedItem(null);
                      if (selectedItem.item.currency === "watermelons" && watermelons >= selectedItem.item.cost) setSelectedItem(null);
                    } else {
                      handleBuy(selectedItem.item);
                      if (selectedItem.item.currency === "fear" && fear >= selectedItem.item.cost) setSelectedItem(null);
                      if (selectedItem.item.currency === "watermelons" && watermelons >= selectedItem.item.cost) setSelectedItem(null);
                    }
                  }}
                  className={`mt-4 w-full py-4 rounded-xl font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${
                    !selectedItem.item.isUpgrade && inventory.includes(selectedItem.item.id)
                      ? "bg-green-900/20 text-green-500 border border-green-900/30"
                      : (selectedItem.item.currency === "fear" && fear >= selectedItem.item.cost) || (selectedItem.item.currency === "watermelons" && watermelons >= selectedItem.item.cost)
                      ? "bg-neutral-100 hover:bg-white text-neutral-900"
                      : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                  }`}
                >
                  {!selectedItem.item.isUpgrade && inventory.includes(selectedItem.item.id) ? (
                    "УЖЕ КУПЛЕНО"
                  ) : isProcessing ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      {selectedItem.item.isUpgrade ? "УЛУЧШИТЬ ЗА" : "КУПИТЬ ЗА"} {selectedItem.item.cost} {selectedItem.item.currency === 'fear' ? <Skull size={18} /> : '🍉'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {warningModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" onClick={() => setWarningModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }}
              animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
              exit={{ opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }}
              onClick={(e) => e.stopPropagation()}
              className="fixed bg-neutral-900 border border-red-900/50 rounded-3xl p-6 max-w-sm w-[90%] shadow-[0_0_40px_rgba(220,38,38,0.2)]"
              style={{ 
                top: settings.theme === 'cyberpunk' ? '50%' : (warningModal.y ? Math.max(150, Math.min(warningModal.y, window.innerHeight - 150)) : '50%'), 
                left: '50%' 
              }}
            >
              <button onClick={() => setWarningModal(null)} className="absolute top-4 right-4 text-neutral-400 hover:text-white p-2 bg-neutral-800 rounded-full transition-colors">
                <X size={20} />
              </button>
              
              <div className="flex flex-col items-center text-center gap-4 mt-2">
                <div className="w-20 h-20 rounded-full bg-red-900/20 flex items-center justify-center text-red-500 mb-2">
                  <Skull size={40} />
                </div>
                
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-wider">Недостаточно ресурсов</h2>
                  <p className="text-sm font-bold text-red-400 mt-1">Отказ в выдаче: {warningModal.item.name}</p>
                </div>
                
                <p className="text-neutral-300 leading-relaxed text-sm bg-neutral-800/50 p-4 rounded-xl border border-neutral-700/30 w-full">
                  Эй, Бабай! Твоих запасов не хватает для этой крутой штуки. 
                  Тебе нужно еще <strong className={warningModal.item.currency === 'fear' ? 'text-red-400' : 'text-green-400'}>
                    {warningModal.deficit} {warningModal.item.currency === 'fear' ? 'страха' : 'арбузов'}
                  </strong>, чтобы получить это. 
                  Иди пугай жильцов или побеждай боссов!
                </p>

                <button
                  onClick={() => setWarningModal(null)}
                  className="mt-2 w-full py-3 rounded-xl font-bold uppercase tracking-widest bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
                >
                  Понятно
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
