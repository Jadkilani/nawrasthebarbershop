import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLogin,
});

function AdminLogin() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/admin/dashboard" });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // verify staff/owner role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .in("role", ["admin", "employee"]);
    if (!roleData?.length) {
      await supabase.auth.signOut();
      toast.error("This account does not have staff access.");
      return;
    }
    navigate({ to: "/admin/dashboard" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4 py-16">
        <form onSubmit={handleSubmit} className="luxe-card rounded-2xl p-8 max-w-sm w-full">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 grid place-items-center mb-4">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h1 className="font-display text-2xl text-center gold-text">{t("adminLogin")}</h1>
          <p className="text-xs text-center text-muted-foreground mt-1">Barber & owner access only</p>

          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 bg-input/60 border-border/60" />
            </div>
            <div>
              <Label htmlFor="password">{t("password")}</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 bg-input/60 border-border/60" />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            {loading ? t("loading") : t("signIn")}
          </Button>

          <Link to="/" className="block text-center text-xs text-muted-foreground hover:text-primary mt-4">
            ← {t("back_home")}
          </Link>
        </form>
      </main>
    </div>
  );
}
