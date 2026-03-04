// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageUrl, telegramId, label } = await req.json();

    if (!imageUrl || !telegramId) {
      return new Response(JSON.stringify({ error: "imageUrl and telegramId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let finalUrl = imageUrl;

    // If it's a base64 image or external URL, send via Telegram to get a hosted URL
    if (imageUrl.startsWith("data:image") || imageUrl.startsWith("http")) {
      let photoBlob: Blob;

      if (imageUrl.startsWith("data:image")) {
        // Convert base64 to blob
        const base64Data = imageUrl.split(",")[1];
        const byteCharacters = atob(base64Data);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteArray[i] = byteCharacters.charCodeAt(i);
        }
        photoBlob = new Blob([byteArray], { type: "image/png" });
      } else {
        // Fetch external URL
        const imgResp = await fetch(imageUrl);
        photoBlob = await imgResp.blob();
      }

      // Send photo to user via Telegram bot
      const formData = new FormData();
      formData.append("chat_id", telegramId.toString());
      formData.append("photo", photoBlob, "gallery.png");
      if (label) formData.append("caption", `🖼 ${label}`);

      const tgResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        body: formData,
      });

      const tgData = await tgResp.json();

      if (!tgData.ok) {
        console.error("Telegram sendPhoto error:", tgData);
        // Fall back to saving the original URL if sending to Telegram fails
        finalUrl = imageUrl.startsWith("data:image") ? imageUrl : imageUrl;
      } else {
        // Get the highest-res file_id from the photo array
        const photos = tgData.result?.photo;
        if (photos && photos.length > 0) {
          const biggestPhoto = photos[photos.length - 1];
          
          // Get file path from Telegram
          const fileResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${biggestPhoto.file_id}`);
          const fileData = await fileResp.json();
          
          if (fileData.ok && fileData.result?.file_path) {
            finalUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
          }
        }
      }
    }

    // Save to gallery table in Supabase
    const { data, error } = await supabase
      .from("gallery")
      .insert({
        telegram_id: telegramId,
        image_url: finalUrl,
        label: label || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase gallery insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, gallery_item: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("save-to-gallery error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
