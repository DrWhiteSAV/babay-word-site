import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Trophy, Target, Star, Bell } from "lucide-react";

export interface Notification {
  id: string;
  type: 'achievement' | 'event' | 'chat' | 'friend';
  title: string;
  message: string;
  icon?: string;
  reward?: string;
}

let globalNotificationQueue: Notification[] = [];
let globalSetNotifications: React.Dispatch<React.SetStateAction<Notification[]>> | null = null;

export function pushNotification(notif: Omit<Notification, 'id'>) {
  const id = Date.now().toString() + Math.random();
  const full = { ...notif, id };
  globalNotificationQueue.push(full);
  if (globalSetNotifications) {
    globalSetNotifications(prev => [...prev, full]);
  }
}

export function NotificationPopupProvider() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    globalSetNotifications = setNotifications;
    return () => { globalSetNotifications = null; };
  }, []);

  const dismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        setNotifications(prev => prev.slice(1));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notifications]);

  const getIcon = (type: Notification['type'], icon?: string) => {
    if (icon) return <span className="text-3xl">{icon}</span>;
    switch (type) {
      case 'achievement': return <Trophy size={24} className="text-yellow-400" />;
      case 'event': return <Target size={24} className="text-red-400" />;
      case 'chat': return <Bell size={24} className="text-blue-400" />;
      case 'friend': return <Star size={24} className="text-green-400" />;
    }
  };

  const getBorder = (type: Notification['type']) => {
    switch (type) {
      case 'achievement': return 'border-yellow-500/50 bg-yellow-900/20';
      case 'event': return 'border-red-500/50 bg-red-900/20';
      case 'chat': return 'border-blue-500/50 bg-blue-900/20';
      case 'friend': return 'border-green-500/50 bg-green-900/20';
    }
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] w-[90vw] max-w-sm space-y-2 pointer-events-none">
      <AnimatePresence>
        {notifications.map(notif => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`pointer-events-auto bg-neutral-900/95 backdrop-blur-xl border rounded-2xl p-4 shadow-2xl ${getBorder(notif.type)}`}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                {getIcon(notif.type, notif.icon)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">{notif.title}</p>
                <p className="text-neutral-300 text-xs mt-0.5">{notif.message}</p>
                {notif.reward && (
                  <p className="text-xs font-bold text-yellow-400 mt-1">🎁 {notif.reward}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(notif.id)}
                className="shrink-0 text-neutral-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
