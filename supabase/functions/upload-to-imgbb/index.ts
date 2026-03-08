// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const IMGBB_KEY = Deno.env.get("IMGBB_API_KEY");
    if (!IMGBB_KEY) {
      return new Response(JSON.stringify({ error: "IMGBB_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64, imageUrl } = await req.json();

    let base64Data: string;

    if (imageBase64) {
      // Strip data URI prefix if present
      base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
    } else if (imageUrl) {
      // Fetch URL and convert to base64
      const resp = await fetch(imageUrl);
      if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
      const blob = await resp.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      base64Data = btoa(binary);
    } else {
      return new Response(JSON.stringify({ error: "imageBase64 or imageUrl required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const form = new FormData();
    form.append("key", IMGBB_KEY);
    form.append("image", base64Data);

    const imgbbResp = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: form,
    });

    const data = await imgbbResp.json();
    if (data.success && data.data?.url) {
      return new Response(JSON.stringify({ success: true, url: data.data.url, deleteUrl: data.data.delete_url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.error("[upload-to-imgbb] ImgBB error:", JSON.stringify(data));
    return new Response(JSON.stringify({ error: "ImgBB upload failed", details: data }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[upload-to-imgbb] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
