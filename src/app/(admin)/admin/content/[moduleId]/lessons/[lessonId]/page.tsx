import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { LessonContentEditor } from "@/components/admin/LessonContentEditor";
import { VideoManager } from "@/components/admin/VideoManager";
import { DocumentManager } from "@/components/admin/DocumentManager";

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ moduleId: string; lessonId: string }>;
}) {
  const { moduleId, lessonId } = await params;
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      videos: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "asc" } },
      module: true,
    },
  });
  if (!lesson || lesson.moduleId !== moduleId) notFound();

  const videos = lesson.videos.map((v) => ({ ...v, fileSizeBytes: v.fileSizeBytes?.toString() ?? null }));
  const documents = lesson.documents.map((d) => ({ ...d, fileSizeBytes: d.fileSizeBytes?.toString() ?? null }));

  return (
    <div className="space-y-6">
      <Link href={`/admin/content/${moduleId}`} className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to {lesson.module.title}
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">{lesson.title}</h1>

      <LessonContentEditor lessonId={lesson.id} initialContent={lesson.content} />
      <VideoManager lessonId={lesson.id} initialVideos={videos} />
      <DocumentManager lessonId={lesson.id} initialDocuments={documents} />
    </div>
  );
}
