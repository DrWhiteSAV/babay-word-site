// @ts-nocheck
/**
 * AI Substitute Worker
 * Called when a new chat message arrives and the owner of ai_substitute=true is OFFLINE.
 *
 * Logic:
 * 1. Receive: chat_key, sender_name, message_content, owner_telegram_id
 * 2. Check that ai_substitute is still ON for this friendship
 * 3. Check owner is offline (profiles.updated_at < 3 min ago)
 * 4. Send Telegram notification to owner about the incoming message
 * 5. Generate AI reply via protalk-ai
 * 6. Save reply to chat_messages as the owner (role='user', sender_telegram_id=owner_tid)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
    const PROTALK_BOT_TOKEN = Deno.env.get("PROTALK_BOT_TOKEN")!;
    const PROTALK_BOT_ID = Deno.env.get("PROTALK_BOT_ID")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const {
      chat_key,
      sender_name,
      sender_telegram_id,
      message_content,
      owner_telegram_id,
      owner_character_name,
      friend_character_name,
    } = body;

    if (!chat_key || !owner_telegram_id || !message_content) {
      return new Response(JSON.stringify({ error: "Missing required params" }), { status: 400, headers: corsHeaders });
    }

    // 1. Check ai_substitute is still ON
    const { data: friendRow } = await supabase
      .from("friends")
      .select("ai_substitute, is_ai_enabled")
      .eq("telegram_id", owner_telegram_id)
      .eq("friend_name", friend_character_name)
      .maybeSingle();

    if (!friendRow?.ai_substitute) {
      return new Response(JSON.stringify({ skipped: "ai_substitute not enabled" }), { headers: corsHeaders });
    }

    // 2. Check owner is offline
    const { data: profile } = await supabase
      .from("profiles")
      .select("updated_at")
      .eq("telegram_id", owner_telegram_id)
      .maybeSingle();

    const lastSeen = profile?.updated_at ? new Date(profile.updated_at).getTime() : 0;
    const isOffline = Date.now() - lastSeen >= ONLINE_THRESHOLD_MS;

    if (!isOffline) {
      // Owner is online — client-side will handle it
      return new Response(JSON.stringify({ skipped: "owner is online" }), { headers: corsHeaders });
    }

    // 3. Send Telegram notification to owner about the incoming message
    const previewText = message_content.startsWith("[img]:")
      ? "📷 Фото"
      : message_content.slice(0, 100);

    if (TELEGRAM_BOT_TOKEN) {
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: owner_telegram_id,
            text: `💬 *${sender_name}* пишет тебе (ИИ-заместитель отвечает):\n\n${previewText}`,
            parse_mode: "Markdown",
          }),
        });
      } catch (e) {
        console.warn("[ai-sub] TG notify failed:", e);
      }
    }

    // 4. Load recent chat history for context (last 4 only)
    const { data: recentMsgs } = await supabase
      .from("chat_messages")
      .select("role, content, friend_name, sender_telegram_id")
      .eq("chat_key", chat_key)
      .order("created_at", { ascending: false })
      .limit(6); // fetch 6 to slice to 4 after filter

    // Anti-repeat guard: check if owner already replied after the last message from sender
    const msgs = (recentMsgs || []).reverse();
    const lastSenderMsgIdx = msgs.map(m => m.sender_telegram_id).lastIndexOf(sender_telegram_id);
    if (lastSenderMsgIdx !== -1) {
      const ownerRepliedAfter = msgs.slice(lastSenderMsgIdx + 1).some(
        m => m.sender_telegram_id === owner_telegram_id || m.role === "user"
      );
      if (ownerRepliedAfter) {
        console.log("[ai-sub] Owner already replied after last message — skipping");
        return new Response(JSON.stringify({ skipped: "already replied" }), { headers: corsHeaders });
      }
    }

    const history = msgs.slice(-4).map((m) => {
      const isOwner = m.sender_telegram_id === owner_telegram_id || m.role === "user";
      return {
        sender: isOwner ? owner_character_name : sender_name,
        text: m.content?.startsWith("[img]:") ? "[фото]" : (m.content || ""),
      };
    });

    // 5. Get owner's character info
    const { data: ownerStats } = await supabase
      .from("player_stats")
      .select("character_name, character_gender, character_style, lore")
      .eq("telegram_id", owner_telegram_id)
      .maybeSingle();

    // Build AI prompt — last 4 messages context, focus on the very last one
    const historyStr = history
      .slice(-4)
      .map((h) => `${h.sender}: ${h.text}`)
      .join("\n");

    const lastMsg = history.length > 0 ? history[history.length - 1] : null;
    const lastMsgLine = lastMsg ? `\nПоследнее сообщение от ${sender_name}: «${lastMsg.text}» — ответь ИМЕННО на него.` : "";

    const prompt = `Ты — ИИ-заместитель друга по имени ${ownerStats?.character_name || owner_character_name}. Твой собеседник — ${sender_name}.
Лор Бабая: ${ownerStats?.lore || "нет"}.
Последние сообщения (только для контекста):
${historyStr}
${lastMsgLine}
Ответь коротко (1-3 предложения) в образе ${ownerStats?.character_name || owner_character_name}. Без кавычек, без пояснений.`;

    // 6. Generate reply via ProTalk
    // Use stable chat_id based on chat_key — prevents "Dialog state: STARTED" on every new session.
    // ProTalk initializes a new session on first call to any chat_id, returning empty.
    // With a stable chat_id per chat pair, the session persists and responses are immediate.
    const botIdNum = parseInt(PROTALK_BOT_ID);
    const stableChatId = `aisub_${chat_key.replace(/[^a-z0-9_]/gi, "_")}`;

    async function askProTalkWithRetry(chatId: string, message: string, maxRetries = 2): Promise<string> {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const socialId = `from_user_id:${owner_telegram_id} message_id:${Date.now()}`;
        const ptResp = await fetch(`https://eu1.api.pro-talk.ru/api/v1.0/ask/${PROTALK_BOT_TOKEN}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot_id: botIdNum, chat_id: chatId, message, social_id: socialId }),
        });

        if (!ptResp.ok) {
          console.warn(`[ai-sub] ProTalk HTTP ${ptResp.status} on attempt ${attempt + 1}`);
          if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 1500));
          continue;
        }

        const ptData = await ptResp.json();
        const text = ptData.done || ptData.message || ptData.text || ptData.response || "";

        // ProTalk returns "Dialog state: STARTED" or empty on first call to a new session.
        // Retry once — second call always gets a real response.
        const isInitResponse = !text || text.trim().length < 3 || text.includes("Dialog state:");
        if (isInitResponse) {
          console.log(`[ai-sub] ProTalk init response on attempt ${attempt + 1}, retrying...`);
          if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 1500));
          continue;
        }

        // Also skip LIMIT errors — they mean the session chat_id is rate-limited
        if (text.includes("Try ask again LIMIT")) {
          console.warn(`[ai-sub] ProTalk LIMIT hit, using timestamped fallback chat_id`);
          // Fallback: unique chat_id bypasses the limit
          const fallbackId = `aisub_${owner_telegram_id}_${Date.now()}`;
          const fbResp = await fetch(`https://eu1.api.pro-talk.ru/api/v1.0/ask/${PROTALK_BOT_TOKEN}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bot_id: botIdNum, chat_id: fallbackId, message, social_id: `from_user_id:${owner_telegram_id} message_id:${Date.now()}` }),
          });
          if (fbResp.ok) {
            const fbData = await fbResp.json();
            const fbText = fbData.done || fbData.message || fbData.text || fbData.response || "";
            // Wait for init then retry fallback
            if (!fbText || fbText.includes("Dialog state:") || fbText.includes("LIMIT")) {
              await new Promise(r => setTimeout(r, 2000));
              const fb2Resp = await fetch(`https://eu1.api.pro-talk.ru/api/v1.0/ask/${PROTALK_BOT_TOKEN}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bot_id: botIdNum, chat_id: fallbackId, message, social_id: `from_user_id:${owner_telegram_id} message_id:${Date.now()}` }),
              });
              if (fb2Resp.ok) {
                const fb2Data = await fb2Resp.json();
                return fb2Data.done || fb2Data.message || fb2Data.text || fb2Data.response || "";
              }
            }
            return fbText;
          }
          return "";
        }

        return text;
      }
      return "";
    }

    const replyText = await askProTalkWithRetry(stableChatId, prompt);

    if (!replyText || replyText.trim().length < 2) {
      console.warn("[ai-sub] Empty reply from ProTalk after retries");
      return new Response(JSON.stringify({ skipped: "empty ai reply" }), { headers: corsHeaders });
    }

    // 7. Save AI reply as the owner
    const { data: inserted } = await supabase.from("chat_messages").insert({
      telegram_id: owner_telegram_id,
      content: replyText.trim(),
      role: "user",
      friend_name: ownerStats?.character_name || owner_character_name || "user",
      chat_key,
      sender_telegram_id: owner_telegram_id,
      is_ai_reply: true,
    }).select("id").single();

    console.log("[ai-sub] Reply saved:", inserted?.id);

    return new Response(JSON.stringify({ success: true, reply: replyText.trim(), id: inserted?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[ai-sub] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
