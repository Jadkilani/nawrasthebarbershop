import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginRedirect,
});

function LoginRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/" });
      else navigate({ to: "/admin" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4 py-12">
        <Card className="p-8 max-w-sm w-full text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 grid place-items-center mb-4">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Redirecting...</p>
          <Link to="/" className="block mt-6 text-xs text-muted-foreground hover:text-primary">
            ← Back to home
          </Link>
        </Card>
      </main>
    </div>
  );
}
