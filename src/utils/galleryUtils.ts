import { supabase } from "../integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Saves an image to the gallery via the save-to-gallery Edge Function.
 * The Edge Function handles:
 * 1. Fetching the image blob (avoids CORS on temporary URLs)
 * 2. Re-uploading to ImgBB for a permanent URL (with Supabase Storage fallback)
 * 3. Inserting the record into the gallery table
 * 4. Sending the image to the user's Telegram DM with the prompt as caption
 * 5. For avatars: also inserts into avatars table and updates player_stats
 */
export async function saveImageToGallery(
  imageUrl: string,
  telegramId: number,
  label?: string,
  prompt?: string,
  characterName?: string,
  lore?: string,
  wishes?: string[],
  style?: string,
  gender?: string,
): Promise<string | null> {
  if (!imageUrl || !telegramId) {
    console.warn("[gallery] saveImageToGallery: missing imageUrl or telegramId");
    return null;
  }

  try {
    console.log(`[gallery] → save-to-gallery EF, tgId=${telegramId}, label="${label?.substring(0, 60)}"`);
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/save-to-gallery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        imageUrl,
        telegramId,
        label: label || null,
        prompt: prompt || null,
        characterName: characterName || null,
        lore: lore || null,
        wishes: wishes || [],
        style: style || null,
        gender: gender || null,
      }),
    });

    const data = await resp.json();
    if (data.success) {
      const savedUrl = data.gallery_item?.image_url || data.storage_url || imageUrl;
      console.log(`[gallery] ✅ save-to-gallery ok: ${savedUrl.substring(0, 80)}`);
      return savedUrl as string;
    }

    console.error("[gallery] save-to-gallery error:", data.error);
    return null;
  } catch (e) {
    console.error("[gallery] saveImageToGallery exception:", e);
    return null;
  }
}
