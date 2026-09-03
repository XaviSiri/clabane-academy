import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEmployee } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { LessonVideoBlock } from "@/components/LessonVideoBlock";
import { DocumentLink } from "@/components/DocumentLink";
import { MarkLessonComplete } from "@/components/MarkLessonComplete";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireEmployee();
  const { id } = await params;

  const lesson = await prisma.lesson.findFirst({
    where: { id, isPublished: true },
    include: {
      module: true,
      videos: { where: { isPublished: true }, orderBy: { createdAt: "asc" } },
      documents: { where: { isPublished: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!lesson || !lesson.module.isPublished) notFound();

  const progress = await prisma.lessonProgress.findUnique({
    where: { employeeId_lessonId: { employeeId: session.sub, lessonId: id } },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/modules/${lesson.moduleId}`} className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to {lesson.module.title}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{lesson.title}</h1>
      </div>

      {lesson.videos.map((video) => (
        <div key={video.id} className="card">
          <LessonVideoBlock videoId={video.id} title={video.title} />
        </div>
      ))}

      {lesson.content && (
        <div className="card">
          <div className="prose prose-slate max-w-none whitespace-pre-wrap text-sm text-slate-700">
            {lesson.content}
          </div>
        </div>
      )}

      {lesson.documents.length > 0 && (
        <div className="card">
          <h2 className="mb-3 text-sm font-medium text-slate-700">Supporting Documents</h2>
          <div className="space-y-2">
            {lesson.documents.map((doc) => (
              <DocumentLink key={doc.id} documentId={doc.id} title={doc.title} />
            ))}
          </div>
        </div>
      )}

      {lesson.videos.length === 0 && (
        <div className="card">
          <MarkLessonComplete lessonId={lesson.id} alreadyComplete={progress?.status === "COMPLETED"} />
        </div>
      )}
      {lesson.videos.length > 0 && progress?.status === "COMPLETED" && (
        <span className="badge-completed">Lesson completed</span>
      )}
    </div>
  );
}
