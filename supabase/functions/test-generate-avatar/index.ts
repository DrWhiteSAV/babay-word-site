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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VITE_GEMINI_API_KEY") || "AIzaSyCUCb8uYbhPOJSqKw4TtZrCkdLyVlDDbiE";
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // List ALL models
    if (action === "list_models") {
      const listResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}&pageSize=200`
      );
      const listData = await listResp.json();
      const allModels = listData.models?.map((m: any) => ({ 
        name: m.name, 
        displayName: m.displayName,
        methods: m.supportedGenerationMethods 
      }));
      return new Response(JSON.stringify({ total: allModels?.length, models: allModels }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const telegramId = 169262990;
    const prompt = "A portrait of a Slavic cybernetic spirit named Тест-Бабай. They wear pajamas with spooky appearance and a long tongue. Horror style. High quality portrait.";

    // Use Imagen 3 (generate_images endpoint, not generateContent)
    const imagenResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: "1:1" },
        }),
      }
    );
    const imagenData = await imagenResp.json();
    console.log("Imagen3 status:", imagenResp.status, JSON.stringify(imagenData).substring(0, 200));

    if (imagenResp.ok && imagenData.predictions?.[0]?.bytesBase64Encoded) {
      const imageBase64 = imagenData.predictions[0].bytesBase64Encoded;
      
      // Send via Telegram
      const byteCharacters = atob(imageBase64);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }
      const photoBlob = new Blob([byteArray], { type: "image/png" });
      const formData = new FormData();
      formData.append("chat_id", telegramId.toString());
      formData.append("photo", photoBlob, "babay-gen-test.png");
      formData.append("caption", `🎨 Тест ИИ-генерации Бабая через Imagen 3`);

      const tgResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: "POST", body: formData });
      const tgData = await tgResp.json();

      let finalUrl = "";
      if (tgData.ok) {
        const photos = tgData.result?.photo;
        if (photos?.length > 0) {
          const fileResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${photos[photos.length - 1].file_id}`);
          const fileData = await fileResp.json();
          if (fileData.ok) finalUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
        }
      }
      if (finalUrl) {
        await supabase.from("gallery").insert({ telegram_id: telegramId, image_url: finalUrl, label: "Тест-Бабай (Imagen3)", prompt });
      }
      return new Response(JSON.stringify({ success: true, model: "imagen-3.0-generate-002", telegram_sent: tgData.ok, image_url: finalUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try gemini-2.0-flash-preview-image-generation with v1 (not v1beta)
    const v1Resp = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      }
    );
    const v1Data = await v1Resp.json();
    console.log("v1 model status:", v1Resp.status, JSON.stringify(v1Data).substring(0, 200));

    return new Response(JSON.stringify({ 
      imagen3_error: imagenData.error,
      v1_status: v1Resp.status,
      v1_error: v1Data.error,
      api_key_prefix: GEMINI_API_KEY.substring(0, 10) + "...",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
