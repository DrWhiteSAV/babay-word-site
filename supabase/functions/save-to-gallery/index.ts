// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Upload image to ImgBB and return direct URL */
async function uploadToImgbb(imageBlob: Blob): Promise<string | null> {
  const IMGBB_KEY = Deno.env.get("IMGBB_API_KEY");
  if (!IMGBB_KEY) {
    console.warn("[save-to-gallery] IMGBB_API_KEY not set, skipping ImgBB upload");
    return null;
  }
  try {
    // Convert blob to base64
    const arrayBuffer = await imageBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const form = new FormData();
    form.append("key", IMGBB_KEY);
    form.append("image", base64);

    const resp = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: form,
    });
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
    const { imageUrl, telegramId, label, prompt, lore } = await req.json();

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

    // 2. Upload to ImgBB — primary stable URL for profiles & gallery
    const imgbbUrl = await uploadToImgbb(photoBlob);

    // 3. Fallback to Supabase Storage if ImgBB fails
    let storageUrl: string | null = null;
    if (!imgbbUrl) {
      const fileName = `${telegramId}/${Date.now()}.png`;
      console.log(`[save-to-gallery] falling back to supabase storage: avatars/${fileName}`);
      const { error: storageError } = await supabase.storage
        .from("avatars")
        .upload(fileName, photoBlob, { contentType: "image/png", upsert: false });
      if (!storageError) {
        const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
        storageUrl = publicUrlData?.publicUrl || null;
      } else {
        console.error("[save-to-gallery] storage upload error:", storageError);
      }
    }

    const finalUrl = imgbbUrl || storageUrl || imageUrl;
    console.log(`[save-to-gallery] finalUrl: ${finalUrl}`);

    // 4. Update player_stats avatar_url
    if (label?.startsWith("Аватар:") || label?.startsWith("Avatar:")) {
      const { error: statsError } = await supabase
        .from("player_stats")
        .update({ avatar_url: finalUrl })
        .eq("telegram_id", telegramId);
      if (statsError) console.error("[save-to-gallery] player_stats update error:", statsError);
    }

    // 5. Save to gallery table (always)
    const { data, error } = await supabase
      .from("gallery")
      .insert({
        telegram_id: telegramId,
        image_url: finalUrl,
        label: label || null,
        prompt: prompt || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[save-to-gallery] gallery insert error:", error);
      // Don't fail entirely — still send TG message
    }

    // 6. Send to Telegram (non-blocking — don't fail if missing token)
    if (BOT_TOKEN) {
      const caption = lore
        ? `🧟 *${label || "Аватар Бабая"}*\n\n${lore.substring(0, 900)}`
        : `🖼 ${label || "Бабай"}`;

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
      if (!tgData.ok) console.error("[save-to-gallery] TG error:", JSON.stringify(tgData));
    } else {
      console.warn("[save-to-gallery] TELEGRAM_BOT_TOKEN not set — skipping TG delivery");
    }

    console.log(`[save-to-gallery] done! finalUrl=${finalUrl}`);
    return new Response(JSON.stringify({
      success: true,
      gallery_item: data || { image_url: finalUrl },
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
