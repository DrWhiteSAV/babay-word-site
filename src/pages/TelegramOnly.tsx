import { motion } from "motion/react";

export default function TelegramOnly() {
  return (
    <div className="min-h-[100dvh] bg-neutral-950 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-sm w-full text-center space-y-6"
      >
        {/* Icon */}
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 3 }}
          className="text-8xl select-none"
        >
          👻
        </motion.div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-neutral-100 leading-tight">
            Бабай ждёт тебя
          </h1>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Это приложение работает только через Telegram Mini App.
            Открой его через бота, чтобы войти.
          </p>
        </div>

        {/* Warning box */}
        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-2xl p-4 text-left space-y-1">
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider">⚠ Прямой вход недоступен</p>
          <p className="text-yellow-200/70 text-xs">
            Для полноценной работы необходим вход через Telegram — авторизация, профиль и прогресс привязаны к твоему аккаунту.
          </p>
        </div>

        {/* CTA Button */}
        <a
          href="https://t.me/Bab_AIbot/app"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-4 px-6 bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white font-black text-lg rounded-2xl border border-red-500/50 shadow-lg shadow-red-900/40 transition-all active:scale-95"
        >
          🚀 Открыть в Telegram
        </a>

        <p className="text-neutral-600 text-xs">
          t.me/Bab_AIbot/app
        </p>
      </motion.div>
    </div>
  );
}
