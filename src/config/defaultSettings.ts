import { ShopItem, StoreConfig } from "../store/playerStore";

// Базовые настройки магазина и прокачки
export const DEFAULT_STORE_CONFIG: StoreConfig = {
  telekinesisBaseCost: 50,
  telekinesisCostMultiplier: 2,
  telekinesisRewardBonus: 1,
  bossBaseCost: 500,
  bossCostMultiplier: 5,
  bossRewardBase: 25,
  bossRewardMultiplier: 2,
  energyRegenMinutes: 5,
};

// Базовые тексты страниц
export const DEFAULT_TEXTS: Record<string, string> = {
  // Главная
  home_play_btn: "НАЧАТЬ",
  home_continue_btn: "ПРОДОЛЖИТЬ",
  home_profile_btn: "Профиль",
  home_settings_btn: "Настройки",
  home_version: "v1.0.0 © 2026 Bab-AI.ru",
  home_logo_alt: "Бабай Bab-AI",

  // Хаб
  hub_play_btn: "ИГРАТЬ",
  hub_shop_btn: "Магазин",
  hub_friends_btn: "Друзья",
  hub_leaderboard_btn: "Рейтинг",

  // Магазин
  shop_title: "Магазин",
  shop_abilities_section: "Способности и Улучшения",
  shop_fear_section: "Товары за Страх",
  shop_boss_section: "Экипировка для Боссов",
  shop_bought_label: "Куплено",
  shop_telekinesis_name: "Телекинез",
  shop_boss_upgrade_name: "Усиление Босса",
  shop_logo_url: "https://i.ibb.co/pvJ73kxN/babai2.png",

  // Профиль
  profile_title: "Профиль",
  profile_gallery_title: "Галерея",
  profile_gallery_see_all: "СМОТРЕТЬ ВСЕ",
  profile_lore_title: "История духа",
  profile_lore_generating: "Дух вспоминает свое прошлое...",
  profile_lore_empty: "История утеряна во мраке веков.",
  profile_inventory_title: "Инвентарь",
  profile_referral_title: "Пригласи друга",
  profile_referral_desc: "Получи 100 энергии и 100 страха за каждого друга, который присоединится по твоей ссылке.",
  profile_telekinesis_level: "Уровень Телекинеза",
  profile_fear_label: "Страх",
  profile_energy_label: "Энергия",
  profile_watermelons_label: "Арбузы",

  // Настройки
  settings_title: "Настройки",
  settings_btn_size_title: "Размер кнопок",
  settings_btn_small: "Мелкие",
  settings_btn_medium: "Средние",
  settings_btn_large: "Крупные",
  settings_theme_title: "Тема оформления",
  settings_theme_normal: "Обычная",
  settings_theme_cyberpunk: "Киберпанк",
  settings_font_family_title: "Стиль шрифта",
  settings_font_size_title: "Размер шрифта",
  settings_font_brightness_title: "Яркость шрифта",
  settings_tts_title: "Озвучка текста",
  settings_tts_on: "ВКЛЮЧЕНА",
  settings_tts_off: "ВЫКЛЮЧЕНА",
  settings_music_title: "Громкость музыки",
  settings_clear_gallery: "ОЧИСТИТЬ ГАЛЕРЕЮ",
  settings_reset_progress: "СБРОСИТЬ ПРОГРЕСС",
  settings_confirm_clear_gallery: "Очистить галерею? Это освободит место в памяти устройства.",
  settings_confirm_reset: "Вы уверены, что хотите удалить персонажа и начать заново?",

  // Создание персонажа
  char_create_title: "Создать персонажа",
  char_create_name_placeholder: "Введите имя...",
  char_create_btn: "Создать Бабая",

  // Друзья
  friends_title: "Друзья",
  friends_add_placeholder: "Введите имя...",
  friends_add_btn: "Добавить",
  friends_empty: "Нет друзей. Добавьте первого!",

  // Чат
  chat_title: "Чат",
  chat_placeholder: "Введите сообщение...",
  chat_send_btn: "Отправить",
  chat_ai_typing: "ДанИИл печатает...",

  // Игра
  game_title: "Игра",
  game_fear_label: "Страх",
  game_energy_label: "Энергия",

  // Лидерборд
  leaderboard_title: "Таблица лидеров",
  leaderboard_empty: "Пока никого нет...",
  leaderboard_rank: "Место",
  leaderboard_name: "Имя",
  leaderboard_score: "Страх",

  // События
  events_title: "События",
  events_empty: "Нет активных событий",

  // Галерея
  gallery_title: "Галерея",
  gallery_empty: "Галерея пуста",

  // Админка общее
  admin_title: "Админ-панель",
  admin_desc: "Добро пожаловать в панель администратора. Здесь вы можете управлять глобальными настройками приложения.",

  // Роли
  roles_super_babai_desc: "Полный доступ + добавление Ад-Бабаев",
  roles_ad_babai_desc: "Полный доступ (кроме добавления Ад-Бабаев)",
  roles_babai_desc: "Обычный пользователь (только игра)",
  roles_super_babai_pages: "Все разделы админки и игры",
  roles_ad_babai_pages: "Все разделы кроме управления ролями",
  roles_babai_pages: "Только игровые страницы",
};

