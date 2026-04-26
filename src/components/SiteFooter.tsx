import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { MapPin, Phone, MessageCircle } from "lucide-react";

export function SiteFooter() {
  const { t } = useI18n();
  const phone = "+962798175723";
  return (
    <footer className="mt-24 border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 sm:grid-cols-3">
        <div>
          <div className="font-display text-2xl gold-text">{t("brandFull")}</div>
          <p className="mt-2 text-sm text-muted-foreground">{t("tagline")}</p>
        </div>
        <div className="text-sm space-y-2">
          <div className="font-medium text-foreground/90">{t("visitUs")}</div>
          <a
            href="https://maps.google.com/?q=Nawras+Barbershop+Amman"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <MapPin className="h-4 w-4" /> {t("address")}
          </a>
          <a href={`tel:${phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
            <Phone className="h-4 w-4" /> 07 9817 5723
          </a>
          <a
            href={`https://wa.me/${phone.replace("+", "")}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </div>
        <div className="text-sm space-y-2">
          <div className="font-medium text-foreground/90">{t("hours")}</div>
          <div className="text-muted-foreground">Sun – Sat · 10:00 AM – 11:00 PM</div>
          <Link to="/admin" className="inline-block text-xs text-muted-foreground/60 hover:text-primary mt-4">
            {t("adminLogin")} →
          </Link>
        </div>
      </div>
      <div className="hairline" />
      <div className="text-center text-xs text-muted-foreground/60 py-4">
        © {new Date().getFullYear()} Nawras The Barbershop · Amman
      </div>
    </footer>
  );
}
