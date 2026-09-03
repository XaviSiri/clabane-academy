import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEmployee } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { areAllLessonsComplete } from "@/lib/services/progress";
import { StatusBadge } from "@/components/StatusBadge";

export default async function ModulePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireEmployee();
  const { id } = await params;

  const module_ = await prisma.module.findFirst({
    where: { id, isPublished: true },
    include: {
      lessons: { where: { isPublished: true }, orderBy: { order: "asc" } },
      assessment: true,
      moduleProgress: { where: { employeeId: session.sub } },
    },
  });
  if (!module_) notFound();

  const lessonIds = module_.lessons.map((l) => l.id);
  const lessonProgress = await prisma.lessonProgress.findMany({
    where: { employeeId: session.sub, lessonId: { in: lessonIds } },
  });
  const progressByLesson = new Map(lessonProgress.map((p) => [p.lessonId, p.status]));

  const allLessonsComplete = await areAllLessonsComplete(session.sub, id);
  const moduleStatus = module_.moduleProgress[0]?.status ?? "NOT_STARTED";

  const attempts = module_.assessment
    ? await prisma.assessmentAttempt.findMany({
        where: { employeeId: session.sub, assessmentId: module_.assessment.id },
        orderBy: { attemptNumber: "asc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to dashboard
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">{module_.title}</h1>
          <StatusBadge status={moduleStatus} />
        </div>
        {module_.description && <p className="mt-1 text-sm text-slate-600">{module_.description}</p>}
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-medium text-slate-700">Lessons</h2>
        <ul className="divide-y divide-slate-100">
          {module_.lessons.map((lesson, idx) => (
            <li key={lesson.id} className="flex items-center justify-between py-3">
              <Link href={`/lessons/${lesson.id}`} className="flex-1 text-sm font-medium text-slate-900 hover:text-[#0d1b3e]">
                {idx + 1}. {lesson.title}
              </Link>
              <StatusBadge status={progressByLesson.get(lesson.id) ?? "NOT_STARTED"} />
            </li>
          ))}
          {module_.lessons.length === 0 && (
            <p className="py-3 text-sm text-slate-500">No lessons have been published for this module yet.</p>
          )}
        </ul>
      </div>

      {module_.assessment && (
        <div className="card">
          <h2 className="mb-2 text-sm font-medium text-slate-700">Module Assessment</h2>
          <p className="mb-3 text-sm text-slate-600">
            Pass mark: {module_.assessment.passMarkPercent}%. Complete all lessons above before attempting
            this assessment.
          </p>
          {attempts.length > 0 && (
            <ul className="mb-3 space-y-1 text-xs text-slate-500">
              {attempts.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  Attempt {a.attemptNumber}: {a.scorePercent ?? "—"}%
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
          {moduleStatus === "COMPLETED" ? (
            <span className="badge-completed">Assessment passed</span>
          ) : allLessonsComplete ? (
            <Link href={`/assessments/${module_.assessment.id}`} className="btn-primary">
              {attempts.some((a) => a.status === "IN_PROGRESS")
                ? "Continue assessment"
                : attempts.some((a) => a.status === "FAILED")
                  ? "Retake assessment"
                  : "Start assessment"}
            </Link>
          ) : (
            <button disabled className="btn-secondary cursor-not-allowed opacity-50">
              Complete all lessons to unlock
            </button>
          )}
        </div>
      )}
    </div>
  );
}
