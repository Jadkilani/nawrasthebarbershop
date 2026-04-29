import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar, Phone, X, LogOut } from "lucide-react";

export const Route = createFileRoute("/my-bookings")({
  component: MyBookings,
});

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  starts_at: string;
  ends_at: string;
  status: string;
  cancel_token: string;
  services?: { name: string; price_jod: number } | null;
  barbers?: { name: string } | null;
};

function MyBookings() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/login" });
        return;
      }
      setEmail(session.user.email ?? null);
      setLoading(false);
    })();
  }, [navigate]);

  const lookupByPhone = async (phone: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("*, services(name, price_jod), barbers(name)")
      .eq("customer_phone", phone)
      .order("starts_at", { ascending: false })
      .limit(20);
    setBookings((data ?? []) as Booking[]);
    setLoading(false);
  };

  const cancel = async (b: Booking) => {
    if (!confirm("Cancel this booking?")) return;
    try {
      const { data, error } = await supabase.rpc("customer_cancel_booking", { _booking_id: b.id, _token: b.cancel_token });
      if (error || !data) return toast.error("Could not cancel");
      toast.success("Cancelled");
      setBookings((bs) => bs.map((x) => x.id === b.id ? { ...x, status: "cancelled" } : x));
    } catch (e) {
      toast.error("Could not cancel");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl gold-text">{t("myBookings")}</h1>
          <Button onClick={signOut} variant="outline" size="sm" className="border-border/60">
            <LogOut className="h-4 w-4" /> {t("signOut")}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Signed in as {email}</p>

        <PhoneLookup onLookup={lookupByPhone} loading={loading} />

        <div className="mt-6 space-y-3">
          {bookings.map((b) => (
            <div key={b.id} className="luxe-card rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-lg">{b.services?.name}</div>
                  <div className="text-sm text-muted-foreground">{b.barbers?.name} · {b.services?.price_jod} JOD</div>
                  <div className="text-sm mt-1 inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    {format(new Date(b.starts_at), "EEE, d MMM · h:mm a")}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider mt-2 inline-block px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground">{b.status}</div>
                </div>
                {b.status !== "cancelled" && b.status !== "completed" && new Date(b.starts_at) > new Date() && (
                  <Button size="sm" variant="outline" onClick={() => cancel(b)} className="border-destructive/40 text-destructive hover:bg-destructive/10">
                    <X className="h-3.5 w-3.5" /> {t("cancel")}
                  </Button>
                )}
              </div>
            </div>
          ))}
          {bookings.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground luxe-card rounded-xl text-sm">
              Enter your phone number above to look up your bookings.
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90"><Link to="/book">{t("bookNow")}</Link></Button>
        </div>
      </main>
    </div>
  );
}

function PhoneLookup({ onLookup, loading }: { onLookup: (p: string) => void; loading: boolean }) {
  const [phone, setPhone] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (phone.trim()) onLookup(phone.trim()); }} className="flex gap-2">
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone number used to book"
        className="flex-1 h-10 rounded-md bg-input/60 border border-border/60 px-3 text-sm"
      />
      <Button type="submit" disabled={loading || !phone.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90">
        <Phone className="h-4 w-4" /> Look up
      </Button>
    </form>
  );
}
