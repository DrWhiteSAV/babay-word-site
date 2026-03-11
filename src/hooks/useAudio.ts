import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";

// Stable direct links for background music
export const bgMusics = [
  "https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/babai3.mp3",
  "https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/babai6.mp3",
  "https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/babai9.mp3",
  "https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/babai11.mp3",
  "https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/babai12.mp3",
];

export const menuMusic = "https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/Babaisong.mp3";

export const useAudio = (volume: number) => {
  const location = useLocation();
  const specialAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPathRef = useRef(location.pathname);
  const timeoutRefs = useRef<number[]>([]);

  const clearTimers = () => {
    timeoutRefs.current.forEach((timer) => clearTimeout(timer));
    timeoutRefs.current = [];
  };

  useEffect(() => {
    // Play special sound on transition
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
    const click = new Audio("https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/ZvukButtonCam.MP3");
    click.volume = volume / 100;
    click.play().catch(() => {});
  }, [volume]);

  const playTransition = useCallback(() => {
    const hasInteracted = (navigator as any).userActivation ? (navigator as any).userActivation.hasBeenActive : true;
    if (!hasInteracted) return;
    const whoosh = new Audio("https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/Zvukwhoosh.MP3");
    whoosh.volume = volume / 100;
    whoosh.play().catch(() => {});
  }, [volume]);

  const playSound = useCallback(
    (type: "scream" | "cat" | "fear") => {
      const hasInteracted = (navigator as any).userActivation ? (navigator as any).userActivation.hasBeenActive : true;
      if (!hasInteracted) return;
      if (specialAudioRef.current) {
        specialAudioRef.current.pause();
      }

      const src =
        type === "scream"
          ? "https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/Zvukscream.MP3"
          : type === "cat"
            ? "https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/ZvukMeow.MP3"
            : "https://xupshaktgycrrcfgvcno.supabase.co/storage/v1/object/public/song/Zvukheartbeat.MP3";

      const audio = new Audio(src);
      audio.volume = (volume / 100) * 0.5;
      specialAudioRef.current = audio;
      audio.play().catch(() => {});
    },
    [volume],
  );

  return { playClick, playTransition, playSound };
};
