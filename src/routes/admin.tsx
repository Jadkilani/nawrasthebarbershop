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
import { Lock, Crown, Scissors } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLogin,
});

function AdminLogin() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"admin" | "staff">("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const roles = (roleData ?? []).map((r: { role: string }) => r.role);
      if (roles.includes("admin")) navigate({ to: "/admin/dashboard" });
      else if (roles.includes("employee")) navigate({ to: "/staff/dashboard" });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    // Try to claim staff role from allowlist (no-op if already has it or not on allowlist)
    await supabase.rpc("claim_staff_role").catch(() => {});

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (roleData ?? []).map((r: { role: string }) => r.role);

    setLoading(false);

    if (tab === "admin") {
      if (!roles.includes("admin")) {
        await supabase.auth.signOut();
        toast.error("This account is not an admin.");
        return;
      }
      navigate({ to: "/admin/dashboard" });
      return;
    }
    // staff tab
    if (!roles.includes("employee") && !roles.includes("admin")) {
      await supabase.auth.signOut();
      toast.error("This email is not on the staff list. Ask the admin to add you.");
      return;
    }
    navigate({ to: roles.includes("admin") ? "/admin/dashboard" : "/staff/dashboard" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4 py-16">
        <form onSubmit={handleSubmit} className="luxe-card rounded-2xl p-8 max-w-sm w-full">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 grid place-items-center mb-4">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h1 className="font-display text-2xl text-center gold-text">Staff & Admin</h1>
          <p className="text-xs text-center text-muted-foreground mt-1">Barber & owner access only</p>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "admin" | "staff")} className="mt-6">
            <TabsList className="grid grid-cols-2 w-full bg-card border border-border/60">
              <TabsTrigger value="staff"><Scissors className="h-4 w-4 me-1.5" /> {t("staffLogin")}</TabsTrigger>
              <TabsTrigger value="admin"><Crown className="h-4 w-4 me-1.5" /> {t("adminLogin")}</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="mt-5 space-y-4">
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

          <div className="hairline my-4" />
          <div className="flex items-center justify-between text-xs">
            <Link to="/" className="text-muted-foreground hover:text-primary">
              ← {t("back_home")}
            </Link>
            <Link to="/login" className="text-muted-foreground hover:text-primary">
              {t("customerLogin")} →
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
