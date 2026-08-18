// Edge Function: send-push
// Se dispara con un Database Webhook de Supabase cuando entra
// una fila nueva en "pedidos" o en "alertas", y manda una
// notificación push real a los suscritos correspondientes.

import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails(
  "mailto:admin@triciexpress.local",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const table = payload.table;
    const record = payload.record;

    let title = "";
    let body = "";
    let role = "chofer";

    if (table === "pedidos") {
      const d = record.data || {};
      // Solo notificar en pedidos nuevos pendientes (no en updates)
      title = "🚲 Nuevo pedido disponible";
      body = `${d.pickup || "?"} → ${d.drop || "?"}`;
      role = "chofer";
    } else if (table === "alertas") {
      const d = record.data || {};
      title = "🚨 Alerta de emergencia";
      body = `${d.nombre || "Alguien"} reportó una emergencia`;
      role = "admin";
    } else {
      return new Response("ignored", { status: 200 });
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?role=eq.${role}`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    const subs = await res.json();

    const results = await Promise.allSettled(
      (subs || []).map((row: any) =>
        webpush.sendNotification(
          row.subscription,
          JSON.stringify({ title, body })
        )
      )
    );

    return new Response(JSON.stringify({ sent: results.length }), {
      status: 200,
    });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
