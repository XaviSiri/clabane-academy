import { requireAdmin } from "@/lib/auth/rbac";
import { NavBar } from "@/components/NavBar";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/employees", label: "Employees" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-full bg-slate-50">
      <NavBar links={links} roleLabel="Administrator" />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
