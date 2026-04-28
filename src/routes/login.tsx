import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Lock, User, Scissors, Crown } from "lucide-react";

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
  const [tab, setTab] = useState<"customer" | "staff">("customer");
  const [mode, setMode] = useState<"login" | "signup">(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Already logged in — route based on role
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .then(({ data }) => {
            const roles = (data ?? []).map((r) => r.role);
            if (roles.includes("admin") || roles.includes("employee")) {
              navigate({ to: "/admin/dashboard" });
            } else {
              navigate({ to: search.redirect === "/book" ? "/book" : "/" });
            }
          });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "signup" && tab === "customer") {
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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);

    // Check role for staff tab routing
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (roleData ?? []).map((r) => r.role);

    if (tab === "staff") {
      if (!roles.includes("admin") && !roles.includes("employee")) {
        await supabase.auth.signOut();
        toast.error("This account is not staff. Use Customer tab.");
        return;
      }
      navigate({ to: "/admin/dashboard" });
      return;
    }

    // Customer
    navigate({ to: search.redirect === "/book" ? "/book" : "/" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4 py-12">
        <div className="luxe-card rounded-2xl p-6 sm:p-8 max-w-sm w-full">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 grid place-items-center mb-4">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h1 className="font-display text-2xl text-center gold-text">
            {mode === "signup" ? t("createAccount") : t("signIn")}
          </h1>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "customer" | "staff")} className="mt-6">
            <TabsList className="grid grid-cols-2 w-full bg-card border border-border/60">
              <TabsTrigger value="customer"><User className="h-4 w-4 me-1.5" /> {t("customerLogin")}</TabsTrigger>
              <TabsTrigger value="staff"><Crown className="h-4 w-4 me-1.5" /> Staff</TabsTrigger>
            </TabsList>

            <TabsContent value="customer" className="mt-1">
              <p className="text-[11px] text-muted-foreground text-center pt-2">
                Customers must sign in to book.
              </p>
            </TabsContent>
            <TabsContent value="staff" className="mt-1">
              <p className="text-[11px] text-muted-foreground text-center pt-2">
                <Scissors className="h-3 w-3 inline" /> {t("ownerLogin")} · {t("employeeLogin")}
              </p>
            </TabsContent>
          </Tabs>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode === "signup" && tab === "customer" && (
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

          {tab === "customer" && (
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "login" : "signup")}
              className="block mx-auto text-xs text-muted-foreground hover:text-primary mt-4"
            >
              {mode === "signup" ? t("haveAccount") + " " + t("signIn") : t("noAccount") + " " + t("createAccount")}
            </button>
          )}

          <Link to="/" className="block text-center text-xs text-muted-foreground hover:text-primary mt-4">
            ← {t("back_home")}
          </Link>
        </div>
      </main>
    </div>
  );
}
