/**
 * ProTalk AI service — routes all AI requests through the protalk-ai edge function.
 * Supports text generation (chat, names, lore) and image generation (avatar, background, boss).
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROTALK_FN = `${SUPABASE_URL}/functions/v1/protalk-ai`;

async function callProTalk(
  type: "text" | "image",
  prompt: string,
  telegramId?: number,
): Promise<{ text: string; imageUrl?: string | null }> {
  const resp = await fetch(PROTALK_FN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ type, prompt, telegramId }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`protalk-ai error: ${resp.status} - ${err}`);
  }

  const data = await resp.json();
  if (!data.success) throw new Error(data.error || "ProTalk failed");
  return { text: data.text, imageUrl: data.imageUrl };
}

export async function protalkGenerateText(prompt: string, telegramId?: number): Promise<string> {
  const { text } = await callProTalk("text", prompt, telegramId);
  return text;
}

export async function protalkGenerateImage(
  prompt: string,
  telegramId?: number,
): Promise<{ url: string; prompt: string }> {
  const { text, imageUrl } = await callProTalk("image", prompt, telegramId);
  return {
    url: imageUrl || text, // if bot returns URL in text field
    prompt,
  };
}
