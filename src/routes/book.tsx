import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Clock, Scissors, User, Calendar as CalIcon, ArrowLeft } from "lucide-react";
import { addDays, format, isBefore, isSameDay, startOfDay } from "date-fns";

export const Route = createFileRoute("/book")({
  component: BookPage,
});

type Service = { id: string; name: string; name_ar: string | null; price_jod: number; duration_minutes: number };
type Barber = { id: string; name: string; name_ar: string | null };
type WorkingHour = { weekday: number; open_time: string; close_time: string; is_open: boolean };
type Unavailability = { barber_id: string; starts_at: string; ends_at: string };

const SLOT_INTERVAL = 30; // minutes

function BookPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [closedDays, setClosedDays] = useState<string[]>([]);
  const [unavailability, setUnavailability] = useState<Unavailability[]>([]);

  const [serviceId, setServiceId] = useState<string>("");
  const [barberId, setBarberId] = useState<string>("");
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string>(""); // "HH:mm"
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [takenSlots, setTakenSlots] = useState<string[]>([]); // ISO start times

  const service = services.find((s) => s.id === serviceId);
  const barber = barbers.find((b) => b.id === barberId);

  useEffect(() => {
    (async () => {
      const [s, b, wh, cd] = await Promise.all([
        supabase.from("services").select("*").eq("active", true).order("sort_order"),
        supabase.from("barbers").select("*").eq("active", true).order("sort_order"),
        supabase.from("working_hours").select("*"),
        supabase.from("closed_days").select("closed_date"),
      ]);
      if (s.data) setServices(s.data as Service[]);
      if (b.data) setBarbers(b.data as Barber[]);
      if (wh.data) setWorkingHours(wh.data as WorkingHour[]);
      if (cd.data) setClosedDays((cd.data as { closed_date: string }[]).map((x) => x.closed_date));
    })();
  }, []);

  // Load barber unavailability when barber selected
  useEffect(() => {
    if (!barberId) return;
    supabase
      .from("barber_unavailability")
      .select("barber_id, starts_at, ends_at")
      .eq("barber_id", barberId)
      .then(({ data }) => {
        if (data) setUnavailability(data as Unavailability[]);
      });
  }, [barberId]);

  // Load taken slots + subscribe to realtime updates
  useEffect(() => {
    if (!barberId || !date) return;
    const day = format(date, "yyyy-MM-dd");

    const fetchTaken = async () => {
      const { data } = await supabase.rpc("get_taken_slots", { _barber_id: barberId, _day: day });
      if (data) setTakenSlots((data as { starts_at: string }[]).map((r) => r.starts_at));
    };
    fetchTaken();

    const channel = supabase
      .channel(`bookings-${barberId}-${day}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `barber_id=eq.${barberId}` }, () => fetchTaken())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barberId, date]);

  const dayOptions = useMemo(() => {
    const days: Date[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 14; i++) {
      const d = addDays(today, i);
      days.push(d);
    }
    return days;
  }, []);

  const timeSlots = useMemo(() => {
    if (!date || !service) return [] as { time: string; iso: string; disabled: boolean }[];
    const wh = workingHours.find((w) => w.weekday === date.getDay());
    const dateStr = format(date, "yyyy-MM-dd");
    if (!wh || !wh.is_open || closedDays.includes(dateStr)) return [];

    const [oh, om] = wh.open_time.split(":").map(Number);
    const [ch, cm] = wh.close_time.split(":").map(Number);
    const slots: { time: string; iso: string; disabled: boolean }[] = [];
    const start = new Date(date);
    start.setHours(oh, om, 0, 0);
    const end = new Date(date);
    end.setHours(ch, cm, 0, 0);

    const now = new Date();
    let cur = new Date(start);
    while (cur.getTime() + service.duration_minutes * 60_000 <= end.getTime()) {
      const iso = cur.toISOString();
      const slotEnd = new Date(cur.getTime() + service.duration_minutes * 60_000);

      const taken = takenSlots.some((s) => {
        const ts = new Date(s).getTime();
        return ts === cur.getTime();
      });

      const blockedByUnavail = unavailability.some((u) => {
        const us = new Date(u.starts_at).getTime();
        const ue = new Date(u.ends_at).getTime();
        return cur.getTime() < ue && slotEnd.getTime() > us;
      });

      const past = isBefore(cur, now);
      slots.push({
        time: format(cur, "HH:mm"),
        iso,
        disabled: taken || blockedByUnavail || past,
      });
      cur = new Date(cur.getTime() + SLOT_INTERVAL * 60_000);
    }
    return slots;
  }, [date, service, workingHours, closedDays, takenSlots, unavailability]);

  const localized = <T extends { name: string; name_ar: string | null }>(item: T) =>
    lang === "ar" && item.name_ar ? item.name_ar : item.name;

  const canNext = (s: number) => {
    if (s === 1) return !!serviceId;
    if (s === 2) return !!barberId;
    if (s === 3) return !!date && !!time;
    return false;
  };

  const handleSubmit = async () => {
    if (!service || !barber || !date || !time) return;
    if (name.trim().length < 2) {
      toast.error(t("invalidName"));
      return;
    }
    const phoneClean = phone.trim();
    if (!/^[+0-9 ()-]{6,20}$/.test(phoneClean)) {
      toast.error(t("invalidPhone"));
      return;
    }

    setSubmitting(true);

    const [hh, mm] = time.split(":").map(Number);
    const startsAt = new Date(date);
    startsAt.setHours(hh, mm, 0, 0);
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60_000);

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        customer_name: name.trim(),
        customer_phone: phoneClean,
        customer_notes: notes.trim() || null,
        barber_id: barber.id,
        service_id: service.id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "pending",
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (error) {
      console.error(error);
      toast.error(t("bookingError"));
      return;
    }

    supabase.functions.invoke("notify-new-booking", {
      body: { booking_id: data!.id },
    }).catch((e) => console.error("notify failed", e));

    navigate({
      to: "/booking-confirmed",
      search: {
        id: data!.id,
        name: name.trim(),
        service: localized(service),
        barber: localized(barber),
        when: startsAt.toISOString(),
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("back_home")}
        </Link>

        <div className="flex items-center justify-between mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span>{t("step")} {step} {t("of")} 4</span>
          <span className="text-primary/80">
            {step === 1 && t("services")}
            {step === 2 && t("barbers")}
            {step === 3 && `${t("selectDate")} & ${t("selectTime")}`}
            {step === 4 && t("yourDetails")}
          </span>
        </div>
        <div className="h-1 rounded-full bg-card overflow-hidden mb-8">
          <div className="h-full bg-gradient-to-r from-primary to-[oklch(0.85_0.08_80)] transition-all" style={{ width: `${(step / 4) * 100}%` }} />
        </div>

        {step === 1 && (
          <Section title={t("selectService")}>
            <div className="grid sm:grid-cols-2 gap-3">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setServiceId(s.id); }}
                  className={`luxe-card text-start rounded-xl p-4 transition-all ${serviceId === s.id ? "border-primary ring-1 ring-primary/40" : "hover:border-primary/40"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display text-lg">{localized(s)}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" /> {s.duration_minutes} {t("min")}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="font-display text-xl gold-text">{s.price_jod}</div>
                      <div className="text-[10px] text-muted-foreground">{t("jod")}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {step === 2 && (
          <Section title={t("selectBarber")}>
            <div className="grid sm:grid-cols-2 gap-3">
              {barbers.map((b) => (
                <button
                  key={b.id}
                  onClick={() => { setBarberId(b.id); setDate(null); setTime(""); }}
                  className={`luxe-card rounded-xl p-5 flex items-center gap-4 transition-all ${barberId === b.id ? "border-primary ring-1 ring-primary/40" : "hover:border-primary/40"}`}
                >
                  <div className="h-12 w-12 rounded-full gold-border grid place-items-center bg-gradient-to-br from-card to-background">
                    <User className="h-5 w-5 text-primary/70" />
                  </div>
                  <div className="text-start">
                    <div className="font-display text-lg">{localized(b)}</div>
                    <div className="text-xs text-muted-foreground">{t("barbers")}</div>
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {step === 3 && (
          <div className="space-y-8">
            <Section title={t("selectDate")}>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {dayOptions.map((d) => {
                  const wh = workingHours.find((w) => w.weekday === d.getDay());
                  const dateStr = format(d, "yyyy-MM-dd");
                  const closed = !wh?.is_open || closedDays.includes(dateStr);
                  const selected = date && isSameDay(date, d);
                  return (
                    <button
                      key={d.toISOString()}
                      disabled={closed}
                      onClick={() => { setDate(d); setTime(""); }}
                      className={`p-2 rounded-lg border transition-all text-center ${
                        closed
                          ? "border-border/30 text-muted-foreground/40 cursor-not-allowed"
                          : selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 hover:border-primary/50"
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-wider">{format(d, "EEE")}</div>
                      <div className="font-display text-lg">{format(d, "d")}</div>
                      <div className="text-[10px] text-muted-foreground">{format(d, "MMM")}</div>
                    </button>
                  );
                })}
              </div>
            </Section>

            {date && (
              <Section title={t("selectTime")}>
                {timeSlots.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">{t("noSlots")}</div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.iso}
                        disabled={slot.disabled}
                        onClick={() => setTime(slot.time)}
                        className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                          slot.disabled
                            ? "border-border/30 text-muted-foreground/40 line-through cursor-not-allowed"
                            : time === slot.time
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/60 hover:border-primary/50"
                        }`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </Section>
            )}
          </div>
        )}

        {step === 4 && service && barber && date && (
          <div className="space-y-6">
            <div className="luxe-card rounded-xl p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3">{t("bookingSummary")}</div>
              <div className="space-y-2 text-sm">
                <Row icon={<Scissors className="h-4 w-4" />} label={t("services")} value={`${localized(service)} · ${service.price_jod} ${t("jod")}`} />
                <Row icon={<User className="h-4 w-4" />} label={t("barbers")} value={localized(barber)} />
                <Row icon={<CalIcon className="h-4 w-4" />} label={t("selectDate")} value={`${format(date, "EEEE, d MMM")} · ${time}`} />
              </div>
            </div>

            <Section title={t("yourDetails")}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">{t("fullName")}</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="mt-1.5 bg-input/60 border-border/60" />
                </div>
                <div>
                  <Label htmlFor="phone">{t("phone")}</Label>
                  <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="07X XXXX XXXX" className="mt-1.5 bg-input/60 border-border/60" />
                </div>
                <div>
                  <Label htmlFor="notes">{t("notes")}</Label>
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3} className="mt-1.5 bg-input/60 border-border/60" />
                </div>
              </div>
            </Section>
          </div>
        )}

        <div className="mt-10 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="border-border/60"
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" /> {t("back")}
          </Button>
          {step < 4 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext(step)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              {t("next")} <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || name.trim().length < 2 || phone.trim().length < 6}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-[var(--shadow-luxe)]"
            >
              {submitting ? t("loading") : t("confirmBooking")} <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-2xl mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-primary/70">{icon}</span> {label}
      </div>
      <div className="text-foreground/95 font-medium text-end">{value}</div>
    </div>
  );
}
