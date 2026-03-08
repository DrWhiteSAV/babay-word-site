import { supabase } from "../integrations/supabase/client";

/**
 * Saves an image URL directly to the gallery table in Supabase.
 * Direct DB insert — no edge function needed for non-avatar images.
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
        image_url: imageUrl,
        label: canonicalLabel,
        prompt: prompt || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[gallery] insert error:", error);
      return null;
    }

    console.log(`[DB WRITE] 📝 gallery INSERT telegram_id=${telegramId}, label="${canonicalLabel?.substring(0, 80)}"`);
    return data?.image_url || imageUrl;
  } catch (e) {
    console.error("[gallery] saveImageToGallery failed:", e);
    return null;
  }
}
