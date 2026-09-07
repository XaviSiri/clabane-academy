import { requireEmployee } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { CertificateDownloadButton } from "@/components/CertificateDownloadButton";

export default async function CertificatePage() {
  const session = await requireEmployee();
  const [certificate, user] = await Promise.all([
    prisma.certificate.findFirst({ where: { employeeId: session.sub } }),
    prisma.user.findUniqueOrThrow({ where: { id: session.sub }, include: { profile: true } }),
  ]);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Your Certificate</h1>
      {certificate ? (
        <div className="card space-y-4 text-center">
          <div className="rounded-md border-2 border-dashed border-amber-300 bg-amber-50 p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--clabane-primary)]">Clabane Academy</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">Certificate of Completion</p>
            <p className="mt-4 text-sm text-slate-600">This certifies that</p>
            <p className="mt-1 text-xl font-semibold text-[var(--clabane-primary)]">{user.profile?.fullName ?? user.email}</p>
            <p className="mt-1 text-sm text-slate-600">
              has successfully completed the Clabane Academy onboarding programme.
            </p>
            <p className="mt-4 text-sm text-slate-600">
              Completion Date:{" "}
              {certificate.issuedAt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p className="mt-1 text-xs text-slate-400">Certificate ID: {certificate.certificateNo}</p>
          </div>
          <CertificateDownloadButton />
        </div>
      ) : (
        <div className="card text-sm text-slate-600">
          Complete all required onboarding modules to earn your Clabane Academy certificate.
        </div>
      )}
    </div>
  );
}
