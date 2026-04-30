import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { LogOut, Plus, Trash2, Pencil, Calendar, Scissors, Users, Clock, CalendarOff, Phone, MessageCircle, Mail } from "lucide-react";

export const Route = createFileRoute("/admin/dashboard")({
  component: Dashboard,
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
  status: "pending" | "confirmed" | "completed" | "cancelled";
  services?: { name: string; price_jod: number } | null;
  barbers?: { name: string } | null;
};
type Service = { id: string; name: string; name_ar: string | null; price_jod: number; duration_minutes: number; active: boolean; sort_order: number };
type Barber = { id: string; name: string; name_ar: string | null; bio: string | null; active: boolean; sort_order: number };
type WorkingHour = { id: string; weekday: number; open_time: string; close_time: string; is_open: boolean };
type ClosedDay = { id: string; closed_date: string; reason: string | null };
type Unavail = { id: string; barber_id: string; starts_at: string; ends_at: string; reason: string | null };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Dashboard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [tab, setTab] = useState("appointments");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin" });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate({ to: "/admin" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/admin" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-display text-xl gold-text">{t("dashboard")}</div>
            <span className="text-xs text-muted-foreground hidden sm:inline">Nawras Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/">View site</Link></Button>
            <Button onClick={signOut} variant="outline" size="sm" className="border-border/60">
              <LogOut className="h-4 w-4" /> {t("signOut")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-card border border-border/60 p-1 h-auto flex-wrap">
            <TabsTrigger value="appointments"><Calendar className="h-4 w-4 me-1.5" /> {t("appointments")}</TabsTrigger>
            <TabsTrigger value="services"><Scissors className="h-4 w-4 me-1.5" /> {t("manageServices")}</TabsTrigger>
            <TabsTrigger value="staff"><Users className="h-4 w-4 me-1.5" /> Staff</TabsTrigger>
            <TabsTrigger value="barbers"><Users className="h-4 w-4 me-1.5" /> {t("manageBarbers")}</TabsTrigger>
            <TabsTrigger value="hours"><Clock className="h-4 w-4 me-1.5" /> {t("manageHours")}</TabsTrigger>
            <TabsTrigger value="closed"><CalendarOff className="h-4 w-4 me-1.5" /> {t("closedDays")}</TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="mt-6"><AppointmentsTab /></TabsContent>
          <TabsContent value="services" className="mt-6"><ServicesTab /></TabsContent>
          <TabsContent value="staff" className="mt-6"><StaffTab /></TabsContent>
          <TabsContent value="barbers" className="mt-6"><BarbersTab /></TabsContent>
          <TabsContent value="hours" className="mt-6"><HoursTab /></TabsContent>
          <TabsContent value="closed" className="mt-6"><ClosedDaysTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ---------------- APPOINTMENTS ---------------- */
function AppointmentsTab() {
  const { t } = useI18n();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [range, setRange] = useState<"today" | "week" | "all">("today");
  const [barberFilter, setBarberFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("bookings").select("*, services(name, price_jod), barbers(name)").order("starts_at", { ascending: true });
    if (range === "today") {
      q = q.gte("starts_at", startOfDay(new Date()).toISOString()).lte("starts_at", endOfDay(new Date()).toISOString());
    } else if (range === "week") {
      q = q.gte("starts_at", startOfDay(new Date()).toISOString()).lte("starts_at", endOfDay(addDays(new Date(), 7)).toISOString());
    }
    if (barberFilter !== "all") q = q.eq("barber_id", barberFilter);
    if (statusFilter !== "all") q = q.eq("status", statusFilter as Booking["status"]);
    const { data } = await q;
    setBookings((data ?? []) as Booking[]);
    setLoading(false);
  }, [range, barberFilter, statusFilter]);

  useEffect(() => {
    supabase.from("barbers").select("*").order("sort_order").then(({ data }) => setBarbers((data ?? []) as Barber[]));
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const updateStatus = async (id: string, status: Booking["status"]) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <Tabs value={range} onValueChange={(v) => setRange(v as typeof range)}>
          <TabsList className="bg-card border border-border/60">
            <TabsTrigger value="today">{t("today")}</TabsTrigger>
            <TabsTrigger value="week">{t("thisWeek")}</TabsTrigger>
            <TabsTrigger value="all">{t("all")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={barberFilter} onValueChange={setBarberFilter}>
          <SelectTrigger className="w-44 bg-card border-border/60"><SelectValue placeholder={t("filterBarber")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterBarber")} · {t("all")}</SelectItem>
            {barbers.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 bg-card border-border/60"><SelectValue placeholder={t("filterStatus")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterStatus")} · {t("all")}</SelectItem>
            <SelectItem value="pending">{t("pending")}</SelectItem>
            <SelectItem value="confirmed">{t("confirmed")}</SelectItem>
            <SelectItem value="completed">{t("completed")}</SelectItem>
            <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
          </SelectContent>
        </Select>
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
                    {b.services?.name} · {b.barbers?.name} · {b.services?.price_jod} JOD
                  </div>
                  <div className="text-sm mt-1.5 text-foreground/85 font-medium">
                    {format(new Date(b.starts_at), "EEE, d MMM · h:mm a")}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    <a href={`tel:${b.customer_phone}`} className="text-muted-foreground hover:text-primary inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {b.customer_phone}</a>
                    <a href={`https://wa.me/${b.customer_phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
                  </div>
                  {b.customer_notes && <div className="mt-2 text-xs text-muted-foreground italic">"{b.customer_notes}"</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {b.status !== "confirmed" && b.status !== "completed" && (
                    <Button size="sm" onClick={() => updateStatus(b.id, "confirmed")} className="bg-primary text-primary-foreground hover:bg-primary/90">{t("confirm")}</Button>
                  )}
                  {b.status !== "completed" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, "completed")} className="border-border/60">{t("markCompleted")}</Button>
                  )}
                  {b.status !== "cancelled" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, "cancelled")} className="border-destructive/40 text-destructive hover:bg-destructive/10">{t("cancel")}</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Booking["status"] }) {
  const map: Record<Booking["status"], string> = {
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    confirmed: "bg-primary/15 text-primary border-primary/30",
    completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${map[status]}`}>{status}</span>;
}

/* ---------------- SERVICES ---------------- */
function ServicesTab() {
  const { t } = useI18n();
  const [items, setItems] = useState<Service[]>([]);
  const [editing, setEditing] = useState<Partial<Service> | null>(null);

  const load = () => supabase.from("services").select("*").order("sort_order").then(({ data }) => setItems((data ?? []) as Service[]));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const payload = {
      name: editing.name ?? "",
      name_ar: editing.name_ar ?? null,
      price_jod: Number(editing.price_jod ?? 0),
      duration_minutes: Number(editing.duration_minutes ?? 30),
      active: editing.active ?? true,
      sort_order: Number(editing.sort_order ?? 0),
    };
    if (!payload.name || payload.price_jod < 0) return toast.error("Invalid data");
    const res = editing.id
      ? await supabase.from("services").update(payload).eq("id", editing.id)
      : await supabase.from("services").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Saved");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this service?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setEditing({ active: true, duration_minutes: 30 })} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> {t("add")}</Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((s) => (
          <div key={s.id} className="luxe-card rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display text-lg">{s.name}</div>
                {s.name_ar && <div className="text-xs text-muted-foreground" dir="rtl">{s.name_ar}</div>}
                <div className="mt-2 text-sm">
                  <span className="gold-text font-display text-lg">{s.price_jod}</span> <span className="text-muted-foreground text-xs">JOD · {s.duration_minutes} min</span>
                </div>
                {!s.active && <span className="text-[10px] uppercase text-muted-foreground">Inactive</span>}
              </div>
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-card border-border/60">
          <DialogHeader><DialogTitle>{editing?.id ? t("edit") : t("add")} {t("services")}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>{t("name")}</Label><Input className="mt-1.5" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>{t("nameAr")}</Label><Input className="mt-1.5" dir="rtl" value={editing.name_ar ?? ""} onChange={(e) => setEditing({ ...editing, name_ar: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("price")} (JOD)</Label><Input className="mt-1.5" type="number" step="0.5" value={editing.price_jod ?? 0} onChange={(e) => setEditing({ ...editing, price_jod: Number(e.target.value) })} /></div>
                <div><Label>{t("duration")} (min)</Label><Input className="mt-1.5" type="number" value={editing.duration_minutes ?? 30} onChange={(e) => setEditing({ ...editing, duration_minutes: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center justify-between"><Label>{t("active")}</Label><Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={save} className="bg-primary text-primary-foreground hover:bg-primary/90">{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- STAFF ALLOWLIST ---------------- */
function StaffTab() {
  const { t } = useI18n();
  const [staff, setStaff] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [selectedBarberId, setSelectedBarberId] = useState<string>("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("staff_allowlist").select("*").order("created_at", { ascending: false });
    setStaff((data ?? []) as any[]);
    const { data: b } = await supabase.from("barbers").select("*").order("sort_order");
    setBarbers((b ?? []) as Barber[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addStaff = async () => {
    if (!newEmail || !newEmail.includes("@")) return toast.error("Valid email required");
    const { error } = await supabase.from("staff_allowlist").insert({
      email: newEmail.toLowerCase(),
      phone: newPhone || null,
      barber_id: selectedBarberId || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Staff member added");
    setNewEmail("");
    setNewPhone("");
    setSelectedBarberId("");
    setAdding(false);
    load();
  };

  const removeStaff = async (id: string) => {
    if (!confirm("Remove this staff member?")) return;
    const { error } = await supabase.from("staff_allowlist").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Staff member removed");
    load();
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setAdding(!adding)} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> Add Staff</Button>
      </div>

      {adding && (
        <div className="luxe-card rounded-xl p-5 mb-6">
          <h3 className="font-display text-lg mb-4">Add Staff Member</h3>
          <div className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="staff@example.com" className="mt-1.5" />
            </div>
            <div>
              <Label>Phone (optional)</Label>
              <Input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+962X XXXX XXXX" className="mt-1.5" />
            </div>
            <div>
              <Label>Assign to Barber (optional)</Label>
              <Select value={selectedBarberId} onValueChange={setSelectedBarberId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {barbers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={addStaff} className="bg-primary text-primary-foreground hover:bg-primary/90">Save</Button>
              <Button onClick={() => setAdding(false)} variant="outline">Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {staff.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No staff members added yet</div>
        ) : (
          staff.map((s) => (
            <div key={s.id} className="luxe-card rounded-xl p-4 flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-lg flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" /> {s.email}
                </div>
                {s.phone && <div className="text-sm text-muted-foreground mt-1"><Phone className="h-3.5 w-3.5 inline me-1" />{s.phone}</div>}
                {s.barber_id && <div className="text-xs text-primary/70 mt-1">Assigned to barber</div>}
              </div>
              <Button size="sm" variant="outline" onClick={() => removeStaff(s.id)} className="border-destructive/40 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* -------- BARBERS -------- */
function BarbersTab() {
  const { t } = useI18n();
  const [items, setItems] = useState<Barber[]>([]);
  const [editing, setEditing] = useState<Partial<Barber> | null>(null);
  const [unavail, setUnavail] = useState<Unavail[]>([]);
  const [unavailFor, setUnavailFor] = useState<Barber | null>(null);
  const [newUnavail, setNewUnavail] = useState({ starts_at: "", ends_at: "", reason: "" });

  const load = () => supabase.from("barbers").select("*").order("sort_order").then(({ data }) => setItems((data ?? []) as Barber[]));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!unavailFor) return;
    supabase.from("barber_unavailability").select("*").eq("barber_id", unavailFor.id).order("starts_at").then(({ data }) => setUnavail((data ?? []) as Unavail[]));
  }, [unavailFor]);

  const save = async () => {
    if (!editing) return;
    const payload = {
      name: editing.name ?? "",
      name_ar: editing.name_ar ?? null,
      bio: editing.bio ?? null,
      active: editing.active ?? true,
      sort_order: Number(editing.sort_order ?? 0),
    };
    if (!payload.name) return toast.error("Name required");
    const res = editing.id
      ? await supabase.from("barbers").update(payload).eq("id", editing.id)
      : await supabase.from("barbers").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Saved");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this barber?")) return;
    const { error } = await supabase.from("barbers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const addUnavail = async () => {
    if (!unavailFor || !newUnavail.starts_at || !newUnavail.ends_at) return;
    const { error } = await supabase.from("barber_unavailability").insert({
      barber_id: unavailFor.id,
      starts_at: new Date(newUnavail.starts_at).toISOString(),
      ends_at: new Date(newUnavail.ends_at).toISOString(),
      reason: newUnavail.reason || null,
    });
    if (error) return toast.error(error.message);
    setNewUnavail({ starts_at: "", ends_at: "", reason: "" });
    const { data } = await supabase.from("barber_unavailability").select("*").eq("barber_id", unavailFor.id).order("starts_at");
    setUnavail((data ?? []) as Unavail[]);
  };

  const removeUnavail = async (id: string) => {
    await supabase.from("barber_unavailability").delete().eq("id", id);
    setUnavail((u) => u.filter((x) => x.id !== id));
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setEditing({ active: true })} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> {t("add")}</Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((b) => (
          <div key={b.id} className="luxe-card rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display text-lg">{b.name}</div>
                {b.name_ar && <div className="text-xs text-muted-foreground" dir="rtl">{b.name_ar}</div>}
                {b.bio && <div className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{b.bio}</div>}
                {!b.active && <span className="text-[10px] uppercase text-muted-foreground">Inactive</span>}
              </div>
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditing(b)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
            <Button size="sm" variant="outline" className="mt-3 w-full border-border/60" onClick={() => setUnavailFor(b)}>
              <CalendarOff className="h-3.5 w-3.5" /> Unavailable times
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-card border-border/60">
          <DialogHeader><DialogTitle>{editing?.id ? t("edit") : t("add")} {t("barbers")}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>{t("name")}</Label><Input className="mt-1.5" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>{t("nameAr")}</Label><Input className="mt-1.5" dir="rtl" value={editing.name_ar ?? ""} onChange={(e) => setEditing({ ...editing, name_ar: e.target.value })} /></div>
              <div><Label>Bio</Label><Textarea className="mt-1.5" rows={3} value={editing.bio ?? ""} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} /></div>
              <div className="flex items-center justify-between"><Label>{t("active")}</Label><Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={save} className="bg-primary text-primary-foreground hover:bg-primary/90">{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!unavailFor} onOpenChange={(o) => !o && setUnavailFor(null)}>
        <DialogContent className="bg-card border-border/60 max-w-lg">
          <DialogHeader><DialogTitle>Unavailable times — {unavailFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-60 overflow-auto">
            {unavail.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">None</div>}
            {unavail.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2 p-2 rounded border border-border/40 text-sm">
                <div>
                  <div>{format(new Date(u.starts_at), "d MMM h:mm a")} → {format(new Date(u.ends_at), "d MMM h:mm a")}</div>
                  {u.reason && <div className="text-xs text-muted-foreground">{u.reason}</div>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeUnavail(u.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
          <div className="hairline my-2" />
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">From</Label><Input type="datetime-local" value={newUnavail.starts_at} onChange={(e) => setNewUnavail({ ...newUnavail, starts_at: e.target.value })} /></div>
              <div><Label className="text-xs">To</Label><Input type="datetime-local" value={newUnavail.ends_at} onChange={(e) => setNewUnavail({ ...newUnavail, ends_at: e.target.value })} /></div>
            </div>
            <Input placeholder="Reason (optional)" value={newUnavail.reason} onChange={(e) => setNewUnavail({ ...newUnavail, reason: e.target.value })} />
            <Button onClick={addUnavail} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Add unavailable</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- HOURS ---------------- */
function HoursTab() {
  const { t } = useI18n();
  const [hours, setHours] = useState<WorkingHour[]>([]);

  useEffect(() => {
    supabase.from("working_hours").select("*").order("weekday").then(({ data }) => setHours((data ?? []) as WorkingHour[]));
  }, []);

  const update = (id: string, patch: Partial<WorkingHour>) => {
    setHours((h) => h.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const saveAll = async () => {
    for (const h of hours) {
      await supabase.from("working_hours").update({ open_time: h.open_time, close_time: h.close_time, is_open: h.is_open }).eq("id", h.id);
    }
    toast.success("Hours saved");
  };

  return (
    <div className="luxe-card rounded-xl p-5 max-w-2xl">
      <div className="space-y-3">
        {hours.map((h) => (
          <div key={h.id} className="flex flex-wrap items-center gap-3 py-2 border-b border-border/30 last:border-0">
            <div className="w-16 font-medium">{WEEKDAYS[h.weekday]}</div>
            <Switch checked={h.is_open} onCheckedChange={(v) => update(h.id, { is_open: v })} />
            <span className="text-xs text-muted-foreground w-14">{h.is_open ? t("open") : t("closed")}</span>
            <Input type="time" value={h.open_time.slice(0, 5)} onChange={(e) => update(h.id, { open_time: e.target.value })} className="w-32" disabled={!h.is_open} />
            <span className="text-muted-foreground">—</span>
            <Input type="time" value={h.close_time.slice(0, 5)} onChange={(e) => update(h.id, { close_time: e.target.value })} className="w-32" disabled={!h.is_open} />
          </div>
        ))}
      </div>
      <Button onClick={saveAll} className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90">{t("save")}</Button>
    </div>
  );
}

/* ---------------- CLOSED DAYS ---------------- */
function ClosedDaysTab() {
  const { t } = useI18n();
  const [days, setDays] = useState<ClosedDay[]>([]);
  const [newDay, setNewDay] = useState("");
  const [reason, setReason] = useState("");

  const load = () => supabase.from("closed_days").select("*").order("closed_date").then(({ data }) => setDays((data ?? []) as ClosedDay[]));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newDay) return;
    const { error } = await supabase.from("closed_days").insert({ closed_date: newDay, reason: reason || null });
    if (error) return toast.error(error.message);
    setNewDay(""); setReason(""); load();
  };
  const remove = async (id: string) => { await supabase.from("closed_days").delete().eq("id", id); load(); };

  return (
    <div className="luxe-card rounded-xl p-5 max-w-xl">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div><Label className="text-xs">Date</Label><Input type="date" value={newDay} onChange={(e) => setNewDay(e.target.value)} /></div>
        <div><Label className="text-xs">Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <Button onClick={add} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="hairline my-4" />
      <div className="space-y-2">
        {days.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">No closed days</div>}
        {days.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-2 p-2 rounded border border-border/40 text-sm">
            <div>
              <div className="font-medium">{format(new Date(d.closed_date + "T00:00:00"), "EEE, d MMM yyyy")}</div>
              {d.reason && <div className="text-xs text-muted-foreground">{d.reason}</div>}
            </div>
            <Button size="icon" variant="ghost" onClick={() => remove(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
