import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { MapPin, Phone, MessageCircle, Instagram, Facebook, Lock } from "lucide-react";

const INSTAGRAM_URL = "https://www.instagram.com/nawras.jo1?igsh=aXFqM2NibXM4NzVx";
const FACEBOOK_URL = "https://www.facebook.com/share/1Bp3jCRwy1/";

export function SiteFooter() {
  const { t } = useI18n();
  const phone = "+962798175723";
  return (
    <footer className="mt-24 border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 sm:grid-cols-3">
        <div>
          <div className="font-display text-2xl gold-text">{t("brandFull")}</div>
          <p className="mt-2 text-sm text-muted-foreground">{t("tagline")}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-primary/80">{t("since")}</p>
        </div>
        <div className="text-sm space-y-2">
          <div className="font-medium text-foreground/90">{t("visitUs")}</div>
          <a
            href="https://www.google.com/maps/search/?api=1&query=Nawras+The+Barbershop+Wadi+Al-Seer+Amman"
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
          <div className="text-muted-foreground">Sun – Sat · 12:00 PM – 11:30 PM</div>

          <div className="font-medium text-foreground/90 pt-3">{t("followUs")}</div>
          <div className="flex items-center gap-2">
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" aria-label="Instagram"
              className="h-9 w-9 grid place-items-center rounded-full border border-border/60 hover:border-primary hover:text-primary transition-colors">
              <Instagram className="h-4 w-4" />
            </a>
            <a href={FACEBOOK_URL} target="_blank" rel="noreferrer" aria-label="Facebook"
              className="h-9 w-9 grid place-items-center rounded-full border border-border/60 hover:border-primary hover:text-primary transition-colors">
              <Facebook className="h-4 w-4" />
            </a>
          </div>

          <div className="flex items-center gap-3 pt-4 text-xs">
            <Link to="/login" className="text-muted-foreground/70 hover:text-primary">
              {t("customerLogin")}
            </Link>
            <span className="text-muted-foreground/30">·</span>
            <Link to="/admin" className="text-muted-foreground/70 hover:text-primary inline-flex items-center gap-1">
              <Lock className="h-3 w-3" /> Staff / {t("adminLogin")}
            </Link>
          </div>
        </div>
      </div>
      <div className="hairline" />
      <div className="text-center text-xs text-muted-foreground/60 py-4">
        © {new Date().getFullYear()} Nawras The Barbershop · Amman · {t("since")}
      </div>
    </footer>
  );
}
