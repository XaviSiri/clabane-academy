import { requireEmployee } from "@/lib/auth/rbac";
import { NavBar } from "@/components/NavBar";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/certificate", label: "Certificate" },
  { href: "/account", label: "Account" },
];

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  await requireEmployee();
  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar links={links} roleLabel="Employee" />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
