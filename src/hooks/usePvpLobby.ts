import { useState, useEffect, useRef } from "react";
import { supabase } from "../integrations/supabase/client";

export interface PvpLobbyRoom {
  id: string;
  difficulty: string;
  status: string;
  organizer_telegram_id: number;
  started_at: string | null;
  timer_ends_at: string | null;
}

export interface PvpLobbyMember {
  telegram_id: number;
  character_name: string | null;
  avatar_url: string | null;
  status: string;
  score: number;
  finished_at: string | null;
}

export interface PvpLobbyData {
  room: PvpLobbyRoom;
  members: PvpLobbyMember[];
  myStatus: string;
}

/** Returns the active PVP room (waiting/playing) for the current user, if any. */
export function usePvpLobby(tgId: number | undefined): PvpLobbyData | null {
  const [lobby, setLobby] = useState<PvpLobbyData | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLobby = async () => {
    if (!tgId) return;

    // Find any active membership for this user
    const { data: memberships } = await supabase
      .from("pvp_room_members")
      .select("room_id, status")
      .eq("telegram_id", tgId)
      .in("status", ["invited", "joined", "playing", "finished"]);

    if (!memberships || memberships.length === 0) {
      setLobby(null);
      return;
    }

    // Prefer rooms that are active (waiting/playing), then finished
    const roomIds = memberships.map(m => m.room_id);
    const { data: rooms } = await supabase
      .from("pvp_rooms")
      .select("*")
      .in("id", roomIds)
      .in("status", ["waiting", "playing", "finished"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (!rooms || rooms.length === 0) {
      setLobby(null);
      return;
    }

    const room = rooms[0] as PvpLobbyRoom;

    const { data: members } = await supabase
      .from("pvp_room_members")
      .select("telegram_id, character_name, avatar_url, status, score, finished_at")
      .eq("room_id", room.id);

    const myMember = (members || []).find(m => m.telegram_id === tgId);

    setLobby({
      room,
      members: (members || []) as PvpLobbyMember[],
      myStatus: myMember?.status || "invited",
    });
  };

  useEffect(() => {
    if (!tgId) return;
    fetchLobby();

    // Realtime updates
    const channel = supabase
      .channel(`pvp_lobby_${tgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pvp_rooms" }, fetchLobby)
      .on("postgres_changes", { event: "*", schema: "public", table: "pvp_room_members" }, fetchLobby)
      .subscribe();

    // Polling fallback every 5s
    pollRef.current = setInterval(fetchLobby, 5000);

    return () => {
      supabase.removeChannel(channel);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [tgId]);

  return lobby;
}
