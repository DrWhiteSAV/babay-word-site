// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { telegram_id, title, message, photo_url, caption, inline_keyboard } = body;
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

    if (!botToken || !telegram_id) {
      return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: corsHeaders });
    }

    const replyMarkup = inline_keyboard ? { inline_keyboard } : undefined;

    let data: any;

    // If photo_url provided — send as photo with caption
    if (photo_url) {
      const cap = caption || (title ? `*${title}*\n\n${message || ''}` : message || '');
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegram_id,
          photo: photo_url,
          caption: cap,
          parse_mode: 'Markdown',
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        }),
      });
      data = await resp.json();

      // If photo send failed (e.g. URL blocked), fall back to text
      if (!data.ok) {
        const text = `${cap}\n\n🖼 ${photo_url}`;
        const resp2 = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegram_id, text, parse_mode: 'Markdown',
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          }),
        });
        data = await resp2.json();
      }
    } else {
      // Use caption if provided, otherwise build from title+message
      const text = caption || (title ? `*${title}*\n\n${message || ''}` : message || '');
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegram_id, text, parse_mode: 'Markdown',
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        }),
      });
      data = await resp.json();
    }

    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
