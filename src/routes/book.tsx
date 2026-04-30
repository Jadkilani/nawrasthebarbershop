import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { z } from "zod";
import { format, addDays, addMinutes, isSameDay, startOfDay } from "date-fns";
import {
  ChevronLeft, ChevronRight, Check, Scissors, User, Calendar as CalIcon,
  Clock, Phone, LogIn, ArrowUp,
} from "lucide-react";

export const Route = createFileRoute("/book")({
  component: BookPage,
});

type Service = {
  id: string; name: string; name_ar: string | null;
  description: string | null; description_ar: string | null;
  price_jod: number; duration_minutes: number;
  conflict_group: string | null; includes_groups: string[] | null;
  sort_order: number;
};
type Barber = {
  id: string; name: string; name_ar: string | null;
  bio: string | null; photo_url: string | null; phone: string | null;
};
type WorkingHour = { weekday: number; open_time: string; close_time: string; is_open: boolean };

const SLOT_STEP = 30; // minutes
const BUFFER_MIN = 10; // buffer between bookings
const NAWRAS_OFF_DOW = 1; // Monday

function BookPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [closedDays, setClosedDays] = useState<string[]>([]);

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [barberId, setBarberId] = useState<string>("");
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [takenSlots, setTakenSlots] = useState<{ starts_at: string; ends_at: string }[]>([]);
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  // refs for auto-scroll
  const stepRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const topRef = useRef<HTMLDivElement>(null);

  // ---- Auth gate ----
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setAuthed(!!session);
      setAuthEmail(session?.user.email ?? null);
      if (session?.user.email) setName((n) => n || (session.user.user_metadata?.full_name as string) || "");
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthed(!!s);
      setAuthEmail(s?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---- Load reference data ----
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

  // ---- Auto-scroll helpers (smooth) ----
  const scrollToStep = (n: number) => {
    setTimeout(() => {
      stepRefs[n - 1]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };
  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // ---- Service selection logic with conflict groups ----
  const selected = useMemo(
    () => services.filter((s) => selectedServiceIds.includes(s.id)),
    [services, selectedServiceIds],
  );
  const totalPrice = selected.reduce((a, s) => a + Number(s.price_jod), 0);
  const totalDuration = selected.reduce((a, s) => a + s.duration_minutes, 0) + (selected.length > 1 ? (selected.length - 1) * 0 : 0);

  const toggleService = (svc: Service) => {
    if (selectedServiceIds.includes(svc.id)) {
      setSelectedServiceIds((ids) => ids.filter((id) => id !== svc.id));
      return;
    }
    if (svc.conflict_group) {
      // Find any currently-selected service in the same conflict group → replace
      const conflicts = services.filter(
        (s) => selectedServiceIds.includes(s.id) && s.conflict_group === svc.conflict_group,
      );
      if (conflicts.length > 0) {
        setSelectedServiceIds((ids) => [
          ...ids.filter((id) => !conflicts.some((c) => c.id === id)),
          svc.id,
        ]);
        toast.message(t("serviceSwapped"), { description: `${conflicts[0].name} → ${svc.name}` });
        return;
      }
    }
    setSelectedServiceIds((ids) => [...ids, svc.id]);
  };

  // ---- Barber availability today helper ----
  const isBarberAvailableOn = (barber: Barber, day: Date) => {
    const isNawras = barber.name.toLowerCase().includes("nawras");
    if (isNawras && day.getDay() === NAWRAS_OFF_DOW) return false;
    return true;
  };

  // ---- Date selection helpers ----
  const dateOptions = useMemo(() => {
    const out: Date[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 14; i++) {
      const d = addDays(today, i);
      const wh = workingHours.find((w) => w.weekday === d.getDay());
      if (!wh || !wh.is_open) continue;
      if (closedDays.includes(format(d, "yyyy-MM-dd"))) continue;
      const barber = barbers.find((b) => b.id === barberId);
      if (barber && !isBarberAvailableOn(barber, d)) continue;
      out.push(d);
    }
    return out;
  }, [workingHours, closedDays, barbers, barberId]);

  // ---- Load taken slots when barber + date change ----
  useEffect(() => {
    (async () => {
      if (!barberId || !date) { setTakenSlots([]); return; }
      const { data } = await supabase.rpc("get_taken_slots", {
        _barber_id: barberId,
        _day: format(date, "yyyy-MM-dd"),
      });
      setTakenSlots((data ?? []) as { starts_at: string; ends_at: string }[]);
    })();
  }, [barberId, date]);

  // ---- Generate time slots ----
  const timeSlots = useMemo(() => {
    if (!date) return [] as { value: string; label: string; disabled: boolean }[];
    const wh = workingHours.find((w) => w.weekday === date.getDay());
    if (!wh || !wh.is_open) return [];
    const [oh, om] = wh.open_time.split(":").map(Number);
    const [ch, cm] = wh.close_time.split(":").map(Number);
    const open = new Date(date); open.setHours(oh, om, 0, 0);
    const close = new Date(date); close.setHours(ch, cm, 0, 0);
    const lastStart = addMinutes(close, -Math.max(totalDuration || 30, 30));
    const out: { value: string; label: string; disabled: boolean }[] = [];
    let cur = new Date(open);
    const now = new Date();
    while (cur <= lastStart) {
      const slotEnd = addMinutes(cur, totalDuration || 30);
      const slotStart = cur;
      const isPast = isSameDay(slotStart, now) && slotStart <= addMinutes(now, 5);
      const overlaps = takenSlots.some((tk) => {
        const ts = new Date(tk.starts_at);
        const te = new Date(tk.ends_at);
        const bufStart = addMinutes(ts, -BUFFER_MIN);
        const bufEnd = addMinutes(te, BUFFER_MIN);
        return slotStart < bufEnd && slotEnd > bufStart;
      });
      out.push({
        value: format(slotStart, "HH:mm"),
        label: format(slotStart, "h:mm a"),
        disabled: isPast || overlaps,
      });
      cur = addMinutes(cur, SLOT_STEP);
    }
    return out;
  }, [date, workingHours, takenSlots, totalDuration]);

  // ---- Validation per step ----
  const canProceed = (s: number) => {
    if (s === 1) return selectedServiceIds.length > 0;
    if (s === 2) return !!barberId;
    if (s === 3) return !!date && !!time;
    return true;
  };

  const goNext = async () => {
    if (!canProceed(step)) {
      toast.error(t("completeStep"));
      return;
    }
    if (step === 3) {
      // Check duplicate booking by phone (if user provided phone before)
      // We'll check at submit instead; just advance
    }
    const next = step + 1;
    setStep(next);
    scrollToStep(next);
  };
  const goBack = () => {
    const prev = Math.max(1, step - 1);
    setStep(prev);
    scrollToStep(prev);
  };

  // ---- Submit ----
  const submit = async (force = false) => {
    setSubmitting(true);
    try {
      const schema = z.object({
        name: z.string().trim().min(2, t("invalidName")).max(100),
        phone: z.string().trim().min(6, t("invalidPhone")).max(20),
      });
      const parsed = schema.safeParse({ name, phone });
      if (!parsed.success) {
        setSubmitting(false);
        toast.error(parsed.error.issues[0].message);
        return;
      }
      if (!date || !time || !barberId || selected.length === 0) {
        setSubmitting(false);
        toast.error(t("completeStep"));
        return;
      }

      // duplicate check
      if (!force) {
        const { data: dup } = await supabase.rpc("has_active_booking_by_phone", { _phone: phone.trim() });
        if (dup === true) {
          setSubmitting(false);
          setDuplicateOpen(true);
          return;
        }
      }

      const [h, m] = time.split(":").map(Number);
      const starts = new Date(date); starts.setHours(h, m, 0, 0);
      const ends = addMinutes(starts, totalDuration || 30);

      // Insert master booking using the *first* service as primary (legacy column)
      const primary = selected[0];
      const { data: booking, error } = await supabase
        .from("bookings")
        .insert({
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_notes: notes.trim() || null,
          barber_id: barberId,
          service_id: primary.id,
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
        })
        .select("id")
        .single();
      if (error || !booking) {
        setSubmitting(false);
        toast.error(t("bookingError"));
        return;
      }

      // Insert booking_services rows for all selected
      if (selected.length > 0) {
        await supabase.from("booking_services").insert(
          selected.map((s) => ({
            booking_id: booking.id,
            service_id: s.id,
            duration_minutes: s.duration_minutes,
            price_jod: s.price_jod,
          })),
        );
      }

      // Notify (fire & forget)
      try {
        await supabase.functions.invoke("notify-new-booking", { body: { booking_id: booking.id } });
      } catch { /* ignore */ }

      const barber = barbers.find((b) => b.id === barberId);
      navigate({
        to: "/booking-confirmed",
        search: {
          id: booking.id,
          name: name.trim(),
          service: selected.map((s) => s.name).join(" + "),
          barber: barber?.name ?? "",
          when: starts.toISOString(),
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Auth required gate ----
  if (authed === null) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">{t("loading")}</div>;
  }
  if (!authed) {
    return <CustomerAuthGate onAuthed={() => setAuthed(true)} />;
  }

  // ---- Active step indicator ----
  const StepBadge = ({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) => (
    <div className={`flex items-center gap-2 transition-colors ${active ? "text-primary" : done ? "text-foreground/80" : "text-muted-foreground"}`}>
      <div className={`h-7 w-7 rounded-full grid place-items-center text-xs font-semibold transition-all ${
        active ? "bg-primary text-primary-foreground ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
        : done ? "bg-primary/15 text-primary border border-primary/40"
        : "bg-card border border-border/60"
      }`}>{done ? <Check className="h-3.5 w-3.5" /> : n}</div>
      <span className="text-xs uppercase tracking-wider hidden sm:inline">{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col pb-28">
      <SiteHeader />
      <div ref={topRef} />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl gold-text">{t("bookNow")}</h1>
          <div className="text-xs text-muted-foreground">{authEmail}</div>
        </div>

        <div className="luxe-card rounded-xl p-3 mb-6 flex items-center justify-between flex-wrap gap-3">
          <StepBadge n={1} label={t("services")} active={step === 1} done={step > 1} />
          <div className="h-px flex-1 bg-border/40 min-w-[16px]" />
          <StepBadge n={2} label={t("selectBarber")} active={step === 2} done={step > 2} />
          <div className="h-px flex-1 bg-border/40 min-w-[16px]" />
          <StepBadge n={3} label={t("selectDate")} active={step === 3} done={step > 3} />
          <div className="h-px flex-1 bg-border/40 min-w-[16px]" />
          <StepBadge n={4} label={t("yourDetails")} active={step === 4} done={false} />
        </div>

        {/* STEP 1 - Services */}
        <section ref={stepRefs[0]} className={`scroll-mt-20 transition-opacity duration-300 ${step === 1 ? "opacity-100" : "opacity-60"}`}>
          {step === 1 && (
            <>
              <SectionTitle title={t("selectServices")} hint={t("selectServicesHint")} />
              <div className="grid sm:grid-cols-2 gap-3">
                {services.map((s) => {
                  const idx = selectedServiceIds.indexOf(s.id);
                  const isSelected = idx >= 0;
                  const lname = lang === "ar" && s.name_ar ? s.name_ar : s.name;
                  const ldesc = lang === "ar" && s.description_ar ? s.description_ar : s.description;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleService(s)}
                      className={`relative text-start rounded-xl p-4 transition-all duration-200 ${
                        isSelected
                          ? "border-2 border-primary bg-primary/5 shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
                          : "luxe-card hover:border-primary/40"
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute -top-2 -end-2 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold grid place-items-center shadow">
                          {idx + 1}
                        </span>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-display text-lg">{lname}</div>
                          {ldesc && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{ldesc}</p>}
                        </div>
                        <Scissors className="h-4 w-4 text-primary/50 shrink-0" />
                      </div>
                      <div className="mt-3 flex items-end justify-between text-sm">
                        <span className="text-muted-foreground text-xs">{s.duration_minutes} {t("min")}</span>
                        <span className="font-display text-lg gold-text">{s.price_jod} <span className="text-[10px] text-muted-foreground">{t("jod")}</span></span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {selected.length > 0 && (
                <div className="mt-4 luxe-card rounded-xl p-4 flex items-center justify-between">
                  <div className="text-sm">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("selected")}</div>
                    <div className="font-medium mt-0.5">{selected.map((s) => s.name).join(" + ")}</div>
                  </div>
                  <div className="text-end">
                    <div className="font-display text-2xl gold-text">{totalPrice} <span className="text-xs text-muted-foreground">{t("jod")}</span></div>
                    <div className="text-[10px] text-muted-foreground">{totalDuration} {t("min")}</div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* STEP 2 - Barber */}
        <section ref={stepRefs[1]} className={`scroll-mt-20 mt-8 transition-opacity duration-300 ${step === 2 ? "opacity-100" : "opacity-60"}`}>
          {step === 2 && (
            <>
              <SectionTitle title={t("selectBarber")} />
              <div className="grid sm:grid-cols-2 gap-4">
                {barbers.map((b) => {
                  const today = new Date();
                  const offToday = !isBarberAvailableOn(b, today);
                  const isSelected = barberId === b.id;
                  const display = b.name.replace(/master barber/i, "").trim() || b.name;
                  const isMaster = b.name.toLowerCase().includes("nawras");
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBarberId(b.id)}
                      className={`text-start rounded-xl p-5 transition-all duration-200 ${
                        isSelected
                          ? "border-2 border-primary bg-primary/5 shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
                          : "luxe-card hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-full overflow-hidden gold-border bg-card grid place-items-center shrink-0">
                          {b.photo_url
                            ? <img src={b.photo_url} alt={display} className="h-full w-full object-cover" />
                            : <User className="h-7 w-7 text-primary/60" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-xl">{display}</div>
                          <div className="text-xs text-primary/80 mt-0.5">{isMaster ? "Master Barber" : (b.bio || "Barber")}</div>
                          {b.phone && (
                            <a href={`tel:${b.phone}`} onClick={(e) => e.stopPropagation()} className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 mt-1">
                              <Phone className="h-3 w-3" /> {b.phone}
                            </a>
                          )}
                          {isMaster && (
                            <div className="text-[10px] uppercase tracking-wider mt-1.5 inline-block px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-300 bg-amber-500/10">
                              {t("unavailableMonday")}
                            </div>
                          )}
                          {offToday && (
                            <div className="text-[10px] uppercase tracking-wider mt-1.5 inline-block px-2 py-0.5 rounded-full border border-destructive/40 text-destructive bg-destructive/10">
                              {t("unavailableToday")}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* STEP 3 - Date + Time */}
        <section ref={stepRefs[2]} className={`scroll-mt-20 mt-8 transition-opacity duration-300 ${step === 3 ? "opacity-100" : "opacity-60"}`}>
          {step === 3 && (
            <>
              <SectionTitle title={t("selectDate")} />
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                {dateOptions.map((d) => {
                  const active = date && isSameDay(d, date);
                  return (
                    <button
                      key={d.toISOString()}
                      type="button"
                      onClick={() => {
                        setDate(d);
                        setTime("");
                        // auto-scroll to time within step
                        setTimeout(() => stepRefs[2].current?.querySelector("[data-time-section]")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                      }}
                      className={`shrink-0 w-20 py-3 rounded-xl text-center transition-all duration-200 ${
                        active
                          ? "border-2 border-primary bg-primary/10 shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
                          : "luxe-card hover:border-primary/40"
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{format(d, "EEE")}</div>
                      <div className="font-display text-2xl mt-1">{format(d, "d")}</div>
                      <div className="text-[10px] text-muted-foreground">{format(d, "MMM")}</div>
                    </button>
                  );
                })}
              </div>

              <div data-time-section className="mt-6">
                <SectionTitle title={t("selectTime")} />
                {!date ? (
                  <div className="text-sm text-muted-foreground luxe-card rounded-xl p-6 text-center">{t("selectDate")}</div>
                ) : timeSlots.length === 0 ? (
                  <div className="text-sm text-muted-foreground luxe-card rounded-xl p-6 text-center">{t("noSlots")}</div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {timeSlots.map((s) => {
                      const active = time === s.value;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          disabled={s.disabled}
                          onClick={() => setTime(s.value)}
                          className={`py-2.5 rounded-lg text-sm transition-all duration-200 ${
                            active
                              ? "border-2 border-primary bg-primary/10 text-primary font-semibold"
                              : s.disabled
                              ? "border border-border/30 text-muted-foreground/40 line-through cursor-not-allowed bg-card/30"
                              : "luxe-card hover:border-primary/40"
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* STEP 4 - Details */}
        <section ref={stepRefs[3]} className={`scroll-mt-20 mt-8 transition-opacity duration-300 ${step === 4 ? "opacity-100" : "opacity-60"}`}>
          {step === 4 && (
            <>
              <SectionTitle title={t("yourDetails")} />
              <div className="luxe-card rounded-xl p-5 space-y-4">
                <div>
                  <Label htmlFor="bn">{t("fullName")}</Label>
                  <Input id="bn" className="mt-1.5 bg-input/60 border-border/60" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="bp">{t("phone")}</Label>
                  <Input id="bp" type="tel" className="mt-1.5 bg-input/60 border-border/60" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+962 ..." />
                </div>
                <div>
                  <Label htmlFor="bnt">{t("notes")}</Label>
                  <Textarea id="bnt" className="mt-1.5 bg-input/60 border-border/60" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                </div>
              </div>

              <div className="luxe-card rounded-xl p-5 mt-4">
                <div className="text-xs uppercase tracking-wider text-primary/80 mb-3">{t("bookingSummary")}</div>
                <div className="text-sm space-y-1.5">
                  <SummaryRow icon={<Scissors className="h-3.5 w-3.5" />} label={t("services")} value={selected.map((s) => s.name).join(" + ") || "—"} />
                  <SummaryRow icon={<User className="h-3.5 w-3.5" />} label={t("selectBarber")} value={barbers.find((b) => b.id === barberId)?.name || "—"} />
                  <SummaryRow icon={<CalIcon className="h-3.5 w-3.5" />} label={t("selectDate")} value={date ? format(date, "EEE, d MMM") : "—"} />
                  <SummaryRow icon={<Clock className="h-3.5 w-3.5" />} label={t("selectTime")} value={time ? format(new Date(`2000-01-01T${time}`), "h:mm a") : "—"} />
                  <div className="hairline my-2" />
                  <SummaryRow label={t("total")} value={`${totalPrice} ${t("jod")} · ${totalDuration} ${t("min")}`} bold />
                </div>
              </div>
            </>
          )}
        </section>

        {/* Back to top */}
        <div className="mt-8 text-center">
          <Button variant="ghost" size="sm" onClick={scrollTop} className="text-muted-foreground hover:text-primary">
            <ArrowUp className="h-4 w-4" /> {t("backToTop")}
          </Button>
        </div>
      </main>

      {/* Sticky Back / Next bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl bg-background/85 border-t border-border/60">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={step === 1 ? () => navigate({ to: "/" }) : goBack}
            className="border-border/60"
          >
            <ChevronLeft className="h-4 w-4" /> {t("back")}
          </Button>
          <div className="text-xs text-muted-foreground">{t("step")} {step} {t("of")} 4</div>
          {step < 4 ? (
            <Button
              onClick={goNext}
              disabled={!canProceed(step)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              {t("next")} <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => submit(false)}
              disabled={submitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              {submitting ? t("loading") : t("confirmBooking")} <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Duplicate booking dialog */}
      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent className="bg-card border-border/60">
          <DialogHeader>
            <DialogTitle>{t("duplicateBookingTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("duplicateBookingMsg")}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDuplicateOpen(false)} className="border-border/60">{t("no")}</Button>
            <Button onClick={() => { setDuplicateOpen(false); submit(true); }} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {t("yes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-2xl">{title}</h2>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function SummaryRow({ icon, label, value, bold }: { icon?: React.ReactNode; label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
        {icon && <span className="text-primary/70">{icon}</span>} {label}
      </div>
      <div className={`text-end ${bold ? "font-display text-lg gold-text" : "text-foreground/95"}`}>{value}</div>
    </div>
  );
}

/* ---------------- Customer Auth Gate ---------------- */
function CustomerAuthGate({ onAuthed }: { onAuthed: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (tab === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Signed in");
      onAuthed();
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin + "/book" : undefined,
          data: { full_name: name },
        },
      });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Account created — check your email to confirm, then sign in.");
      setTab("signin");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4 py-12">
        <form onSubmit={submit} className="luxe-card rounded-2xl p-8 max-w-sm w-full">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 grid place-items-center mb-4">
            <LogIn className="h-5 w-5 text-primary" />
          </div>
          <h1 className="font-display text-2xl text-center gold-text">{t("customerLogin")}</h1>
          <p className="text-xs text-center text-muted-foreground mt-1">{t("loginRequired")}</p>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")} className="mt-6">
            <TabsList className="grid grid-cols-2 w-full bg-card border border-border/60">
              <TabsTrigger value="signin">{t("signIn")}</TabsTrigger>
              <TabsTrigger value="signup">{t("createAccount")}</TabsTrigger>
            </TabsList>
            <TabsContent value="signup" className="mt-4">
              <Label>{t("fullName")}</Label>
              <Input className="mt-1.5 bg-input/60 border-border/60" value={name} onChange={(e) => setName(e.target.value)} required={tab === "signup"} />
            </TabsContent>
          </Tabs>

          <div className="mt-4 space-y-3">
            <div>
              <Label>{t("email")}</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 bg-input/60 border-border/60" />
            </div>
            <div>
              <Label>{t("password")}</Label>
              <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 bg-input/60 border-border/60" />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            {loading ? t("loading") : tab === "signin" ? t("signIn") : t("createAccount")}
          </Button>

          <div className="hairline my-4" />
          <div className="flex items-center justify-between text-xs">
            <Link to="/" className="text-muted-foreground hover:text-primary">← {t("back_home")}</Link>
            <Link to="/admin" className="text-muted-foreground hover:text-primary">{t("staffLogin")} →</Link>
          </div>
        </form>
      </main>
    </div>
  );
}
