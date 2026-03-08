import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Image as ImageIcon, Video, ShieldAlert, ShoppingCart, Users, Bot, Music, Type, BarChart3, Bell, Upload } from "lucide-react";
import Header from "../components/Header";

export default function Admin() {
  const navigate = useNavigate();

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
        title={<><ShieldAlert size={20} /> Админ-панель</>}
        backUrl="/profile"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800 text-sm text-neutral-400">
          Добро пожаловать в панель администратора. Здесь вы можете управлять глобальными настройками приложения.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <button
            onClick={() => navigate("/admin/stat")}
            className="bg-neutral-900 border border-neutral-800 hover:border-red-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 transition-colors group"
          >
            <div className="w-16 h-16 rounded-full bg-neutral-800 group-hover:bg-red-900/30 flex items-center justify-center transition-colors">
              <BarChart3 size={32} className="text-neutral-400 group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-1">Статистика</h3>
              <p className="text-xs text-neutral-500">Аналитика и общие показатели</p>
            </div>
          </button>

          <button
            onClick={() => navigate("/admin/users")}
            className="bg-neutral-900 border border-neutral-800 hover:border-red-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 transition-colors group"
          >
            <div className="w-16 h-16 rounded-full bg-neutral-800 group-hover:bg-red-900/30 flex items-center justify-center transition-colors">
              <Users size={32} className="text-neutral-400 group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-1">Пользователи</h3>
              <p className="text-xs text-neutral-500">Управление профилями и балансами</p>
            </div>
          </button>

          <button
            onClick={() => navigate("/admin/ai")}
            className="bg-neutral-900 border border-neutral-800 hover:border-red-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 transition-colors group"
          >
            <div className="w-16 h-16 rounded-full bg-neutral-800 group-hover:bg-red-900/30 flex items-center justify-center transition-colors">
              <Bot size={32} className="text-neutral-400 group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-1">Настройки ИИ</h3>
              <p className="text-xs text-neutral-500">Ключи, промпты и сервисы</p>
            </div>
          </button>

          <button
            onClick={() => navigate("/admin/audio")}
            className="bg-neutral-900 border border-neutral-800 hover:border-red-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 transition-colors group"
          >
            <div className="w-16 h-16 rounded-full bg-neutral-800 group-hover:bg-red-900/30 flex items-center justify-center transition-colors">
              <Music size={32} className="text-neutral-400 group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-1">Аудио</h3>
              <p className="text-xs text-neutral-500">Управление музыкой и звуками</p>
            </div>
          </button>

          <button
            onClick={() => navigate("/admin/text")}
            className="bg-neutral-900 border border-neutral-800 hover:border-red-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 transition-colors group"
          >
            <div className="w-16 h-16 rounded-full bg-neutral-800 group-hover:bg-red-900/30 flex items-center justify-center transition-colors">
              <Type size={32} className="text-neutral-400 group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-1">Тексты</h3>
              <p className="text-xs text-neutral-500">Управление текстами страниц</p>
            </div>
          </button>

          <button
            onClick={() => navigate("/admin/pic")}
            className="bg-neutral-900 border border-neutral-800 hover:border-red-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 transition-colors group"
          >
            <div className="w-16 h-16 rounded-full bg-neutral-800 group-hover:bg-red-900/30 flex items-center justify-center transition-colors">
              <ImageIcon size={32} className="text-neutral-400 group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-1">Фоны страниц</h3>
              <p className="text-xs text-neutral-500">Управление фоновыми изображениями для каждого раздела</p>
            </div>
          </button>

          <button
            onClick={() => navigate("/admin/video")}
            className="bg-neutral-900 border border-neutral-800 hover:border-red-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 transition-colors group"
          >
            <div className="w-16 h-16 rounded-full bg-neutral-800 group-hover:bg-red-900/30 flex items-center justify-center transition-colors">
              <Video size={32} className="text-neutral-400 group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-1">Видео катсцены</h3>
              <p className="text-xs text-neutral-500">Управление ссылками на стартовые видео (вертикальные и горизонтальные)</p>
            </div>
          </button>

          <button
            onClick={() => navigate("/admin/store")}
            className="bg-neutral-900 border border-neutral-800 hover:border-red-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 transition-colors group"
          >
            <div className="w-16 h-16 rounded-full bg-neutral-800 group-hover:bg-red-900/30 flex items-center justify-center transition-colors">
              <ShoppingCart size={32} className="text-neutral-400 group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-1">Настройки магазина</h3>
              <p className="text-xs text-neutral-500">Управление стоимостью прокачки, наградами и восстановлением энергии</p>
            </div>
          </button>

          <button
            onClick={() => navigate("/admin/images")}
            className="bg-neutral-900 border border-neutral-800 hover:border-red-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 transition-colors group"
          >
            <div className="w-16 h-16 rounded-full bg-neutral-800 group-hover:bg-red-900/30 flex items-center justify-center transition-colors">
              <Upload size={32} className="text-neutral-400 group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-1">Загрузка картинок</h3>
              <p className="text-xs text-neutral-500">Загрузка файлов на ImgBB и сохранение ссылок</p>
            </div>
          </button>

          <button
            onClick={() => navigate("/admin/notifications")}
            className="bg-neutral-900 border border-neutral-800 hover:border-red-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 transition-colors group"
          >
            <div className="w-16 h-16 rounded-full bg-neutral-800 group-hover:bg-red-900/30 flex items-center justify-center transition-colors">
              <Bell size={32} className="text-neutral-400 group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-1">Уведомления</h3>
              <p className="text-xs text-neutral-500">Конструктор рассылок и уведомлений в Telegram</p>
            </div>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