// Роли пользователей
export const DEFAULT_USERS: Array<{
  id: string;
  name: string;
  role: "Супер-Бабай" | "Ад-Бабай" | "Бабай";
  access: string;
  pages: string;
}> = [
  {
    id: "169262990",
    name: "Создатель",
    role: "Супер-Бабай",
    access: DEFAULT_TEXTS.roles_super_babai_desc || "Полный доступ + добавление Ад-Бабаев",
    pages: DEFAULT_TEXTS.roles_super_babai_pages || "Все разделы админки и игры",
  },
];

// Базовые изображения для галереи — только проверенные рабочие ссылки
export const DEFAULT_GALLERY_IMAGES = [
  "https://i.ibb.co/BVgY7XrT/babai.png",
];

// Базовые вертикальные видео (для мобильных/шортсов)
export const DEFAULT_VERTICAL_VIDEOS = [
  "https://cdn.pixabay.com/video/2020/05/25/40130-424823521_large.mp4",
  "https://cdn.pixabay.com/video/2023/10/22/186008-876824401_large.mp4"
];

// Базовые горизонтальные видео (для десктопа)
export const DEFAULT_HORIZONTAL_VIDEOS = [
  "https://cdn.pixabay.com/video/2022/11/01/137394-766524330_large.mp4",
  "https://cdn.pixabay.com/video/2021/08/11/84687-587842605_large.mp4"
];

