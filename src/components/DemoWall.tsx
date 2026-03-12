import { motion } from "motion/react";
import { ExternalLink, Lock } from "lucide-react";
import { CutscenePlayer } from "./CutscenePlayer";
import { useState } from "react";

interface DemoWallProps {
  /** Show cutscene first, then the wall */
  showCutscene?: boolean;
}

const TELEGRAM_APP_LINK = "https://t.me/Bab_AIbot/app";

const features = [
  { icon: "🎮", title: "Полная игра", desc: "Десятки этапов с уникальными сценариями" },
  { icon: "👹", title: "Битвы с боссами", desc: "Эпические сражения на каждом уровне" },
  { icon: "🎨", title: "Галерея", desc: "AI-генерация аватаров и фонов" },
  { icon: "💬", title: "Чаты", desc: "Общайся с друзьями и AI-персонажами" },
  { icon: "⚔️", title: "PVP арена", desc: "Соревнуйся с другими игроками" },
  { icon: "🏆", title: "Достижения", desc: "Разблокируй награды и поднимайся в рейтинге" },
];

export default function DemoWall({ showCutscene = false }: DemoWallProps) {
  const [cutsceneDone, setCutsceneDone] = useState(!showCutscene);

  if (!cutsceneDone) {
    return <CutscenePlayer onComplete={() => setCutsceneDone(true)} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9998] bg-neutral-950/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="max-w-md w-full space-y-6 py-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-900/30 border border-red-800/50 flex items-center justify-center">
              <Lock size={28} className="text-red-500" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white">Демо-версия завершена!</h2>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Вы прошли демо-этап игры. Чтобы продолжить приключение и получить доступ ко всем возможностям, войдите через Telegram.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-neutral-900/60 border border-neutral-800/50 rounded-lg p-3 text-center"
            >
              <div className="text-2xl mb-1">{f.icon}</div>
              <div className="text-white text-xs font-semibold">{f.title}</div>
              <div className="text-neutral-500 text-[10px] mt-0.5">{f.desc}</div>
            </div>
          ))}
        </div>

        <a
          href={TELEGRAM_APP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-4 bg-[#2AABEE] hover:bg-[#229ED9] text-white rounded-xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(42,171,238,0.3)]"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
          Войти через Telegram
          <ExternalLink size={16} />
        </a>

        <p className="text-neutral-600 text-[10px] text-center">
          Бесплатно • Все возможности • Сохранение прогресса
        </p>
      </div>
    </motion.div>
  );
}
