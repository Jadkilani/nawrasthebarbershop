import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, User } from "lucide-react";

type LoginSearch = { redirect?: string; mode?: "login" | "signup" };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    mode: search.mode === "signup" ? "signup" : "login",
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: search.redirect === "/book" ? "/book" : "/" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/book`,
          data: { full_name: name },
        },
      });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Account created — you can sign in now.");
      setMode("login");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: search.redirect === "/book" ? "/book" : "/" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4 py-12">
        <div className="luxe-card rounded-2xl p-6 sm:p-8 max-w-sm w-full">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 grid place-items-center mb-4">
            <User className="h-5 w-5 text-primary" />
          </div>
          <h1 className="font-display text-2xl text-center gold-text">
            {mode === "signup" ? t("createAccount") : t("customerLogin")}
          </h1>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Customers must sign in to book.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">{t("fullName")}</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 bg-input/60 border-border/60" />
              </div>
            )}
            <div>
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 bg-input/60 border-border/60" />
            </div>
            <div>
              <Label htmlFor="password">{t("password")}</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 bg-input/60 border-border/60" />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
              {loading ? t("loading") : mode === "signup" ? t("createAccount") : t("signIn")}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            className="block mx-auto text-xs text-muted-foreground hover:text-primary mt-4"
          >
            {mode === "signup" ? t("haveAccount") + " " + t("signIn") : t("noAccount") + " " + t("createAccount")}
          </button>

          <div className="hairline my-4" />
          <div className="flex items-center justify-between text-xs">
            <Link to="/" className="text-muted-foreground hover:text-primary">
              ← {t("back_home")}
            </Link>
            <Link to="/admin" className="text-muted-foreground hover:text-primary inline-flex items-center gap-1">
              <Lock className="h-3 w-3" /> Staff / {t("adminLogin")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
