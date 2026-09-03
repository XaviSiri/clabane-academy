"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";

interface NavLink {
  href: string;
  label: string;
}

export function NavBar({ links, roleLabel }: { links: NavLink[]; roleLabel: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0d1b3e] text-xs font-bold text-white">
              CA
            </span>
            Clabane Academy
          </span>
          <div className="hidden gap-1 sm:flex">
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "rounded-md px-3 py-2 text-sm font-medium",
                    active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs uppercase tracking-wide text-slate-400 sm:inline">
            {roleLabel}
          </span>
          <button onClick={handleLogout} className="btn-secondary text-xs">
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
