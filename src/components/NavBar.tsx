"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";

interface NavLink {
  href: string;
  label: string;
}

export function NavBar({ links, roleLabel }: { links: NavLink[]; roleLabel: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

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
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--clabane-primary)] text-xs font-bold text-white">
              CA
            </span>
            <span className="flex flex-col leading-tight">
              Clabane Academy
              <span className="hidden text-[10px] font-normal italic text-[var(--clabane-accent)] sm:inline">
                We Love African Skin
              </span>
            </span>
          </span>
          <div className="hidden gap-1 sm:flex">
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide",
                    active
                      ? "text-[var(--clabane-accent)]"
                      : "text-slate-600 hover:text-[var(--clabane-accent)]"
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
          <button onClick={handleLogout} className="btn-secondary hidden text-xs sm:inline-flex">
            Sign out
          </button>
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 sm:hidden"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-200 bg-white sm:hidden">
          <div className="flex flex-col px-4 py-2">
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={clsx(
                    "rounded-md px-3 py-2.5 text-sm font-medium",
                    active ? "bg-slate-100 text-[var(--clabane-accent)]" : "text-slate-600"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-1 flex items-center justify-between border-t border-slate-100 px-3 py-2.5">
              <span className="text-xs uppercase tracking-wide text-slate-400">{roleLabel}</span>
              <button onClick={handleLogout} className="btn-secondary text-xs">
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
