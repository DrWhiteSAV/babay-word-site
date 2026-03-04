import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { motion } from "motion/react";
import { Bell, BellOff, MessageSquare, Target, Trophy, UserPlus, Loader2, Save } from "lucide-react";
import Header from "../components/Header";
import { useNotificationSettings } from "../hooks/useNotificationSettings";
import { useTelegram } from "../context/TelegramContext";

interface ToggleRowProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  value: boolean;
  onChange: (val: boolean) => void;
}

function ToggleRow({ label, description, icon, value, onChange }: ToggleRowProps) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${value ? 'border-green-700/50 bg-green-900/10' : 'border-neutral-800 bg-neutral-900/50'}`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${value ? 'bg-green-900/40 text-green-400' : 'bg-neutral-800 text-neutral-500'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-white text-sm">{label}</p>
        <p className="text-xs text-neutral-400 mt-0.5">{description}</p>
      </div>
      <div className={`w-12 h-6 rounded-full relative transition-colors shrink-0 ${value ? 'bg-green-600' : 'bg-neutral-700'}`}>
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-7' : 'translate-x-1'}`} />
      </div>
    </button>
  );
}

export default function NotificationSettingsPage() {
  const { profile } = useTelegram();
  const { settings, update, loading } = useNotificationSettings();
  const [saved, setSaved] = useState(false);

  const handleChange = async (key: keyof typeof settings, val: boolean) => {
    await update({ [key]: val });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col bg-transparent text-white relative overflow-hidden"
    >
      <Header
        title={<><Bell size={20} /> Уведомления</>}
        backUrl="/settings"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-8 relative z-10">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-red-500" /></div>
        ) : (
          <>
            {saved && (
              <div className="bg-green-900/30 border border-green-700/50 rounded-xl px-4 py-2 text-green-400 text-sm font-bold text-center flex items-center gap-2 justify-center">
                <Save size={14} /> Сохранено
              </div>
            )}

            <section>
              <h2 className="text-sm font-bold text-white mb-3 uppercase tracking-wider border-b border-neutral-800 pb-2 flex items-center gap-2">
                <Bell size={16} /> Telegram-уведомления
              </h2>
              <div className="space-y-3">
                <ToggleRow
                  label="Добавление в друзья"
                  description="Оповещение в Telegram при новой заявке в друзья"
                  icon={<UserPlus size={18} />}
                  value={settings.notify_friend_added}
                  onChange={v => handleChange('notify_friend_added', v)}
                />
                <ToggleRow
                  label="Выполнение эвента"
                  description="Уведомление при завершении ивента"
                  icon={<Target size={18} />}
                  value={settings.notify_event_complete}
                  onChange={v => handleChange('notify_event_complete', v)}
                />
                <ToggleRow
                  label="Достижения"
                  description="Уведомление при разблокировке достижения"
                  icon={<Trophy size={18} />}
                  value={settings.notify_achievement}
                  onChange={v => handleChange('notify_achievement', v)}
                />
                <ToggleRow
                  label="Сообщения (оффлайн)"
                  description="Уведомление в Telegram если вы не в сети"
                  icon={<MessageSquare size={18} />}
                  value={settings.notify_chat_offline}
                  onChange={v => handleChange('notify_chat_offline', v)}
                />
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold text-white mb-3 uppercase tracking-wider border-b border-neutral-800 pb-2 flex items-center gap-2">
                <Bell size={16} /> Попап-уведомления в приложении
              </h2>
              <div className="space-y-3">
                <ToggleRow
                  label="Эвенты и задания"
                  description="Всплывающие уведомления при завершении эвентов"
                  icon={<Target size={18} />}
                  value={settings.popup_events}
                  onChange={v => handleChange('popup_events', v)}
                />
                <ToggleRow
                  label="Достижения"
                  description="Всплывающее окно при разблокировке достижения"
                  icon={<Trophy size={18} />}
                  value={settings.popup_achievements}
                  onChange={v => handleChange('popup_achievements', v)}
                />
                <ToggleRow
                  label="Новые сообщения"
                  description="Попап при получении нового сообщения в чате"
                  icon={<MessageSquare size={18} />}
                  value={settings.popup_chat}
                  onChange={v => handleChange('popup_chat', v)}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </motion.div>
  );
}
