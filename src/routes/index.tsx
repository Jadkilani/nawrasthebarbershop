import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Phone, MessageCircle, Star, Scissors, ArrowRight, Instagram, Facebook } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import heroImage from "@/assets/hero-barbershop.jpg";

const INSTAGRAM_URL = "https://www.instagram.com/nawras.jo1?igsh=aXFqM2NibXM4NzVx";
const FACEBOOK_URL = "https://www.facebook.com/share/1Bp3jCRwy1/";
const MAP_QUERY = "Nawras+The+Barbershop+Wadi+Al-Seer+Amman";
const MAP_EMBED = `https://www.google.com/maps?q=${MAP_QUERY}&output=embed`;
const MAP_LINK = `https://www.google.com/maps/search/?api=1&query=${MAP_QUERY}`;

export const Route = createFileRoute("/")({
  component: Index,
});

type Service = {
  id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  description_ar: string | null;
  price_jod: number;
  duration_minutes: number;
};

type Barber = {
  id: string;
  name: string;
  name_ar: string | null;
  bio: string | null;
  photo_url: string | null;
};

type Review = {
  id: string;
  customer_name: string;
  rating: number;
  comment: string | null;
};

function Index() {
  const { t, lang } = useI18n();
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const phone = "+962798175723";

  useEffect(() => {
    (async () => {
      const [s, b, r] = await Promise.all([
        supabase.from("services").select("*").eq("active", true).order("sort_order"),
        supabase.from("barbers").select("*").eq("active", true).order("sort_order"),
        supabase.from("reviews").select("*").eq("approved", true).order("created_at", { ascending: false }).limit(6),
      ]);
      if (s.data) setServices(s.data as Service[]);
      if (b.data) setBarbers(b.data as Barber[]);
      if (r.data) setReviews(r.data as Review[]);
    })();
  }, []);

  const localized = <T extends { name: string; name_ar: string | null; description?: string | null; description_ar?: string | null; bio?: string | null }>(item: T) => ({
    name: lang === "ar" && item.name_ar ? item.name_ar : item.name,
    desc: lang === "ar" && (item as any).description_ar ? (item as any).description_ar : (item as any).description ?? (item as any).bio ?? "",
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img src={heroImage} alt="Nawras Barbershop interior" className="w-full h-full object-cover opacity-50" width={1920} height={1080} />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pt-20 pb-28 sm:pt-28 sm:pb-36 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full gold-border bg-card/40 text-xs uppercase tracking-[0.2em] text-primary/90 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {t("since")} · Amman, Jordan
          </div>
          <h1 className="font-display text-5xl sm:text-7xl font-light leading-[1.05] tracking-tight">
            <span className="block text-foreground/95">{t("premiumExperience").split(" ").slice(0, -2).join(" ")}</span>
            <span className="block gold-text italic font-medium">{t("premiumExperience").split(" ").slice(-2).join(" ")}</span>
          </h1>
          <p className="mt-6 max-w-xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed">
            {t("heroSubtitle")}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold tracking-wide shadow-[var(--shadow-luxe)] h-12 px-8">
              <Link to="/book">
                {t("bookNow")} <ArrowRight className="h-4 w-4 ms-1 rtl:rotate-180" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-border/60 hover:border-primary/60 hover:bg-card h-12 px-8">
              <a href={`https://wa.me/${phone.replace("+", "")}`} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" /> {t("whatsapp")}
              </a>
            </Button>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary/70" /> 10:00 AM – 11:00 PM</div>
            <div className="hidden sm:block h-4 w-px bg-border" />
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary/70" /> Wadi Al-Seer</div>
            <div className="hidden sm:block h-4 w-px bg-border" />
            <a href={`tel:${phone}`} className="flex items-center gap-2 hover:text-primary transition-colors">
              <Phone className="h-4 w-4 text-primary/70" /> 07 9817 5723
            </a>
          </div>
        </div>
      </section>

      <div className="hairline mx-auto max-w-6xl" />

      {/* SERVICES */}
      <section id="services" className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeader eyebrow={t("ourCraft")} title={t("services")} />
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => {
            const l = localized(s);
            return (
              <div key={s.id} className="luxe-card rounded-xl p-5 hover:border-primary/40 transition-colors group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-display text-xl text-foreground/95 group-hover:text-primary transition-colors">{l.name}</h3>
                    {l.desc && <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{l.desc}</p>}
                  </div>
                  <Scissors className="h-4 w-4 text-primary/40 shrink-0 mt-1" />
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <span className="text-xs text-muted-foreground">{s.duration_minutes} {t("min")}</span>
                  <span className="font-display text-2xl gold-text">{s.price_jod} <span className="text-xs font-body text-muted-foreground">{t("jod")}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="hairline mx-auto max-w-6xl" />

      {/* BARBERS */}
      <section id="barbers" className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeader eyebrow={t("meetTheTeam")} title={t("barbers")} />
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {barbers.map((b) => {
            const l = localized(b);
            return (
              <div key={b.id} className="luxe-card rounded-xl p-6 text-center">
                <div className="mx-auto h-24 w-24 rounded-full gold-border grid place-items-center bg-gradient-to-br from-card to-background overflow-hidden">
                  {b.photo_url ? (
                    <img src={b.photo_url} alt={l.name} className="h-full w-full object-cover" />
                  ) : (
                    <Scissors className="h-8 w-8 text-primary/60" />
                  )}
                </div>
                <h3 className="mt-4 font-display text-xl">{l.name}</h3>
                {l.desc && <p className="mt-2 text-sm text-muted-foreground">{l.desc}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <div className="hairline mx-auto max-w-6xl" />

      {/* REVIEWS */}
      {reviews.length > 0 && (
        <section id="reviews" className="mx-auto max-w-6xl px-4 py-20">
          <SectionHeader eyebrow="✦" title={t("whatClientsSay")} />
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviews.map((r) => (
              <div key={r.id} className="luxe-card rounded-xl p-6">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
                {r.comment && <p className="mt-3 text-sm text-foreground/85 italic leading-relaxed">"{r.comment}"</p>}
                <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">— {r.customer_name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CONTACT */}
      <section id="contact" className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeader eyebrow={t("visitUs")} title={t("location")} />
        <div className="mt-10 luxe-card rounded-2xl p-8 sm:p-12 text-center">
          <MapPin className="mx-auto h-8 w-8 text-primary mb-4" />
          <p className="font-display text-2xl">{t("address")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline" className="border-border/60 hover:border-primary/60">
              <a href={`tel:${phone}`}><Phone className="h-4 w-4" /> {t("call")}</a>
            </Button>
            <Button asChild variant="outline" className="border-border/60 hover:border-primary/60">
              <a href={`https://wa.me/${phone.replace("+", "")}`} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" /> {t("whatsapp")}
              </a>
            </Button>
            <Button asChild variant="outline" className="border-border/60 hover:border-primary/60">
              <a href="https://maps.google.com/?q=Nawras+Barbershop+Amman" target="_blank" rel="noreferrer">
                <MapPin className="h-4 w-4" /> {t("directions")}
              </a>
            </Button>
          </div>
          <div className="mt-10">
            <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-12 px-10 shadow-[var(--shadow-luxe)]">
              <Link to="/book">{t("bookNow")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-[0.3em] text-primary/80">{eyebrow}</div>
      <h2 className="mt-3 font-display text-4xl sm:text-5xl font-light"><span className="gold-text italic">{title}</span></h2>
    </div>
  );
}
