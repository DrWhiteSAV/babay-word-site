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

      // Get all non-blocked users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('telegram_id, first_name, username')
        .eq('telegram_blocked', false)
        .limit(500);

      if (!profiles) return new Response(JSON.stringify({ message: 'No profiles' }), { headers: corsHeaders });

      // Get player stats for macro substitution
      const telegramIds = profiles.map(p => p.telegram_id);
      const { data: statsData } = await supabase
        .from('player_stats')
        .select('telegram_id, fear, energy, watermelons, boss_level, telekinesis_level, character_name')
        .in('telegram_id', telegramIds);

      const statsMap = new Map((statsData || []).map(s => [s.telegram_id, s]));

      // Get admin notifications for daily_reminder type
      const { data: adminNotifs } = await supabase
        .from('admin_notifications')
        .select('*')
        .eq('type', 'broadcast')
        .eq('is_active', true)
        .eq('send_telegram', true)
        .limit(1);

      const eventsList = events.map(e => `${e.icon || '🎯'} ${e.title}`).join('\n');
      let sent = 0, failed = 0, blocked = 0;

      for (const profile of profiles) {
        // Check notification settings
        const { data: ns } = await supabase
          .from('notification_settings')
          .select('notify_event_complete')
          .eq('telegram_id', profile.telegram_id)
          .single();

        if (ns && (ns as any).notify_event_complete === false) continue;

        const stats = statsMap.get(profile.telegram_id) || {};

        // Build message with macros
        let title = '👻 Ежедневные задания!';
        let text = '';

        if (adminNotifs && adminNotifs.length > 0) {
          const notif = adminNotifs[0];
          title = notif.title
            .replace('{first_name}', profile.first_name || '')
            .replace('{name}', stats.character_name || 'Бабай')
            .replace('{fear}', String(stats.fear || 0))
            .replace('{energy}', String(stats.energy || 0))
            .replace('{watermelons}', String(stats.watermelons || 0))
            .replace('{boss_level}', String(stats.boss_level || 0))
            .replace('{telekinesis}', String(stats.telekinesis_level || 0));

          text = notif.message
            .replace('{first_name}', profile.first_name || '')
            .replace('{name}', stats.character_name || 'Бабай')
            .replace('{fear}', String(stats.fear || 0))
            .replace('{energy}', String(stats.energy || 0))
            .replace('{watermelons}', String(stats.watermelons || 0))
            .replace('{boss_level}', String(stats.boss_level || 0))
            .replace('{telekinesis}', String(stats.telekinesis_level || 0));
        } else {
          text = `*${title}*\n\nПривет, ${profile.first_name}! Сегодня доступны новые ежедневные эвенты:\n\n${eventsList}\n\nЗаходи и забери награды! 🎁`;
        }

        const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: profile.telegram_id, text: `*${title}*\n\n${text}`, parse_mode: 'Markdown' }),
        });

        const respData = await resp.json();
        let status = 'sent';
        let errorMsg = null;

        if (!resp.ok || !respData.ok) {
          const errStr = JSON.stringify(respData);
          if (errStr.includes('bot was blocked') || errStr.includes('403') || errStr.includes('kicked')) {
            status = 'blocked';
            blocked++;
            await supabase.from('profiles').update({ telegram_blocked: true }).eq('telegram_id', profile.telegram_id);
          } else {
            status = 'failed';
            failed++;
            errorMsg = respData.description || 'Unknown error';
          }
        } else {
          sent++;
        }

        // Record history
        await supabase.from('notification_send_history').insert({
          telegram_id: profile.telegram_id,
          title,
          message: text,
          status,
          error_message: errorMsg,
        });

        // Rate limiting: 20 msg/sec Telegram limit
        await new Promise(r => setTimeout(r, 60));
      }

      return new Response(JSON.stringify({ message: `Sent: ${sent}, Failed: ${failed}, Blocked: ${blocked}` }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ message: 'Unknown type' }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
