import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { format } from "date-fns";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Check, MessageCircle, Phone, Calendar as CalIcon, Scissors, User } from "lucide-react";

const searchSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  service: z.string().optional(),
  barber: z.string().optional(),
  when: z.string().optional(),
});

export const Route = createFileRoute("/booking-confirmed")({
  validateSearch: searchSchema,
  component: ConfirmedPage,
});

function ConfirmedPage() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const phone = "+962798175723";

  const when = search.when ? new Date(search.when) : null;
  const whenStr = when ? format(when, "EEEE, d MMM · h:mm a") : "";
  const waMessage = encodeURIComponent(
    `Hi! I just booked an appointment at Nawras Barbershop.\nName: ${search.name ?? ""}\nService: ${search.service ?? ""}\nBarber: ${search.barber ?? ""}\nWhen: ${whenStr}`
  );

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 grid place-items-center px-4 py-16">
        <div className="luxe-card rounded-2xl p-8 sm:p-12 max-w-lg w-full text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/15 grid place-items-center mb-5">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl gold-text">{t("bookingPending")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("confirmationMsg")}</p>

          <div className="hairline my-6" />

          {(search.service || search.barber || when) && (
            <div className="text-sm space-y-2 text-start">
              {search.name && (
                <Row icon={<User className="h-4 w-4" />} label={t("fullName")} value={search.name} />
              )}
              {search.service && (
                <Row icon={<Scissors className="h-4 w-4" />} label={t("services")} value={search.service} />
              )}
              {search.barber && (
                <Row icon={<User className="h-4 w-4" />} label={t("barbers")} value={search.barber} />
              )}
              {when && (
                <Row icon={<CalIcon className="h-4 w-4" />} label={t("selectDate")} value={format(when, "EEEE, d MMM · HH:mm")} />
              )}
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button asChild className="bg-[#25D366] hover:bg-[#1ebd5a] text-white font-semibold flex-1">
              <a href={`https://wa.me/${phone.replace("+", "")}?text=${waMessage}`} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" /> {t("whatsapp")}
              </a>
            </Button>
            <Button asChild variant="outline" className="border-border/60 flex-1">
              <a href={`tel:${phone}`}><Phone className="h-4 w-4" /> {t("call")}</a>
            </Button>
          </div>

          <div className="mt-6 flex justify-center gap-4 text-sm">
            <Link to="/book" className="text-muted-foreground hover:text-primary">{t("bookAnother")}</Link>
            <span className="text-border">·</span>
            <Link to="/" className="text-muted-foreground hover:text-primary">{t("back_home")}</Link>
          </div>
        </div>
      </main>

      <SiteFooter />
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
