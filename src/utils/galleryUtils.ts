import { supabase } from "../integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Upload any image URL to ImgBB for permanent hosting. Returns ImgBB URL or null. */
async function reuploadToImgbb(imageUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/upload-to-imgbb`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ imageUrl }),
    });
    const data = await resp.json();
    if (data.success && data.url) {
      console.log("[gallery] reupload to ImgBB ok:", data.url.substring(0, 80));
      return data.url as string;
    }
    console.warn("[gallery] ImgBB reupload failed:", data.error);
    return null;
  } catch (e) {
    console.warn("[gallery] ImgBB reupload exception:", e);
    return null;
  }
}

/**
 * Saves an image to the gallery:
 * 1. Re-uploads to ImgBB for permanent URL (skips if already ImgBB link)
 * 2. Inserts into gallery table directly via Supabase client
 */
export async function saveImageToGallery(
  imageUrl: string,
  telegramId: number,
  label?: string,
  prompt?: string,
  characterName?: string,
  lore?: string,
): Promise<string | null> {
  if (!imageUrl || !telegramId) {
    console.warn("[gallery] saveImageToGallery: missing imageUrl or telegramId");
    return null;
  }

  // Re-upload to ImgBB if it's a temporary URL
  const isImgbb = imageUrl.includes("ibb.co");
  let finalUrl = imageUrl;
  if (!isImgbb) {
    const imgbbUrl = await reuploadToImgbb(imageUrl);
    if (imgbbUrl) {
      finalUrl = imgbbUrl;
    } else {
      console.warn("[gallery] ImgBB failed, saving original URL as fallback");
    }
  }

  try {
    const labelLower = (label || "").toLowerCase();
    const isAvatar = labelLower.includes("[avatars]") || labelLower.includes("[avatar]") || labelLower.includes("аватар");

    let canonicalLabel = label || null;
    if (isAvatar && characterName) {
      const cleanName = characterName.replace(/^Аватар:\s*/i, "").replace(/^\[.*?\]\s*/i, "").trim();
      canonicalLabel = lore
        ? `[avatars] ${cleanName} | ${lore.substring(0, 200)}`
        : `[avatars] ${cleanName}`;
    }

    const { data, error } = await supabase
      .from("gallery")
      .insert({
        telegram_id: telegramId,
        image_url: finalUrl,
        label: canonicalLabel,
        prompt: prompt || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[gallery] insert error:", error);
      return null;
    }

    console.log(`[DB WRITE] 📝 gallery INSERT telegram_id=${telegramId}, label="${canonicalLabel?.substring(0, 80)}", url=${finalUrl.substring(0, 60)}`);
    return data?.image_url || finalUrl;
  } catch (e) {
    console.error("[gallery] saveImageToGallery failed:", e);
    return null;
  }
}
