import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { LessonManager } from "@/components/admin/LessonManager";
import { ModuleEditPanel } from "@/components/admin/ModuleEditPanel";

export default async function ModuleDetailPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const module_ = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { lessons: { orderBy: { order: "asc" } }, assessment: { include: { questions: true } } },
  });
  if (!module_) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/content" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to content
      </Link>
      <ModuleEditPanel module={module_} />

      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-700">Module Assessment</h2>
          <Link href={`/admin/content/${moduleId}/assessment`} className="btn-secondary text-xs">
            {module_.assessment ? "Manage assessment" : "Create assessment"}
          </Link>
        </div>
        {module_.assessment && (
          <p className="mt-2 text-xs text-slate-500">
            {module_.assessment.questions.length} question(s) · Pass mark {module_.assessment.passMarkPercent}% ·{" "}
            {module_.assessment.isPublished ? "Published" : "Draft"}
          </p>
        )}
      </div>

      <LessonManager moduleId={moduleId} initialLessons={module_.lessons} />
    </div>
  );
}
