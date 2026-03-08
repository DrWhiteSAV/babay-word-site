import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_STORE_CONFIG,
  DEFAULT_GALLERY_IMAGES,
  DEFAULT_VERTICAL_VIDEOS,
  DEFAULT_HORIZONTAL_VIDEOS,
  DEFAULT_SHOP_ITEMS,
  DEFAULT_BOSS_ITEMS,
  DEFAULT_PAGE_BACKGROUNDS,
  DEFAULT_GLOBAL_BACKGROUND
} from "../config/defaultSettings";

export type Gender = "Бабай" | "Бабайка";
export type Style =
  | "Фотореализм"
  | "Хоррор"
  | "Стимпанк"
  | "Киберпанк"
  | "Аниме"
  | "Постсоветский"
  | "Русская сказка"
  | "2D мультфильм"
  | "Фентези деревня";
export type ButtonSize = "small" | "medium" | "large";
export type FontFamily = 
  | "Inter" 
  | "Roboto"
  | "Montserrat"
  | "Playfair Display" 
  | "JetBrains Mono" 
  | "Press Start 2P" 
  | "Russo One"
  | "Rubik Beastly"
  | "Rubik Burned"
  | "Rubik Glitch"
  | "Neucha"
  | "Ruslan Display"
  | "Tektur";
export type Theme = "normal" | "cyberpunk";

export interface Character {
  name: string;
  gender: Gender;
  style: Style;
  wishes: string[];
  avatarUrl: string;
  telekinesisLevel: number;
  lore?: string;
}

export interface Friend {
  name: string;
  isAiEnabled: boolean;
}

export interface GroupChat {
  id: string;
  name: string;
  members: string[];
}

export interface Quest {
  id: string;
  type: 'daily' | 'global';
  title: string;
  description: string;
  reward: { type: 'fear' | 'energy' | 'watermelons'; amount: number };
  completed: boolean;
  progress: number;
  target: number;
}

export interface ShopItem {
  id: string;
  name: string;
  type: string;
  cost: number;
  currency: string;
  icon: string;
  description: string;
}

export interface StoreConfig {
  telekinesisBaseCost: number;
  telekinesisCostMultiplier: number;
  telekinesisRewardBonus: number;
  bossBaseCost: number;
  bossCostMultiplier: number;
  bossRewardBase: number;
  bossRewardMultiplier: number;
  energyRegenMinutes: number;
}

export interface PlayerState {
  character: Character | null;
  fear: number;
  energy: number;
  watermelons: number;
  bossLevel: number;
  lastEnergyUpdate: number;
  inventory: string[];
  // gallery is only used for profile page preview - real gallery comes from DB
  gallery: string[];
  achievements: string[];
  friends: Friend[];
  groupChats: GroupChat[];
  quests: Quest[];
  settings: {
    buttonSize: ButtonSize;
    fontFamily: FontFamily;
    fontSize: number;
    fontBrightness: number;
    theme: Theme;
    musicVolume: number;
    ttsEnabled: boolean;
  };
  globalBackgroundUrl: string | null;
  pageBackgrounds: Record<string, { url: string; dimming: number }>;
  videoCutscenes: {
    vertical: string[];
    horizontal: string[];
  };
  shopItems: ShopItem[];
  bossItems: ShopItem[];
  storeConfig: StoreConfig;
  // Flag: DB has been loaded - prevents stale localStorage from overwriting
  dbLoaded: boolean;
  setCharacter: (char: Character) => void;
  updateCharacter: (updates: Partial<Character>) => void;
  addFear: (amount: number) => void;
  spendFear: (amount: number) => boolean;
  useEnergy: (amount: number) => boolean;
  addEnergy: (amount: number) => void;
  addWatermelons: (amount: number) => void;
  spendWatermelons: (amount: number) => boolean;
  updateEnergy: () => void;
  updateSettings: (settings: Partial<PlayerState["settings"]>) => void;
  setGlobalBackgroundUrl: (url: string) => void;
  setPageBackground: (page: string, url: string, dimming: number) => void;
  buyItem: (item: string, cost: number, currency?: 'fear' | 'watermelons') => boolean;
  addToGallery: (url: string) => void;
  upgradeTelekinesis: (cost: number) => boolean;
  upgradeBossLevel: (cost: number) => boolean;
  addAchievement: (id: string) => void;
  addFriend: (name: string) => void;
  deleteFriend: (name: string) => void;
  toggleFriendAi: (name: string) => void;
  createGroupChat: (name: string, members: string[]) => void;
  updateGroupMembers: (id: string, members: string[]) => void;
  updateGroupName: (id: string, name: string) => void;
  deleteGroupChat: (id: string) => void;
  completeQuest: (id: string) => void;
  updateQuestProgress: (id: string, amount: number) => void;
  setVideoCutscenes: (vertical: string[], horizontal: string[]) => void;
  updateStoreConfig: (config: Partial<StoreConfig>) => void;
  updateShopItem: (id: string, updates: Partial<ShopItem>) => void;
  updateBossItem: (id: string, updates: Partial<ShopItem>) => void;
}

