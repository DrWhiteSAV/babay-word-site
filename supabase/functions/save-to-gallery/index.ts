// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function uploadToImgbb(imageBlob: Blob): Promise<string | null> {
  const IMGBB_KEY = Deno.env.get("IMGBB_API_KEY");
  if (!IMGBB_KEY) {
    console.warn("[save-to-gallery] IMGBB_API_KEY not set");
    return null;
  }
  try {
    const arrayBuffer = await imageBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const form = new FormData();
    form.append("key", IMGBB_KEY);
    form.append("image", base64);

    const resp = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: form });
    const data = await resp.json();
    if (data.success && data.data?.url) {
      console.log(`[save-to-gallery] ImgBB url: ${data.data.url}`);
      return data.data.url as string;
    }
    console.error("[save-to-gallery] ImgBB upload failed:", JSON.stringify(data));
    return null;
  } catch (e) {
    console.error("[save-to-gallery] ImgBB exception:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageUrl, telegramId, label, prompt, lore, characterName, wishes, style, gender } = await req.json();

    if (!imageUrl || !telegramId) {
      return new Response(JSON.stringify({ error: "imageUrl and telegramId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch image blob
    console.log(`[save-to-gallery] fetching image: ${imageUrl.substring(0, 80)}`);
    let photoBlob: Blob;
    if (imageUrl.startsWith("data:image")) {
      const base64Data = imageUrl.split(",")[1];
      const byteCharacters = atob(base64Data);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i);
      photoBlob = new Blob([byteArray], { type: "image/png" });
    } else {
      const imgResp = await fetch(imageUrl);
      if (!imgResp.ok) throw new Error(`Failed to fetch image: ${imgResp.status}`);
      photoBlob = await imgResp.blob();
    }

    // 2. Upload to ImgBB
    const imgbbUrl = await uploadToImgbb(photoBlob);

    // 3. Fallback to Supabase Storage
    let storageUrl: string | null = null;
    if (!imgbbUrl) {
      const fileName = `${telegramId}/${Date.now()}.png`;
      const { error: storageError } = await supabase.storage
        .from("avatars")
        .upload(fileName, photoBlob, { contentType: "image/png", upsert: false });
      if (!storageError) {
        const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
        storageUrl = publicUrlData?.publicUrl || null;
      }
    }

    const finalUrl = imgbbUrl || storageUrl || imageUrl;
    console.log(`[save-to-gallery] finalUrl: ${finalUrl}`);

    // 4. Determine if this is an avatar image
    const labelLower = (label || "").toLowerCase();
    const isAvatar = labelLower.includes("[avatars]") || labelLower.includes("[avatar]") || labelLower.includes("аватар") || labelLower.includes("avatar");

    // Clean character name (remove any legacy prefixes)
    const cleanName = (characterName || "")
      .replace(/^Аватар:\s*/i, "")
      .replace(/^\[.*?\]\s*/i, "")
      .trim();

    // Build canonical label: "[avatars] Name | Lore"
    // This format allows Gallery to parse name and lore from the label
    let canonicalLabel = label || null;
    if (isAvatar && cleanName) {
      canonicalLabel = lore
        ? `[avatars] ${cleanName} | ${lore.substring(0, 200)}`
        : `[avatars] ${cleanName}`;
      console.log(`[save-to-gallery] canonical label: ${canonicalLabel.substring(0, 100)}`);
    }

    // 5. Save to gallery table
    const { data: galleryItem, error: galleryError } = await supabase
      .from("gallery")
      .insert({
        telegram_id: telegramId,
        image_url: finalUrl,
        label: canonicalLabel,
        prompt: prompt || null,
      })
      .select()
      .single();

    if (galleryError) console.error("[save-to-gallery] gallery insert error:", galleryError);
    else console.log(`[DB WRITE] 📝 gallery INSERT for telegram_id=${telegramId}, label="${canonicalLabel?.substring(0, 80)}"`);

    // 6. If avatar — save to avatars table AND update player_stats identity fields
    if (isAvatar && cleanName) {
      // Save to avatars table
      const wishesArray = Array.isArray(wishes) ? wishes : [];
      const { error: avatarTableError } = await supabase
        .from("avatars")
        .insert({
          telegram_id: telegramId,
          image_url: finalUrl,
          name: cleanName,
          lore: lore || null,
          wishes: wishesArray,
          style: style || null,
          gender: gender || null,
          gallery_item_id: galleryItem?.id || null,
        });

      if (avatarTableError) {
        console.error("[save-to-gallery] avatars table insert error:", avatarTableError);
      } else {
        console.log(`[DB WRITE] 📝 avatars INSERT for telegram_id=${telegramId}, name="${cleanName}"`);
      }

      // Update player_stats: ONLY identity fields (avatar_url, character_name, lore, style, gender)
      // NEVER touch custom_settings here — that belongs only to the Settings page
      const statsUpdate: Record<string, unknown> = { avatar_url: finalUrl };
      statsUpdate.character_name = cleanName;
      if (lore && lore.trim()) statsUpdate.lore = lore.trim();
      if (style) statsUpdate.character_style = style;
      if (gender) statsUpdate.character_gender = gender;

      const { error: statsError } = await supabase
        .from("player_stats")
        .update(statsUpdate)
        .eq("telegram_id", telegramId);

      if (statsError) {
        console.error("[save-to-gallery] player_stats update error:", statsError);
      } else {
        console.log(`[DB WRITE] 📝 player_stats UPDATE identity for telegram_id=${telegramId}:`, Object.keys(statsUpdate).join(", "));
      }
      // NOTE: custom_settings (including wishes) is intentionally NOT updated here.
      // wishes are stored in the avatars table and applied only when user picks an avatar in Gallery.
    }

    // 7. Send to Telegram
    if (BOT_TOKEN) {
      const displayName = cleanName || (label || "Бабай").replace(/^\[.*?\]\s*/i, "").replace(/^Аватар:\s*/i, "");
      const caption = lore
        ? `🧟 *${displayName}*\n\n${lore.substring(0, 900)}`
        : `🖼 ${displayName}`;

      const formData = new FormData();
      formData.append("chat_id", telegramId.toString());
      formData.append("photo", photoBlob, "image.png");
      formData.append("caption", caption);
      formData.append("parse_mode", "Markdown");

      const tgResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        body: formData,
      });
      const tgData = await tgResp.json();
      console.log(`[save-to-gallery] telegram sendPhoto ok=${tgData.ok}`);
    }

    return new Response(JSON.stringify({
      success: true,
      gallery_item: galleryItem || { image_url: finalUrl },
      storage_url: finalUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[save-to-gallery] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
