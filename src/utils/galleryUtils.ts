/**
 * Saves an image to the gallery via the Telegram bot edge function.
 * The image is sent to the user's Telegram chat, and the hosted URL is saved to Supabase.
 */
export async function saveImageToGallery(
  imageUrl: string,
  telegramId: number,
  label?: string,
  prompt?: string
): Promise<string | null> {
  try {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/save-to-gallery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ imageUrl, telegramId, label, prompt }),
    });

    const data = await resp.json();
    if (data.success && data.gallery_item?.image_url) {
      return data.gallery_item.image_url;
    }
    console.error("saveImageToGallery error:", data.error);
    return null;
  } catch (e) {
    console.error("saveImageToGallery failed:", e);
    return null;
  }
}
