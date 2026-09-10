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
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--clabane-primary)] text-lg font-bold text-white">
            CA
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Clabane Academy</h1>
          <p className="mt-1 text-sm italic text-[var(--clabane-accent)]">We Love African Skin</p>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="card">
          <h2 className="mb-4 text-lg font-medium text-slate-900">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
