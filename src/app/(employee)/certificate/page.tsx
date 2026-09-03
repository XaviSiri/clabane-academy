import { requireEmployee } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { CertificateDownloadButton } from "@/components/CertificateDownloadButton";

export default async function CertificatePage() {
  const session = await requireEmployee();
  const certificate = await prisma.certificate.findFirst({ where: { employeeId: session.sub } });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Your Certificate</h1>
      {certificate ? (
        <div className="card space-y-4 text-center">
          <div className="rounded-md border-2 border-dashed border-amber-300 bg-amber-50 p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0d1b3e]">Clabane Academy</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">Certificate of Completion</p>
            <p className="mt-4 text-sm text-slate-600">
              Issued {certificate.issuedAt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
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
