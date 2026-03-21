import { useEffect, useRef, useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";

// Fallback defaults (used until DB loads)
export const bgMusics = [
  "https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/babai3.mp3",
  "https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/babai6.mp3",
  "https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/babai9.mp3",
  "https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/babai11.mp3",
  "https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/babai12.mp3",
];

export const menuMusic = "https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/Babaisong.mp3";

// Pick random from array
const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

// Global cache so we don't refetch every mount
let audioSettingsCache: Record<string, string[]> | null = null;
let audioSettingsPromise: Promise<Record<string, string[]>> | null = null;

async function loadAudioSettings(): Promise<Record<string, string[]>> {
  if (audioSettingsCache) return audioSettingsCache;
  if (audioSettingsPromise) return audioSettingsPromise;

  audioSettingsPromise = (async () => {
    const { data } = await supabase.from("audio_settings").select("key, value, sort_order").order("sort_order");
    const map: Record<string, string[]> = {};
    if (data) {
      data.forEach((r) => {
        if (!map[r.key]) map[r.key] = [];
        if (r.value) map[r.key].push(r.value);
      });
    }
    audioSettingsCache = map;
    return map;
  })();

  return audioSettingsPromise;
}

function getUrls(settings: Record<string, string[]> | null, key: string, fallback: string[]): string[] {
  if (settings && settings[key] && settings[key].length > 0) return settings[key];
  return fallback;
}

export const useAudio = (masterVolume: number, volumeClicks?: number, volumeTransitions?: number, volumeBgSounds?: number) => {
  const clickVol = volumeClicks ?? masterVolume;
  const transVol = volumeTransitions ?? masterVolume;
  const bgSoundVol = volumeBgSounds ?? masterVolume;
  const location = useLocation();
  const specialAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPathRef = useRef(location.pathname);
  const timeoutRefs = useRef<number[]>([]);
  const [dbAudio, setDbAudio] = useState<Record<string, string[]> | null>(audioSettingsCache);

  useEffect(() => {
    loadAudioSettings().then(setDbAudio);
  }, []);

  const clearTimers = () => {
    timeoutRefs.current.forEach((timer) => clearTimeout(timer));
    timeoutRefs.current = [];
  };

  useEffect(() => {
    if (lastPathRef.current !== location.pathname) {
      clearTimers();

      const pathSounds: Record<string, "scream" | "cat" | "fear"> = {
        "/game": "scream",
        "/hub": "cat",
        "/profile": "fear",
        "/shop": "fear",
        "/settings": "cat",
        "/friends": "cat",
        "/chat": "fear",
        "/gallery": "cat",
        "/create": "scream",
      };

      const specialSound = pathSounds[location.pathname] || "fear";

      const t1 = window.setTimeout(() => {
        playTransition();
        const t2 = window.setTimeout(() => {
          playSound(specialSound);
        }, 400);
        timeoutRefs.current.push(t2);
      }, 150);

      timeoutRefs.current.push(t1);
      lastPathRef.current = location.pathname;
    }

    return () => clearTimers();
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      clearTimers();
      if (specialAudioRef.current) {
        specialAudioRef.current.pause();
        specialAudioRef.current = null;
      }
    };
  }, []);

  const playClick = useCallback(() => {
    const hasInteracted = (navigator as any).userActivation ? (navigator as any).userActivation.hasBeenActive : true;
    if (!hasInteracted) return;
    const urls = getUrls(dbAudio, "click", [
      "https://psuvnvqvspqibsezcrny.supabase.co/storage/v1/object/public/SongBabai/Zvukclick.MP3",
    ]);
    const click = new Audio(pickRandom(urls));
    click.volume = volume / 100;
    click.play().catch(() => {});
  }, [volume, dbAudio]);

  const playTransition = useCallback(() => {
    const hasInteracted = (navigator as any).userActivation ? (navigator as any).userActivation.hasBeenActive : true;
    if (!hasInteracted) return;
    const urls = getUrls(dbAudio, "transition", [
      "https://psuvnvqvspqibsezcrny.supabase.co/storage/v1/object/public/SongBabai/Zvukswoosh.MP3",
    ]);
    const whoosh = new Audio(pickRandom(urls));
    whoosh.volume = volume / 100;
    whoosh.play().catch(() => {});
  }, [volume, dbAudio]);

  const playSound = useCallback(
    (type: "scream" | "cat" | "fear") => {
      const hasInteracted = (navigator as any).userActivation ? (navigator as any).userActivation.hasBeenActive : true;
      if (!hasInteracted) return;
      if (specialAudioRef.current) {
        specialAudioRef.current.pause();
      }

      const fallbackMap: Record<string, string[]> = {
        scream: ["https://psuvnvqvspqibsezcrny.supabase.co/storage/v1/object/public/SongBabai/Zvukscream.MP3"],
        cat: ["https://psuvnvqvspqibsezcrny.supabase.co/storage/v1/object/public/SongBabai/ZvukMeow.MP3"],
        fear: ["https://psuvnvqvspqibsezcrny.supabase.co/storage/v1/object/public/SongBabai/Zvukheartbeat.MP3"],
      };

      const urls = getUrls(dbAudio, type, fallbackMap[type]);
      const audio = new Audio(pickRandom(urls));
      audio.volume = (volume / 100) * 0.5;
      specialAudioRef.current = audio;
      audio.play().catch(() => {});
    },
    [volume, dbAudio],
  );

  // Expose loaded DB audio for bgMusic usage in App.tsx
  const getMenuMusicUrls = useCallback(() => {
    return getUrls(dbAudio, "menuMusic", [menuMusic]);
  }, [dbAudio]);

  const getBgMusicUrls = useCallback(() => {
    const allBg: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const key = `bgMusic${i}`;
      const urls = dbAudio?.[key];
      if (urls && urls.length > 0) allBg.push(...urls);
    }
    return allBg.length > 0 ? allBg : bgMusics;
  }, [dbAudio]);

  return { playClick, playTransition, playSound, getMenuMusicUrls, getBgMusicUrls };
};
