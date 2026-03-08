import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { useTelegram } from "../context/TelegramContext";

// Online presence disabled — online_at column doesn't exist in profiles table
export function useOnlinePresence() {
  // No-op: column online_at not in schema
}

// Check if a friend is online — disabled since column doesn't exist
export function useFriendOnlineStatus(friendTelegramIds: number[]) {
  const [onlineMap] = useState<Record<number, boolean>>({});
  return onlineMap;
}