// Базовые товары за Страх
export const DEFAULT_SHOP_ITEMS: ShopItem[] = [
  {
    id: "wig_1",
    name: 'Парик "Одуванчик"',
    type: "Аксессуар",
    cost: 10,
    currency: "fear",
    icon: "💇‍♂️",
    description: "Стильный парик, который заставит монстров чихать. Немного щекочет уши, но зато выглядит эффектно.",
  },
  {
    id: "teeth_1",
    name: "Ржавые зубы",
    type: "Аксессуар",
    cost: 15,
    currency: "fear",
    icon: "🦷",
    description: "Ржавые зубы для устрашения соседей. Не рекомендуется использовать для пережевывания твердой пищи.",
  },
  {
    id: "pajamas_1",
    name: "Кровавая пижама",
    type: "Одежда",
    cost: 25,
    currency: "fear",
    icon: "👕",
    description: "Удобная, но слегка испачканная пижама. Монстры подумают, что вы уже с кем-то подрались.",
  },
  {
    id: "tongue_1",
    name: "Раздвоенный язык",
    type: "Мутация",
    cost: 50,
    currency: "fear",
    icon: "👅",
    description: "Позволяет шипеть на врагов с двойной эффективностью. Отлично подходит для передразнивания змей.",
  },
  {
    id: "weapon_1",
    name: "Ржавая труба",
    type: "Оружие",
    cost: 100,
    currency: "fear",
    icon: "🔧",
    description: "Надежный аргумент в любом споре с нечистью. Тяжелая, холодная и очень убедительная.",
  },
  {
    id: "eyes_1",
    name: "Светящиеся глаза",
    type: "Мутация",
    cost: 150,
    currency: "fear",
    icon: "👁️",
    description: "Позволяют видеть в темноте и пугать соседей до икоты.",
  },
  {
    id: "claw_1",
    name: "Когтистая лапа",
    type: "Мутация",
    cost: 200,
    currency: "fear",
    icon: "🐾",
    description: "Острые как бритва когти. Удобно чесать спину и вскрывать замки.",
  },
  {
    id: "mask_1",
    name: "Жуткая маска",
    type: "Аксессуар",
    cost: 250,
    currency: "fear",
    icon: "🎭",
    description: "Маска, от которой даже вам самому становится не по себе.",
  },
  {
    id: "chain_1",
    name: "Цепь с шипами",
    type: "Оружие",
    cost: 300,
    currency: "fear",
    icon: "⛓️",
    description: "Тяжелая цепь. Звенит в ночи, предвещая ваше появление.",
  },
  {
    id: "cloak_torn",
    name: "Рваный плащ",
    type: "Одежда",
    cost: 400,
    currency: "fear",
    icon: "🧥",
    description: "Старый плащ, развевающийся на мистическом ветру.",
  },
  {
    id: "horns_1",
    name: "Демонические рога",
    type: "Мутация",
    cost: 500,
    currency: "fear",
    icon: "😈",
    description: "Небольшие рожки, придающие вам дьявольский шарм.",
  },
  {
    id: "amulet_bone",
    name: "Костяной амулет",
    type: "Аксессуар",
    cost: 600,
    currency: "fear",
    icon: "🦴",
    description: "Амулет из неизвестных костей. Слегка попахивает, но работает.",
  },
  {
    id: "axe_1",
    name: "Топор дровосека",
    type: "Оружие",
    cost: 750,
    currency: "fear",
    icon: "🪓",
    description: "Классика жанра. Идеально для прорубания дверей.",
  },
  {
    id: "shroud_1",
    name: "Призрачный саван",
    type: "Одежда",
    cost: 1000,
    currency: "fear",
    icon: "👻",
    description: "Делает вас полупрозрачным и позволяет проходить сквозь тонкие стены.",
  },
  {
    id: "eye_3",
    name: "Третий глаз",
    type: "Мутация",
    cost: 1250,
    currency: "fear",
    icon: "👁️‍🗨️",
    description: "Видит то, что скрыто. И иногда то, что лучше бы не видеть.",
  },
  {
    id: "doll_1",
    name: "Проклятая кукла",
    type: "Аксессуар",
    cost: 1500,
    currency: "fear",
    icon: "🪆",
    description: "Маленькая кукла, которая иногда шепчет вам советы.",
  },
  {
    id: "scythe_1",
    name: "Коса жнеца",
    type: "Оружие",
    cost: 2000,
    currency: "fear",
    icon: "🌾",
    description: "Острое лезвие, собирающее страх словно урожай.",
  },
  {
    id: "wings_1",
    name: "Крылья летучей мыши",
    type: "Мутация",
    cost: 2500,
    currency: "fear",
    icon: "🦇",
    description: "Позволяют парить над землей и пугать прохожих сверху.",
  },
  {
    id: "armor_shadow",
    name: "Доспех из теней",
    type: "Броня",
    cost: 3000,
    currency: "fear",
    icon: "🌑",
    description: "Соткан из чистой тьмы. Поглощает свет и надежды врагов.",
  },
  {
    id: "eye_abyss",
    name: "Око бездны",
    type: "Аксессуар",
    cost: 4000,
    currency: "fear",
    icon: "🌌",
    description: "Заглянув в него, враги теряют рассудок.",
  },
  {
    id: "mantle_1",
    name: "Мантия",
    type: "Одежда",
    cost: 5000,
    currency: "fear",
    icon: "🧥",
    description: "Темная мантия, скрывающая вас во мраке. Идеально подходит для драматичных появлений.",
  },
  {
    id: "cloak_1",
    name: "Плащ невидимка",
    type: "Одежда",
    cost: 10000,
    currency: "fear",
    icon: "🥷",
    description: "Делает вас почти невидимым для глупых монстров. Главное — не наступить на кота в темноте.",
  },
  {
    id: "predator_suit",
    name: "Костюм Хищника",
    type: "Одежда",
    cost: 20000,
    currency: "fear",
    icon: "👽",
    description: "Высокотехнологичный костюм инопланетного охотника. Встроенный тепловизор в комплект не входит.",
  },
  {
    id: "cyber_implants",
    name: "Кибер-импланты",
    type: "Мутация",
    cost: 40000,
    currency: "fear",
    icon: "🦾",
    description: "Металлические импланты, делающие вас киборгом. Теперь вы можете заряжать телефон от пальца.",
  },
  {
    id: "exoskeleton",
    name: "Экзоскелет",
    type: "Броня",
    cost: 80000,
    currency: "fear",
    icon: "🤖",
    description: "Мощный каркас, многократно увеличивающий силу. Позволяет открывать банки с огурцами без усилий.",
  },
  {
    id: "astronaut_helmet",
    name: "Шлем Астронавта",
    type: "Аксессуар",
    cost: 150000,
    currency: "fear",
    icon: "👨‍🚀",
    description: "Защитит голову даже в открытом космосе. И от падающих с потолка пауков.",
  },
  {
    id: "doomguy_armor",
    name: "Броня Думгая",
    type: "Броня",
    cost: 300000,
    currency: "fear",
    icon: "🪖",
    description: "Броня легендарного палача рока. Демоны в ужасе разбегаются при одном вашем виде.",
  },
  {
    id: "one_ring",
    name: "Кольцо Всевластия",
    type: "Аксессуар",
    cost: 500000,
    currency: "fear",
    icon: "💍",
    description: "Моя прелесть... Дает невероятную власть над тенями, но вызывает странную тягу к вулканам.",
  },
  {
    id: "amulet_ancients",
    name: "Амулет Древних",
    type: "Аксессуар",
    cost: 1000000,
    currency: "fear",
    icon: "🧿",
    description: "Древний артефакт, пульсирующий темной энергией. Никто не знает, что он делает, но выглядит круто.",
  },
  {
    id: "crown_darkness",
    name: "Корона Тьмы",
    type: "Аксессуар",
    cost: 2000000,
    currency: "fear",
    icon: "👑",
    description: "Символ абсолютной власти над ночными кошмарами. Вы — новый повелитель этого хаба.",
  },
];

