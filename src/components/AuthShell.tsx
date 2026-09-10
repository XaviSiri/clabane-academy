import { ClabaneLogo } from "./ClabaneLogo";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 rounded-lg bg-gradient-to-br from-[var(--clabane-nero)] to-[var(--clabane-verdun-green)] px-6 py-8 text-center">
          <ClabaneLogo imgClassName="mx-auto h-10 sm:h-12 w-auto" />
          <p className="mt-2 text-sm italic text-[var(--clabane-water-leaf)]">We Love African Skin</p>
          {subtitle && <p className="mt-1 text-sm text-white/70">{subtitle}</p>}
        </div>
        <div className="card">
          <h2 className="mb-4 text-lg font-medium text-slate-900">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