const DEFAULT_SETTINGS = {
  buttonSize: "small" as ButtonSize,
  fontFamily: "JetBrains Mono" as FontFamily,
  fontSize: 12,
  fontBrightness: 100,
  theme: "normal" as Theme,
  musicVolume: 50,
  ttsEnabled: false,
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      // Character + stats: NOT persisted via localStorage — loaded from DB
      character: null,
      fear: 0,
      energy: 100,
      watermelons: 0,
      bossLevel: 1,
      lastEnergyUpdate: Date.now(),
      inventory: [],
      gallery: DEFAULT_GALLERY_IMAGES,
      achievements: [],
      friends: [{ name: "ДанИИл", isAiEnabled: true }],
      groupChats: [],
      quests: [
        { id: 'q1', type: 'daily', title: 'Первый испуг', description: 'Выгони 5 жильцов', reward: { type: 'fear', amount: 50 }, completed: false, progress: 0, target: 5 },
        { id: 'q2', type: 'daily', title: 'Сборщик дани', description: 'Собери 3 арбуза', reward: { type: 'watermelons', amount: 3 }, completed: false, progress: 0, target: 3 },
        { id: 'q3', type: 'global', title: 'Арбузный магнат', description: 'Победи босса', reward: { type: 'watermelons', amount: 15 }, completed: false, progress: 0, target: 1 },
        { id: 'q4', type: 'global', title: 'Мастер телекинеза', description: 'Прокачай телекинез до 5 уровня', reward: { type: 'energy', amount: 100 }, completed: false, progress: 0, target: 5 }
      ],
      settings: { ...DEFAULT_SETTINGS },
      globalBackgroundUrl: DEFAULT_GLOBAL_BACKGROUND,
      pageBackgrounds: DEFAULT_PAGE_BACKGROUNDS,
      videoCutscenes: {
        vertical: DEFAULT_VERTICAL_VIDEOS,
        horizontal: DEFAULT_HORIZONTAL_VIDEOS,
      },
      shopItems: DEFAULT_SHOP_ITEMS,
      bossItems: DEFAULT_BOSS_ITEMS,
      storeConfig: DEFAULT_STORE_CONFIG,
      dbLoaded: false,
      setCharacter: (char) => {
        set({ character: char });
      },
      updateCharacter: (updates) => {
        const { character } = get();
        if (character) set({ character: { ...character, ...updates } });
      },
      addFear: (amount) => set((state) => ({ fear: state.fear + amount })),
      spendFear: (amount) => {
        const { fear } = get();
        if (fear >= amount) {
          set({ fear: fear - amount });
          return true;
        }
        return false;
      },
      useEnergy: (amount) => {
        const { energy } = get();
        if (energy >= amount) {
          set({ energy: energy - amount });
          return true;
        }
        return false;
      },
      addEnergy: (amount) => set((state) => ({ energy: state.energy + amount })),
      addWatermelons: (amount) => set((state) => ({ watermelons: state.watermelons + amount })),
      spendWatermelons: (amount) => {
        const { watermelons } = get();
        if (watermelons >= amount) {
          set({ watermelons: watermelons - cost });
          return true;
        }
        return false;
      },
      updateEnergy: () => {
        const { energy, lastEnergyUpdate, storeConfig } = get();
        const now = Date.now();
        const diff = now - lastEnergyUpdate;
        const regenRateMs = (storeConfig?.energyRegenMinutes || 5) * 60 * 1000;
        const energyToAdd = Math.floor(diff / regenRateMs);

        if (energyToAdd > 0) {
          set({
            energy: energy + energyToAdd,
            lastEnergyUpdate: now - (diff % regenRateMs),
          });
        }
      },
      updateSettings: (newSettings) =>
        set((state) => {
          const updated = { ...state.settings, ...newSettings };
          if (newSettings.theme === "cyberpunk" && state.settings.theme !== "cyberpunk") {
            updated.fontFamily = "Tektur";
          } else if (newSettings.theme === "normal" && state.settings.theme !== "normal") {
            updated.fontFamily = "JetBrains Mono";
          }
          return { settings: updated };
        }),
      setGlobalBackgroundUrl: (url) => set({ globalBackgroundUrl: url }),
      setPageBackground: (page, url, dimming) => set((state) => ({
        pageBackgrounds: {
          ...state.pageBackgrounds,
          [page]: { url, dimming }
        }
      })),
      setVideoCutscenes: (vertical, horizontal) => set({
        videoCutscenes: { vertical, horizontal }
      }),
      updateStoreConfig: (config) => set((state) => ({
        storeConfig: { ...state.storeConfig, ...config }
      })),
      updateShopItem: (id, updates) => set((state) => ({
        shopItems: state.shopItems.map(item => item.id === id ? { ...item, ...updates } : item)
      })),
      updateBossItem: (id, updates) => set((state) => ({
        bossItems: state.bossItems.map(item => item.id === id ? { ...item, ...updates } : item)
      })),
      buyItem: (item, cost, currency = 'fear') => {
        const { fear, watermelons, inventory } = get();
        if (inventory.includes(item)) return false;

        if (currency === 'fear' && fear >= cost) {
          set({ fear: fear - cost, inventory: [...inventory, item] });
          return true;
        } else if (currency === 'watermelons' && watermelons >= cost) {
          set({ watermelons: watermelons - cost, inventory: [...inventory, item] });
          return true;
        }
        return false;
      },
      addToGallery: (url) => {
        const { gallery } = get();
        if (typeof url === "string" && url.startsWith("http") && !gallery.includes(url)) {
          set({ gallery: [url, ...gallery].slice(0, 12) });
        }
      },
      upgradeTelekinesis: (cost) => {
        const { fear, character } = get();
        if (character && fear >= cost) {
          set({
            fear: fear - cost,
            character: {
              ...character,
              telekinesisLevel: character.telekinesisLevel + 1,
            },
          });
          return true;
        }
        return false;
      },
      upgradeBossLevel: (cost) => {
        const { watermelons, bossLevel } = get();
        if (watermelons >= cost) {
          set({
            watermelons: watermelons - cost,
            bossLevel: bossLevel + 1,
          });
          return true;
        }
        return false;
      },
      addAchievement: (id) => {
        const { achievements } = get();
        if (!achievements.includes(id)) {
          set({ achievements: [...achievements, id] });
        }
      },
      addFriend: (name) => {
        const { friends } = get();
        if (!friends.find(f => f.name === name)) {
          set({ friends: [...friends, { name, isAiEnabled: name === "ДанИИл" }] });
        }
      },
      deleteFriend: (name) => {
        const { friends } = get();
        set({ friends: friends.filter(f => f.name !== name) });
      },
      toggleFriendAi: (name) => {
        const { friends } = get();
        set({
          friends: friends.map(f => f.name === name ? { ...f, isAiEnabled: !f.isAiEnabled } : f)
        });
      },
      createGroupChat: (name, members) => {
        const { groupChats } = get();
        const finalMembers = members.includes("ДанИИл") ? members : [...members, "ДанИИл"];
        set({ groupChats: [...groupChats, { id: Date.now().toString(), name, members: finalMembers }] });
      },
      updateGroupMembers: (id, members) => {
        const { groupChats } = get();
        const finalMembers = members.includes("ДанИИл") ? members : [...members, "ДанИИл"];
        set({
          groupChats: groupChats.map(g => g.id === id ? { ...g, members: finalMembers } : g)
        });
      },
      updateGroupName: (id, name) => {
        const { groupChats } = get();
        set({
          groupChats: groupChats.map(g => g.id === id ? { ...g, name } : g)
        });
      },
      deleteGroupChat: (id) => {
        const { groupChats } = get();
        set({
          groupChats: groupChats.filter(g => g.id !== id)
        });
      },
      completeQuest: (id) => {
        const { quests, addFear, addEnergy, addWatermelons, addAchievement } = get();
        const quest = quests.find(q => q.id === id);
        if (quest && !quest.completed && quest.progress >= quest.target) {
          set({ quests: quests.map(q => q.id === id ? { ...q, completed: true } : q) });
          if (quest.reward.type === 'fear') addFear(quest.reward.amount);
          if (quest.reward.type === 'energy') addEnergy(quest.reward.amount);
          if (quest.reward.type === 'watermelons') addWatermelons(quest.reward.amount);
          addAchievement(`quest_${id}`);
        }
      },
      updateQuestProgress: (id, amount) => {
        const { quests } = get();
        set({
          quests: quests.map(q => {
            if (q.id === id && !q.completed) {
              const newProgress = Math.min(q.progress + amount, q.target);
              return { ...q, progress: newProgress };
            }
            return q;
          })
        });
      }
    }),
    {
      name: "babai-ui-prefs",
      // Only persist UI preferences and non-critical fields, NOT character/stats
      // Character + stats are always loaded from DB on mount
      partialize: (state) => ({
        settings: state.settings,
        friends: state.friends,
        groupChats: state.groupChats,
        shopItems: state.shopItems,
        bossItems: state.bossItems,
        storeConfig: state.storeConfig,
        videoCutscenes: state.videoCutscenes,
        pageBackgrounds: state.pageBackgrounds,
        globalBackgroundUrl: state.globalBackgroundUrl,
        quests: state.quests,
      }),
    },
  ),
);
