import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { AssessmentBuilder } from "@/components/admin/AssessmentBuilder";
import { CreateAssessmentForm } from "@/components/admin/CreateAssessmentForm";

export default async function AssessmentBuilderPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const module_ = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { assessment: { include: { questions: { include: { options: true }, orderBy: { order: "asc" } } } } },
  });
  if (!module_) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/admin/content/${moduleId}`} className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to {module_.title}
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">{module_.title} — Assessment</h1>

      {module_.assessment ? (
        <AssessmentBuilder assessment={module_.assessment} />
      ) : (
        <CreateAssessmentForm moduleId={moduleId} />
      )}
    </div>
  );
}
