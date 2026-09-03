import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-4 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Access denied</h1>
      <p className="max-w-sm text-sm text-slate-600">
        You don&apos;t have permission to view this page.
      </p>
      <Link href="/" className="btn-primary">
        Return home
      </Link>
    </div>
  );
}
