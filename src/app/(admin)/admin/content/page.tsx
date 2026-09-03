import { ModuleList } from "@/components/admin/ModuleList";

export default function ContentPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Content Management</h1>
      <p className="text-sm text-slate-500">
        Modules → Lessons → Video / Text / Documents → Assessment. Add and edit onboarding content here — no
        code changes required.
      </p>
      <ModuleList />
    </div>
  );
}
