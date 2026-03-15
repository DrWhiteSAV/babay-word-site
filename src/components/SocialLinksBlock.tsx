import { ExternalLink } from "lucide-react";

const LINKS = [
  {
    url: "https://t.me/babai_game",
    icon: "📰",
    title: "Бабай Вестник",
    desc: "Канал с новостями и обновлениями игры",
    color: "border-blue-800/50 hover:border-blue-600/60",
  },
  {
    url: "https://t.me/babai_chat",
    icon: "👻",
    title: "Бабайки",
    desc: "Чат содружества и техподдержка",
    color: "border-purple-800/50 hover:border-purple-600/60",
  },
  {
    url: "https://t.me/SAV_AI",
    icon: "🤖",
    title: "SAV AI",
    desc: "Новости про нейросети и ИИ",
    color: "border-cyan-800/50 hover:border-cyan-600/60",
  },
  {
    url: "https://t.me/shishkarnem",
    icon: "👨‍💻",
    title: "Doctor White",
    desc: "Разработчик приложения",
    color: "border-green-800/50 hover:border-green-600/60",
  },
  {
    url: "https://t.me/SAV_AIbot",
    icon: "🛒",
    title: "Спаситель Продаж",
    desc: "Заказать разработку ИИ-приложения",
    color: "border-orange-800/50 hover:border-orange-600/60",
  },
  {
    url: "https://t.me/SAVPartnerBot",
    icon: "🤝",
    title: "ИИ-Гренландия",
    desc: "Партнёрская программа и альянс экспертов",
    color: "border-yellow-800/50 hover:border-yellow-600/60",
  },
  {
    url: "https://www.youtube.com/@SAVAILife",
    icon: "🎬",
    title: "Нейросети для бизнеса",
    desc: "YouTube канал с прямыми эфирами",
    color: "border-red-800/50 hover:border-red-600/60",
  },
];

export default function SocialLinksBlock() {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-2">
        <ExternalLink size={14} /> Ссылки и сообщество
      </h2>
      <div className="grid grid-cols-1 gap-2">
        {LINKS.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 p-3 bg-neutral-900/70 backdrop-blur-sm border rounded-xl transition-all active:scale-[0.98] ${link.color}`}
          >
            <span className="text-2xl shrink-0">{link.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm truncate">{link.title}</p>
              <p className="text-[10px] text-neutral-400 truncate">{link.desc}</p>
            </div>
            <ExternalLink size={14} className="text-neutral-500 shrink-0" />
          </a>
        ))}
      </div>
    </section>
  );
}
