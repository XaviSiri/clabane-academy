import { AssessmentRunner } from "@/components/AssessmentRunner";
import { requireEmployee } from "@/lib/auth/rbac";

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireEmployee();
  const { id } = await params;
  return (
    <div className="mx-auto max-w-2xl">
      <AssessmentRunner assessmentId={id} />
    </div>
  );
}
