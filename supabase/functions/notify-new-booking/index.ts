// Email notification when a new booking is created.
// Uses Lovable AI Gateway / Resend? — Falls back to logging if no provider.
// For now we use Lovable's built-in email via Supabase Auth admin email is not suitable;
// instead we log + return success. Wire to Resend later.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { booking_id } = await req.json();
    if (!booking_id) return new Response(JSON.stringify({ error: "missing booking_id" }), { status: 400, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*, services(name, price_jod), barbers(name)")
      .eq("id", booking_id)
      .single();

    if (error || !booking) {
      return new Response(JSON.stringify({ error: "booking not found" }), { status: 404, headers: corsHeaders });
    }

    const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    const subject = `New booking — ${booking.customer_name} (${booking.barbers?.name})`;
    const text = `New booking received at Nawras Barbershop:

Customer: ${booking.customer_name}
Phone:    ${booking.customer_phone}
Service:  ${booking.services?.name} (${booking.services?.price_jod} JOD)
Barber:   ${booking.barbers?.name}
When:     ${new Date(booking.starts_at).toLocaleString()}
Notes:    ${booking.customer_notes ?? "—"}

Manage in your admin dashboard.`;

    if (resendKey && adminEmail) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: "Nawras Barbershop <onboarding@resend.dev>",
          to: [adminEmail],
          subject,
          text,
        }),
      });
      if (!r.ok) console.error("resend failed", await r.text());
    } else {
      console.log("EMAIL (not sent — no RESEND_API_KEY/ADMIN_NOTIFICATION_EMAIL):\n", subject, "\n", text);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
