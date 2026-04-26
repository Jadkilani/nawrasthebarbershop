import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Languages, Scissors } from "lucide-react";

export function SiteHeader() {
  const { t, toggle, lang } = useI18n();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="grid place-items-center h-9 w-9 rounded-full gold-border bg-gradient-to-br from-card to-background">
            <Scissors className="h-4 w-4 text-primary" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-xl tracking-wide gold-text">{t("brand")}</span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-0.5">Barbershop</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Toggle language"
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md border border-border/70 hover:border-primary/50 transition-colors text-sm text-muted-foreground hover:text-foreground"
          >
            <Languages className="h-4 w-4" />
            <span className="font-medium">{lang === "en" ? "ع" : "EN"}</span>
          </button>
          <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            <Link to="/book">{t("bookNow")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
