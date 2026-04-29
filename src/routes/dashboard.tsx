import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Smart redirect for /dashboard — sends users to the right place based on role
export const Route = createFileRoute("/dashboard")({
  component: DashboardRedirect,
});

function DashboardRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/login" });
        return;
      }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      const roles = (data ?? []).map((r: { role: string }) => r.role);
      if (roles.includes("admin")) navigate({ to: "/admin/dashboard" });
      else if (roles.includes("employee")) navigate({ to: "/staff/dashboard" });
      else navigate({ to: "/my-bookings" });
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen grid place-items-center text-muted-foreground">
      Redirecting…
    </div>
  );
}
