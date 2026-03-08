// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROTALK_URL = "https://eu1.api.pro-talk.ru/api/v1.0/ask";

const generateChatId = (telegramId?: number, botId?: string): string => {
  if (telegramId && botId) return `tb${telegramId}_${botId}`;
  return `ask${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const generateSocialId = (telegramId?: number): string => {
  if (telegramId) return `from_user_id:${telegramId} message_id:${Date.now()}`;
  return `from_user_id:unknown message_id:${Date.now()}`;
};

async function askProTalk(
  message: string,
  token: string,
  botId: number,
  chatId: string,
  socialId: string,
): Promise<string> {
  const response = await fetch(`${PROTALK_URL}/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bot_id: botId, chat_id: chatId, message, social_id: socialId }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("ProTalk error:", response.status, err.substring(0, 200));
    // For timeouts (504/502/503), return empty string so caller can use fallback
    if (response.status === 504 || response.status === 502 || response.status === 503) {
      console.warn("ProTalk timeout, returning empty response for fallback");
      return "";
    }
    throw new Error(`ProTalk API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  console.log("ProTalk raw response:", JSON.stringify(data).substring(0, 300));
  return data.done || data.message || data.text || data.response || "";
}

// Extract image URL from ProTalk response text
// Handles: plain URLs, markdown ![alt](url), ![alt]url, or any http URL
function extractImageUrl(text: string): string | null {
  // 1. Markdown image: ![alt](url) or ![alt]url (no closing paren)
  const mdMatch = text.match(/!\[[^\]]*\]\(?( *https?:\/\/[^\s\])"']+)\)?/i);
  if (mdMatch) return mdMatch[1].trim();
  // 2. Any bare https URL
  const urlMatch = text.match(/https?:\/\/[^\s\])"'<>]+/i);
  return urlMatch ? urlMatch[0].trim() : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PROTALK_BOT_TOKEN = Deno.env.get("PROTALK_BOT_TOKEN");
    const PROTALK_BOT_ID = Deno.env.get("PROTALK_BOT_ID");

    if (!PROTALK_BOT_TOKEN || !PROTALK_BOT_ID) {
      return new Response(JSON.stringify({ error: "ProTalk credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { type, prompt, telegramId, chatKey } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use chatKey-based stable chat_id if provided.
    // If caller already passes an aisub_-prefixed key (online path), use it as-is.
    // Otherwise normalise plain chatKey with aisub_ prefix — matches ai-substitute-worker format.
    const normalizedKey = chatKey ? String(chatKey) : null;
    const chatId = normalizedKey
      ? (normalizedKey.startsWith("aisub_")
          ? normalizedKey
          : `aisub_${normalizedKey.replace(/[^a-z0-9_]/gi, "_")}`)
      : generateChatId(telegramId, PROTALK_BOT_ID);
    const socialId = generateSocialId(telegramId);
    const botIdNum = parseInt(PROTALK_BOT_ID);

    console.log(`ProTalk request: type=${type}, chat_id=${chatId}`);

    const rawResponse = await askProTalk(prompt, PROTALK_BOT_TOKEN, botIdNum, chatId, socialId);

    // For timeouts, return success with empty content so client uses fallback
    if (!rawResponse) {
      return new Response(JSON.stringify({ success: true, text: "", imageUrl: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For image generation requests, try to extract image URL
    if (type === "image") {
      const imageUrl = extractImageUrl(rawResponse);
      return new Response(JSON.stringify({ 
        success: true, 
        text: rawResponse, 
        imageUrl: imageUrl || null 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For text requests
    return new Response(JSON.stringify({ success: true, text: rawResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("protalk-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