// Базовые товары за Арбузы (для боссов)
export const DEFAULT_BOSS_ITEMS: ShopItem[] = [
  {
    id: "pajama_home",
    name: "Домашняя пижама",
    type: "Пижама (+1 сек к боссу)",
    cost: 25,
    currency: "watermelons",
    icon: "🏠",
    description: "Мягкая и уютная. Дает немного больше времени, чтобы закликать босса.",
  },
  {
    id: "pajama_forest",
    name: "Лесная пижама",
    type: "Пижама (+5 сек к боссу)",
    cost: 250,
    currency: "watermelons",
    icon: "🌲",
    description: "Сшита из листьев и мха. Боссы путают вас с кустом и атакуют медленнее.",
  },
  {
    id: "pajama_star",
    name: "Звездная пижама",
    type: "Пижама (+15 сек к боссу)",
    cost: 2500,
    currency: "watermelons",
    icon: "⭐",
    description: "Светится в темноте. Ослепляет боссов, давая вам огромное преимущество по времени.",
  },
  {
    id: "tongue_frog",
    name: "Язык лягушки",
    type: "Язык (Урон боссу: 2)",
    cost: 100,
    currency: "watermelons",
    icon: "🐸",
    description: "Длинный и липкий. Позволяет наносить двойной урон при каждом клике по боссу.",
  },
  {
    id: "tongue_anteater",
    name: "Язык муравьеда",
    type: "Язык (Урон боссу: 3)",
    cost: 500,
    currency: "watermelons",
    icon: "🐜",
    description: "Очень длинный и очень липкий. Тройной урон по боссам гарантирован.",
  },
  {
    id: "tongue_chameleon",
    name: "Язык хамелеона",
    type: "Язык (Урон боссу: 4)",
    cost: 5000,
    currency: "watermelons",
    icon: "🦎",
    description: "Молниеносный удар. Четверной урон превращает битвы с боссами в легкую прогулку.",
  },
];

// Базовые фоны страниц (пусто по умолчанию)
export const DEFAULT_PAGE_BACKGROUNDS: Record<string, { url: string; dimming: number }> = {};

// Базовый глобальный фон (пусто по умолчанию)
export const DEFAULT_GLOBAL_BACKGROUND: string | null = null;

// Дефолтные настройки пользователя
export const DEFAULT_SETTINGS = {
  buttonSize: "medium" as const,
  fontFamily: "JetBrains Mono" as const,
  fontSize: 16,
  fontBrightness: 100,
  theme: "normal" as const,
  musicVolume: 50,
  ttsEnabled: false,
};
