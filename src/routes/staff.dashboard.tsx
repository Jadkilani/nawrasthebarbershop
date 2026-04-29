import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { LogOut, Calendar, Phone, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/staff/dashboard")({
  component: StaffDashboard,
});

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_notes: string | null;
  barber_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  services?: { name: string; price_jod: number } | null;
  barbers?: { name: string } | null;
};

function StaffDashboard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [range, setRange] = useState<"today" | "week" | "all">("today");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin" });
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/admin" });
        return;
      }
      // Try to claim staff role from allowlist (in case admin just added them)
      try { await supabase.rpc("claim_staff_role"); } catch {}
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      const roles = (data ?? []).map((r: { role: string }) => r.role);
      if (!roles.includes("employee") && !roles.includes("admin")) {
        await supabase.auth.signOut();
        toast.error("Not on staff list");
        navigate({ to: "/admin" });
        return;
      }
      setAuthChecked(true);
    })();
  }, [navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("bookings")
      .select("*, services(name, price_jod), barbers(name)")
      .order("starts_at", { ascending: true });
    if (range === "today") {
      q = q.gte("starts_at", startOfDay(new Date()).toISOString()).lte("starts_at", endOfDay(new Date()).toISOString());
    } else if (range === "week") {
      q = q.gte("starts_at", startOfDay(new Date()).toISOString()).lte("starts_at", endOfDay(addDays(new Date(), 7)).toISOString());
    }
    const { data } = await q;
    // RLS automatically filters to barber linked to this user
    setBookings((data ?? []) as Booking[]);
    setLoading(false);
  }, [range]);

  useEffect(() => {
    if (!authChecked) return;
    load();
    const channel = supabase
      .channel("staff-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authChecked, load]);

  const updateStatus = async (id: string, status: Booking["status"]) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
  };

  if (!authChecked) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/60">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-display text-xl gold-text">Staff Dashboard</div>
            <span className="text-xs text-muted-foreground hidden sm:inline">My appointments</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/">View site</Link></Button>
            <Button onClick={signOut} variant="outline" size="sm" className="border-border/60">
              <LogOut className="h-4 w-4" /> {t("signOut")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-primary" />
          <Tabs value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <TabsList className="bg-card border border-border/60">
              <TabsTrigger value="today">{t("today")}</TabsTrigger>
              <TabsTrigger value="week">{t("thisWeek")}</TabsTrigger>
              <TabsTrigger value="all">{t("all")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">{t("loading")}</div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground luxe-card rounded-xl">No appointments in this view</div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="luxe-card rounded-xl p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display text-xl">{b.customer_name}</span>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {b.services?.name} · {b.services?.price_jod} JOD
                    </div>
                    <div className="text-sm mt-1.5 text-foreground/85 font-medium">
                      {format(new Date(b.starts_at), "EEE, d MMM · h:mm a")}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <a href={`tel:${b.customer_phone}`} className="text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" /> {b.customer_phone}
                      </a>
                      <a href={`https://wa.me/${b.customer_phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer"
                        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    </div>
                    {b.customer_notes && <div className="mt-2 text-xs text-muted-foreground italic">"{b.customer_notes}"</div>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {b.status !== "confirmed" && b.status !== "completed" && b.status !== "cancelled" && (
                      <Button size="sm" onClick={() => updateStatus(b.id, "confirmed")} className="bg-primary text-primary-foreground hover:bg-primary/90">{t("confirm")}</Button>
                    )}
                    {b.status !== "completed" && b.status !== "cancelled" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, "completed")} className="border-border/60">{t("markCompleted")}</Button>
                    )}
                    {b.status !== "no_show" && b.status !== "completed" && b.status !== "cancelled" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, "no_show")} className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10">{t("markNoShow")}</Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: Booking["status"] }) {
  const map: Record<Booking["status"], string> = {
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    confirmed: "bg-primary/15 text-primary border-primary/30",
    completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    cancelled: "bg-destructive/15 text-destructive border-destructive/30",
    no_show: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  };
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${map[status]}`}>{status}</span>;
}
