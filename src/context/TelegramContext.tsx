import { createContext, useContext, ReactNode } from "react";
import { useTelegramAuth, TelegramUser, TelegramProfile, EntryMode } from "../hooks/useTelegramAuth";

interface TelegramContextValue {
  telegramUser: TelegramUser | null;
  profile: TelegramProfile | null;
  isLoading: boolean;
  entryMode: EntryMode;
}

const TelegramContext = createContext<TelegramContextValue>({
  telegramUser: null,
  profile: null,
  isLoading: true,
  entryMode: "browser",
});

export function TelegramProvider({ children }: { children: ReactNode }) {
  const value = useTelegramAuth();
  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}
