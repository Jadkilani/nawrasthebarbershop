import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Clock, Scissors, User, Calendar as CalIcon, ArrowLeft, Lock } from "lucide-react";
import { addDays, format, isBefore, isSameDay, startOfDay } from "date-fns";

export const Route = createFileRoute("/book")({
  component: BookPage,
});

type Service = { id: string; name: string; name_ar: string | null; price_jod: number; duration_minutes: number };
type Barber = { id: string; name: string; name_ar: string | null; photo_url: string | null };
type WorkingHour = { weekday: number; open_time: string; close_time: string; is_open: boolean };
type Unavailability = { barber_id: string; starts_at: string; ends_at: string };

const SLOT_INTERVAL = 30; // minutes

function format12h(date: Date) {
  return format(date, "h:mm a"); // e.g. "10:30 AM"
}

function BookPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [closedDays, setClosedDays] = useState<string[]>([]);
  const [unavailability, setUnavailability] = useState<Unavailability[]>([]);

  // Multi-select services — order matters for numbering
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [barberId, setBarberId] = useState<string>("");
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string>(""); // "HH:mm" 24h internal
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [takenSlots, setTakenSlots] = useState<{ start: number; end: number }[]>([]);

  const selectedServices = useMemo(
    () => selectedServiceIds.map((id) => services.find((s) => s.id === id)!).filter(Boolean),
    [selectedServiceIds, services]
  );
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price_jod), 0);
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

  // Load taken slots — fetch raw bookings for that day + barber so we know start AND end
  useEffect(() => {
    if (!barberId || !date) return;
    const dayStart = startOfDay(date);
    const dayEnd = addDays(dayStart, 1);

    const fetchTaken = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("starts_at, ends_at, status")
        .eq("barber_id", barberId)
        .gte("starts_at", dayStart.toISOString())
        .lt("starts_at", dayEnd.toISOString())
        .neq("status", "cancelled");
      if (data) {
        setTakenSlots(
          data.map((r: any) => ({
            start: new Date(r.starts_at).getTime(),
            end: new Date(r.ends_at).getTime(),
          }))
        );
      }
    };
    fetchTaken();

    const channel = supabase
      .channel(`bookings-${barberId}-${dayStart.toISOString()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `barber_id=eq.${barberId}` }, () => fetchTaken())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barberId, date]);

  const dayOptions = useMemo(() => {
    const days: Date[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 14; i++) days.push(addDays(today, i));
    return days;
  }, []);

  const timeSlots = useMemo(() => {
    if (!date || totalDuration === 0) return [] as { time12: string; time24: string; iso: string; disabled: boolean }[];
    const wh = workingHours.find((w) => w.weekday === date.getDay());
    const dateStr = format(date, "yyyy-MM-dd");
    if (!wh || !wh.is_open || closedDays.includes(dateStr)) return [];

    const [oh, om] = wh.open_time.split(":").map(Number);
    const [ch, cm] = wh.close_time.split(":").map(Number);
    const slots: { time12: string; time24: string; iso: string; disabled: boolean }[] = [];
    const start = new Date(date);
    start.setHours(oh, om, 0, 0);
    const end = new Date(date);
    end.setHours(ch, cm, 0, 0);

    const now = new Date();
    let cur = new Date(start);
    while (cur.getTime() + totalDuration * 60_000 <= end.getTime()) {
      const slotStart = cur.getTime();
      const slotEnd = slotStart + totalDuration * 60_000;

      const overlapsTaken = takenSlots.some((t) => slotStart < t.end && slotEnd > t.start);
      const blockedByUnavail = unavailability.some((u) => {
        const us = new Date(u.starts_at).getTime();
        const ue = new Date(u.ends_at).getTime();
        return slotStart < ue && slotEnd > us;
      });

      const past = isBefore(cur, now);
      slots.push({
        time12: format12h(cur),
        time24: format(cur, "HH:mm"),
        iso: cur.toISOString(),
        disabled: overlapsTaken || blockedByUnavail || past,
      });
      cur = new Date(cur.getTime() + SLOT_INTERVAL * 60_000);
    }
    return slots;
  }, [date, totalDuration, workingHours, closedDays, takenSlots, unavailability]);

  const localized = <T extends { name: string; name_ar: string | null }>(item: T) =>
    lang === "ar" && item.name_ar ? item.name_ar : item.name;

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setTime("");
  };

  const canNext = (s: number) => {
    if (s === 1) return selectedServiceIds.length > 0;
    if (s === 2) return !!barberId;
    if (s === 3) return !!date && !!time;
    return false;
  };

  const handleSubmit = async () => {
    if (selectedServices.length === 0 || !barber || !date || !time) return;
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
    const endsAt = new Date(startsAt.getTime() + totalDuration * 60_000);
    const primary = selectedServices[0];

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        customer_name: name.trim(),
        customer_phone: phoneClean,
        customer_notes: notes.trim() || null,
        barber_id: barber.id,
        service_id: primary.id, // primary for legacy column
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !data) {
      setSubmitting(false);
      console.error(error);
      toast.error(t("bookingError"));
      return;
    }

    // Insert all selected services into join table
    const rows = selectedServices.map((s) => ({
      booking_id: data.id,
      service_id: s.id,
      price_jod: Number(s.price_jod),
      duration_minutes: s.duration_minutes,
    }));
    await supabase.from("booking_services").insert(rows);

    setSubmitting(false);

    supabase.functions.invoke("notify-new-booking", {
      body: { booking_id: data.id },
    }).catch((e) => console.error("notify failed", e));

    navigate({
      to: "/booking-confirmed",
      search: {
        id: data.id,
        name: name.trim(),
        service: selectedServices.map((s) => localized(s)).join(", "),
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
          <Section title={t("selectServices")}>
            <p className="text-sm text-muted-foreground mb-4">{t("selectServicesHint")}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {services.map((s) => {
                const idx = selectedServiceIds.indexOf(s.id);
                const isSelected = idx >= 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    aria-pressed={isSelected}
                    className={`luxe-card relative text-start rounded-xl p-4 border transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/40 shadow-[var(--shadow-luxe)]"
                        : "border-border/60 hover:border-primary/40"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute -top-2 -start-2 h-7 w-7 rounded-full bg-primary text-primary-foreground grid place-items-center text-sm font-bold shadow-lg">
                        {idx + 1}
                      </div>
                    )}
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
                );
              })}
            </div>

            {selectedServices.length > 0 && (
              <div className="mt-6 luxe-card rounded-xl p-4 border-primary/30">
                <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-2">
                  {t("selected")} ({selectedServices.length})
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedServices.map((s, i) => (
                    <span key={s.id} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-primary/10 border border-primary/30 text-foreground">
                      <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground grid place-items-center text-[10px] font-bold">{i + 1}</span>
                      {localized(s)}
                    </span>
                  ))}
                </div>
                <div className="flex justify-between text-sm border-t border-border/40 pt-3">
                  <span className="text-muted-foreground">{t("totalDuration")}: <span className="text-foreground">{totalDuration} {t("min")}</span></span>
                  <span className="text-muted-foreground">{t("total")}: <span className="font-display text-lg gold-text">{totalPrice.toFixed(2)} {t("jod")}</span></span>
                </div>
              </div>
            )}
          </Section>
        )}

        {step === 2 && (
          <Section title={t("selectBarber")}>
            <div className="grid sm:grid-cols-2 gap-3">
              {barbers.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => { setBarberId(b.id); setDate(null); setTime(""); }}
                  aria-pressed={barberId === b.id}
                  className={`luxe-card rounded-xl p-5 flex items-center gap-4 border transition-all ${
                    barberId === b.id ? "border-primary ring-2 ring-primary/40 shadow-[var(--shadow-luxe)]" : "border-border/60 hover:border-primary/40"
                  }`}
                >
                  <div className="h-14 w-14 rounded-full gold-border grid place-items-center bg-gradient-to-br from-card to-background overflow-hidden shrink-0">
                    {b.photo_url ? (
                      <img src={b.photo_url} alt={localized(b)} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-5 w-5 text-primary/70" />
                    )}
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
                      type="button"
                      disabled={closed}
                      onClick={() => { setDate(d); setTime(""); }}
                      aria-pressed={!!selected}
                      className={`p-2 rounded-lg border-2 transition-all text-center ${
                        closed
                          ? "border-border/30 text-muted-foreground/40 cursor-not-allowed"
                          : selected
                          ? "border-primary bg-primary/15 text-primary ring-2 ring-primary/30"
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.iso}
                        type="button"
                        disabled={slot.disabled}
                        onClick={() => setTime(slot.time24)}
                        aria-pressed={time === slot.time24}
                        className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                          slot.disabled
                            ? "border-border/30 text-muted-foreground/40 line-through cursor-not-allowed"
                            : time === slot.time24
                            ? "border-primary bg-primary/15 text-primary ring-2 ring-primary/30"
                            : "border-border/60 hover:border-primary/50"
                        }`}
                      >
                        {slot.time12}
                      </button>
                    ))}
                  </div>
                )}
              </Section>
            )}
          </div>
        )}

        {step === 4 && selectedServices.length > 0 && barber && date && (
          <div className="space-y-6">
            <div className="luxe-card rounded-xl p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3">{t("bookingSummary")}</div>
              <div className="space-y-2 text-sm">
                <Row
                  icon={<Scissors className="h-4 w-4" />}
                  label={t("services")}
                  value={
                    <div className="text-end space-y-1">
                      {selectedServices.map((s, i) => (
                        <div key={s.id} className="flex items-center justify-end gap-2">
                          <span className="h-4 w-4 rounded-full bg-primary/20 text-primary grid place-items-center text-[10px] font-bold">{i + 1}</span>
                          <span>{localized(s)} · {s.price_jod} {t("jod")}</span>
                        </div>
                      ))}
                      <div className="text-xs text-muted-foreground pt-1 border-t border-border/30">
                        {t("total")}: <span className="gold-text font-display text-base">{totalPrice.toFixed(2)} {t("jod")}</span> · {totalDuration} {t("min")}
                      </div>
                    </div>
                  }
                />
                <Row icon={<User className="h-4 w-4" />} label={t("barbers")} value={localized(barber)} />
                <Row
                  icon={<CalIcon className="h-4 w-4" />}
                  label={t("selectDate")}
                  value={`${format(date, "EEEE, d MMM")} · ${format12h(new Date(`2000-01-01T${time}:00`))}`}
                />
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

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground shrink-0">
        <span className="text-primary/70">{icon}</span> {label}
      </div>
      <div className="text-foreground/95 font-medium text-end">{value}</div>
    </div>
  );
}
