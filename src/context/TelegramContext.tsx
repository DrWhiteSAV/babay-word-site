import { createContext, useContext, ReactNode } from "react";
import { useTelegramAuth, TelegramUser, TelegramProfile } from "../hooks/useTelegramAuth";

interface TelegramContextValue {
  telegramUser: TelegramUser | null;
  profile: TelegramProfile | null;
  isLoading: boolean;
}

const TelegramContext = createContext<TelegramContextValue>({
  telegramUser: null,
  profile: null,
  isLoading: true,
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
