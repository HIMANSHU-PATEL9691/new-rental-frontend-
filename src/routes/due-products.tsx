import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { DuesPage } from "@/components/forms/DuesPage";

// Custom lightweight navigation hook
const useNavigate = () => {
  return (options: { to: string }) => {
    window.history.pushState({}, '', options.to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
};

export default function RouteComponent() {
  const navigate = useNavigate();

  useEffect(() => {
    const role = (localStorage.getItem("user_role") || "").toLowerCase();
    if (!role) navigate({ to: "/login" });
    else if (!["admin", "superadmin", "super_admin"].includes(role)) navigate({ to: "/availability" });
  }, []);

  return (
    <AppShell>
      <DuesPage />
    </AppShell>
  );
}
