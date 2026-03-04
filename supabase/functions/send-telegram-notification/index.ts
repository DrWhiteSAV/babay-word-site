// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { telegram_id, title, message } = await req.json();
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

    if (!botToken || !telegram_id) {
      return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: corsHeaders });
    }

    const text = `*${title}*\n\n${message}`;

    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegram_id,
        text,
        parse_mode: 'Markdown',
      }),
    });

    const data = await resp.json();
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
