// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { type, trigger } = await req.json();
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (type === 'daily_reminder') {
      // Get all active daily events
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('event_type', 'daily')
        .eq('is_active', true);

      if (!events || events.length === 0) {
        return new Response(JSON.stringify({ message: 'No active daily events' }), { headers: corsHeaders });
      }

      // Get all users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('telegram_id, first_name')
        .limit(500);

      if (!profiles) return new Response(JSON.stringify({ message: 'No profiles' }), { headers: corsHeaders });

      const eventsList = events.map(e => `${e.icon || '🎯'} ${e.title}`).join('\n');
      let sent = 0;

      for (const profile of profiles) {
        // Check notification settings
        const { data: ns } = await supabase
          .from('notification_settings' as any)
          .select('notify_event_complete')
          .eq('telegram_id', profile.telegram_id)
          .single();

        // Default: send if no settings row or if enabled
        if (ns && (ns as any).notify_event_complete === false) continue;

        const text = `👻 *Привет, ${profile.first_name}!*\n\nСегодня доступны новые ежедневные эвенты:\n\n${eventsList}\n\nЗаходи и забери награды! 🎁`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: profile.telegram_id, text, parse_mode: 'Markdown' }),
        });
        sent++;

        // Rate limiting
        await new Promise(r => setTimeout(r, 50));
      }

      return new Response(JSON.stringify({ message: `Sent to ${sent} users` }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ message: 'Unknown type' }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
