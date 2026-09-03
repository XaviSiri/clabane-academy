import { requireEmployee } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default async function AccountPage() {
  const session = await requireEmployee();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.sub }, include: { profile: true } });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Account</h1>
      <div className="card space-y-3">
        <h2 className="text-sm font-medium text-slate-700">Profile</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Name</dt>
            <dd className="font-medium text-slate-900">{user.profile?.fullName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-slate-900">{user.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Department</dt>
            <dd className="font-medium text-slate-900">{user.profile?.department || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Job Title</dt>
            <dd className="font-medium text-slate-900">{user.profile?.jobTitle || "—"}</dd>
          </div>
        </dl>
      </div>
      <div className="card">
        <h2 className="mb-3 text-sm font-medium text-slate-700">Change Password</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
