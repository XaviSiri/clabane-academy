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
    <div className="flex min-h-full items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 rounded-lg bg-[linear-gradient(135deg,theme(colors.nero)_0%,theme(colors.verdun-green)_100%)] px-6 py-8 text-center">
          <div className="flex justify-center">
            <ClabaneLogo height={40} mobileHeight={32} />
          </div>
          {subtitle && <p className="mt-2 text-sm text-white/70">{subtitle}</p>}
        </div>
        <div className="card">
          <h2 className="mb-4 text-lg font-medium text-slate-900">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
